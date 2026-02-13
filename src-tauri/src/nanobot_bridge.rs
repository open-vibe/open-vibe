use std::collections::HashMap;
use std::path::PathBuf;
use std::process::Stdio;
use std::sync::Arc;
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};

use serde::{Deserialize, Serialize};
use serde_json::{json, Map, Value};
use tauri::{AppHandle, Emitter, Manager, State};
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::process::{Child, ChildStdin, ChildStdout, Command};
use tokio::sync::{mpsc, Mutex as TokioMutex};
use tokio::time::timeout;
use uuid::Uuid;

use crate::remote_backend;
use crate::state::AppState;
use crate::types::AppSettings;

const DAEMON_ARG: &str = "--nanobot-bridge-daemon";
const PROVIDER_THREAD_START_TIMEOUT_SECS: u64 = 30;
const PROVIDER_TURN_START_TIMEOUT_SECS: u64 = 45;
const PROVIDER_TURN_FIRST_EVENT_TIMEOUT_SECS: u64 = 20;
const PROVIDER_TURN_STREAM_TIMEOUT_SECS: u64 = 120;
const NANOBOT_PROVIDER_STATE_FILE: &str = "nanobot-provider-state.json";

#[derive(Clone, Debug, PartialEq, Eq)]
struct NanobotBridgeConfig {
    enabled: bool,
    mode: String,
}

impl NanobotBridgeConfig {
    fn from_settings(settings: &AppSettings) -> Self {
        Self {
            enabled: settings.nanobot_enabled,
            mode: settings.nanobot_mode.trim().to_string(),
        }
    }

    fn should_run(&self) -> bool {
        self.enabled
    }
}

pub(crate) struct NanobotBridgeState {
    child: Option<Child>,
    stdin: Option<ChildStdin>,
    config: Option<NanobotBridgeConfig>,
    provider_thread_by_key: HashMap<String, String>,
    provider_hashes_by_key: HashMap<String, Vec<String>>,
    provider_system_hash_by_key: HashMap<String, String>,
    provider_tools_hash_by_key: HashMap<String, String>,
    provider_turn_lock_by_key: HashMap<String, Arc<TokioMutex<()>>>,
}

impl Default for NanobotBridgeState {
    fn default() -> Self {
        Self {
            child: None,
            stdin: None,
            config: None,
            provider_thread_by_key: HashMap::new(),
            provider_hashes_by_key: HashMap::new(),
            provider_system_hash_by_key: HashMap::new(),
            provider_tools_hash_by_key: HashMap::new(),
            provider_turn_lock_by_key: HashMap::new(),
        }
    }
}

#[derive(Debug, Default, Serialize, Deserialize)]
struct PersistedProviderState {
    #[serde(default)]
    provider_threads: HashMap<String, String>,
    #[serde(default)]
    provider_hashes: HashMap<String, Vec<String>>,
    #[serde(default)]
    provider_system_hashes: HashMap<String, String>,
    #[serde(default)]
    provider_tools_hashes: HashMap<String, String>,
}

#[derive(Debug, Serialize)]
pub(crate) struct NanobotBridgeStatus {
    pub(crate) running: bool,
    pub(crate) configured: bool,
    pub(crate) mode: String,
}

fn child_is_running(child: &mut Child) -> bool {
    matches!(child.try_wait(), Ok(None))
}

fn emit_status(app: &AppHandle, connected: bool, reason: Option<String>) {
    let _ = app.emit(
        "nanobot-bridge-event",
        json!({
            "type": "status",
            "connected": connected,
            "reason": reason,
        }),
    );
}

fn emit_provider_event(
    app: &AppHandle,
    session_key: &str,
    request_id: &str,
    workspace_id: &str,
    phase: &str,
    duration_ms: Option<u128>,
    message: Option<String>,
) {
    let _ = app.emit(
        "nanobot-bridge-event",
        json!({
            "type": "provider",
            "sessionKey": session_key,
            "requestId": request_id,
            "workspaceId": workspace_id,
            "phase": phase,
            "durationMs": duration_ms.map(|value| value as u64),
            "message": message,
        }),
    );
}

fn normalize_required(value: Option<&Value>, field: &str) -> Result<String, String> {
    let Some(raw) = value else {
        return Err(format!("missing field: {field}"));
    };
    let trimmed = raw.as_str().unwrap_or("").trim().to_string();
    if trimmed.is_empty() {
        return Err(format!("missing field: {field}"));
    }
    Ok(trimmed)
}

fn unix_time_ms() -> i64 {
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default();
    now.as_millis() as i64
}

fn provider_state_path(app: &AppHandle) -> PathBuf {
    app.path()
        .app_data_dir()
        .unwrap_or_else(|_| std::env::current_dir().unwrap_or_else(|_| ".".into()))
        .join(NANOBOT_PROVIDER_STATE_FILE)
}

fn load_persisted_provider_state(app: &AppHandle) -> PersistedProviderState {
    let path = provider_state_path(app);
    let Ok(raw) = std::fs::read_to_string(path) else {
        return PersistedProviderState::default();
    };
    serde_json::from_str::<PersistedProviderState>(&raw).unwrap_or_default()
}

async fn persist_provider_state(app: &AppHandle) -> Result<(), String> {
    let (provider_threads, provider_hashes) = {
        let state = app.state::<AppState>();
        let guard = state.nanobot_bridge.lock().await;
        (
            guard.provider_thread_by_key.clone(),
            guard.provider_hashes_by_key.clone(),
        )
    };
    let (provider_system_hashes, provider_tools_hashes) = {
        let state = app.state::<AppState>();
        let guard = state.nanobot_bridge.lock().await;
        (
            guard.provider_system_hash_by_key.clone(),
            guard.provider_tools_hash_by_key.clone(),
        )
    };
    let payload = PersistedProviderState {
        provider_threads,
        provider_hashes,
        provider_system_hashes,
        provider_tools_hashes,
    };
    let path = provider_state_path(app);
    if let Some(parent) = path.parent() {
        tokio::fs::create_dir_all(parent)
            .await
            .map_err(|error| format!("Failed to create provider state directory: {error}"))?;
    }
    let serialized = serde_json::to_string_pretty(&payload)
        .map_err(|error| format!("Failed to serialize provider state: {error}"))?;
    tokio::fs::write(path, serialized)
        .await
        .map_err(|error| format!("Failed to write provider state: {error}"))
}

fn extract_error_message(result: &Value) -> Option<String> {
    let error = result.get("error")?;
    let message = error
        .get("message")
        .and_then(Value::as_str)
        .unwrap_or("Unknown error");
    Some(message.to_string())
}

fn extract_thread_id(result: &Value) -> Option<String> {
    result
        .get("result")
        .and_then(|value| value.get("threadId"))
        .or_else(|| {
            result
                .get("result")
                .and_then(|value| value.get("thread"))
                .and_then(|value| value.get("id"))
        })
        .or_else(|| result.get("threadId"))
        .or_else(|| result.get("thread").and_then(|value| value.get("id")))
        .and_then(Value::as_str)
        .map(ToOwned::to_owned)
}

fn extract_json_value(raw: &str) -> Option<Value> {
    let start = raw.find('{')?;
    let end = raw.rfind('}')?;
    if end <= start {
        return None;
    }
    serde_json::from_str::<Value>(&raw[start..=end]).ok()
}

fn extract_agent_text_from_item(item: &Value) -> Option<String> {
    fn collect_text(value: &Value, acc: &mut Vec<String>) {
        match value {
            Value::String(raw) => {
                let trimmed = raw.trim();
                if !trimmed.is_empty() {
                    acc.push(trimmed.to_string());
                }
            }
            Value::Array(items) => {
                for item in items {
                    collect_text(item, acc);
                }
            }
            Value::Object(map) => {
                if let Some(text) = map.get("text").and_then(Value::as_str) {
                    let trimmed = text.trim();
                    if !trimmed.is_empty() {
                        acc.push(trimmed.to_string());
                    }
                }
                if let Some(content) = map.get("content") {
                    collect_text(content, acc);
                }
            }
            _ => {}
        }
    }

    for key in ["text", "content", "message"] {
        let Some(value) = item.get(key) else {
            continue;
        };
        let mut segments = Vec::new();
        collect_text(value, &mut segments);
        if !segments.is_empty() {
            return Some(segments.join(""));
        }
    }
    None
}

fn sanitize_nanobot_system_prompt(raw: &str) -> String {
    // nanobot's system prompt includes a time header that changes every message; strip it so
    // we can treat the rest as stable session context for a stateful provider thread.
    let mut out = Vec::new();
    let mut skipping_time = false;
    for line in raw.lines() {
        if line.trim() == "## Current Time" {
            skipping_time = true;
            continue;
        }
        if skipping_time {
            if line.trim() == "## Runtime" {
                skipping_time = false;
                out.push(line);
            }
            continue;
        }
        out.push(line);
    }
    out.join("\n").trim().to_string()
}

fn hash_value(value: &Value) -> String {
    let serialized = serde_json::to_string(value).unwrap_or_default();
    let mut hash = 0xcbf29ce484222325_u64;
    for byte in serialized.as_bytes() {
        hash ^= u64::from(*byte);
        hash = hash.wrapping_mul(0x100000001b3);
    }
    format!("{hash:016x}")
}

fn hash_text(value: &str) -> String {
    let mut hash = 0xcbf29ce484222325_u64;
    for byte in value.as_bytes() {
        hash ^= u64::from(*byte);
        hash = hash.wrapping_mul(0x100000001b3);
    }
    format!("{hash:016x}")
}

fn build_provider_prompt(
    mode_label: &str,
    system_context: Option<&str>,
    messages: &[Value],
    tools: Option<&[Value]>,
    model: Option<&str>,
    max_tokens: u32,
    temperature: f32,
) -> String {
    let messages_text = serde_json::to_string(messages).unwrap_or_else(|_| "[]".to_string());
    let tools_text = tools
        .map(|value| serde_json::to_string(value).unwrap_or_else(|_| "[]".to_string()))
        .unwrap_or_else(|| "[]".to_string());
    let model_text = model.unwrap_or("default");
    let system_text = system_context.unwrap_or("").trim();
    let system_block = if system_text.is_empty() {
        String::new()
    } else {
        format!("Nanobot session context (do not repeat):\n{system_text}\n\n")
    };
    format!(
        "You are OpenVibe's nanobot provider adapter.\n\
Given {mode_label} messages and optional tool definitions, return exactly one JSON object.\n\
Do NOT execute tools. Decide only the next assistant step.\n\n\
Required JSON schema:\n\
{{\n\
  \"content\": string | null,\n\
  \"tool_calls\": [\n\
    {{\"id\": \"call_x\", \"name\": \"tool_name\", \"arguments\": {{...}}}}\n\
  ],\n\
  \"finish_reason\": \"stop\" | \"tool_calls\",\n\
  \"reasoning_content\": string | null\n\
}}\n\n\
Rules:\n\
- If a tool is needed, set tool_calls and finish_reason=\"tool_calls\".\n\
- If no tool is needed, set tool_calls=[] and finish_reason=\"stop\".\n\
- Keep content concise.\n\
- Output strict JSON only, no markdown.\n\n\
Model hint: {model_text}\n\
Max tokens hint: {max_tokens}\n\
Temperature hint: {temperature}\n\n\
{system_block}Messages JSON:\n{messages_text}\n\n\
Tools JSON:\n{tools_text}\n"
    )
}

fn is_system_message(message: &Value) -> bool {
    message
        .get("role")
        .and_then(Value::as_str)
        .map(|role| role.eq_ignore_ascii_case("system"))
        .unwrap_or(false)
}

fn normalize_provider_messages(messages: &[Value]) -> Vec<Value> {
    let start = if messages.first().map(is_system_message).unwrap_or(false) {
        1
    } else {
        0
    };
    messages[start..].to_vec()
}

fn normalize_provider_response(raw: &str) -> Value {
    let Some(parsed) = extract_json_value(raw) else {
        return json!({
            "content": raw.trim(),
            "tool_calls": [],
            "finish_reason": "stop",
            "reasoning_content": Value::Null,
            "usage": {},
        });
    };
    let Some(obj) = parsed.as_object() else {
        return json!({
            "content": raw.trim(),
            "tool_calls": [],
            "finish_reason": "stop",
            "reasoning_content": Value::Null,
            "usage": {},
        });
    };

    let content = obj
        .get("content")
        .cloned()
        .filter(|value| value.is_string() || value.is_null())
        .unwrap_or(Value::Null);
    let finish_reason = obj
        .get("finish_reason")
        .or_else(|| obj.get("finishReason"))
        .and_then(Value::as_str)
        .unwrap_or("stop")
        .to_string();
    let reasoning_content = obj
        .get("reasoning_content")
        .or_else(|| obj.get("reasoningContent"))
        .cloned()
        .filter(|value| value.is_string() || value.is_null())
        .unwrap_or(Value::Null);
    let usage = obj
        .get("usage")
        .and_then(Value::as_object)
        .cloned()
        .unwrap_or_default();
    let raw_tool_calls = obj
        .get("tool_calls")
        .or_else(|| obj.get("toolCalls"))
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default();
    let mut tool_calls = Vec::new();
    for entry in raw_tool_calls {
        let Some(call) = entry.as_object() else {
            continue;
        };
        let name = call
            .get("name")
            .and_then(Value::as_str)
            .unwrap_or("")
            .trim()
            .to_string();
        if name.is_empty() {
            continue;
        }
        let id = call
            .get("id")
            .and_then(Value::as_str)
            .map(|value| value.trim().to_string())
            .filter(|value| !value.is_empty())
            .unwrap_or_else(|| format!("call-{}", Uuid::new_v4().simple()));
        let arguments = call
            .get("arguments")
            .and_then(Value::as_object)
            .cloned()
            .unwrap_or_default();
        tool_calls.push(json!({
            "id": id,
            "name": name,
            "arguments": arguments,
        }));
    }

    json!({
        "content": content,
        "tool_calls": tool_calls,
        "finish_reason": finish_reason,
        "reasoning_content": reasoning_content,
        "usage": usage,
    })
}

#[derive(Clone, Debug)]
struct ProviderTurnOverrides {
    model: Option<String>,
    effort: Option<String>,
    access_mode: String,
}

fn normalize_access_mode(raw: &str) -> String {
    match raw.trim() {
        "read-only" => "read-only".to_string(),
        "current" => "current".to_string(),
        _ => "full-access".to_string(),
    }
}

async fn resolve_provider_turn_overrides(
    app: &AppHandle,
    requested_model: Option<&str>,
) -> ProviderTurnOverrides {
    let (
        agent_model_override,
        agent_effort_override,
        preferred_model,
        composer_effort_override,
        access_mode_override,
    ) = {
        let state = app.state::<AppState>();
        let settings = state.app_settings.lock().await;
        (
            {
                let model = settings.nanobot_agent_model.trim();
                if model.is_empty() {
                    None
                } else {
                    Some(model.to_string())
                }
            },
            settings
                .nanobot_agent_reasoning_effort
                .as_ref()
                .map(|value| value.trim().to_string())
                .filter(|value| !value.is_empty()),
            settings
                .last_composer_model_id
                .as_ref()
                .map(|value| value.trim().to_string())
                .filter(|value| !value.is_empty()),
            settings
                .last_composer_reasoning_effort
                .as_ref()
                .map(|value| value.trim().to_string())
                .filter(|value| !value.is_empty()),
            settings
                .last_composer_access_mode
                .as_deref()
                .or(Some(settings.default_access_mode.as_str()))
                .map(normalize_access_mode)
                .unwrap_or_else(|| "full-access".to_string()),
        )
    };
    let model = agent_model_override.or(preferred_model).or_else(|| {
        requested_model
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .map(ToOwned::to_owned)
    });

    ProviderTurnOverrides {
        model,
        effort: agent_effort_override.or(composer_effort_override),
        access_mode: access_mode_override,
    }
}

async fn send_command_with_guard(
    guard: &mut NanobotBridgeState,
    command: &Value,
) -> Result<(), String> {
    let is_running = if let Some(child) = guard.child.as_mut() {
        child_is_running(child)
    } else {
        false
    };
    if !is_running {
        if guard.child.is_some() {
            guard.child = None;
            guard.stdin = None;
            guard.provider_turn_lock_by_key.clear();
            return Err("Nanobot bridge daemon stopped".to_string());
        }
        return Err("Nanobot bridge is not running".to_string());
    }

    let Some(stdin) = guard.stdin.as_mut() else {
        return Err("Nanobot bridge is not running".to_string());
    };

    let line = serde_json::to_string(command)
        .map_err(|error| format!("Failed to serialize nanobot bridge command: {error}"))?;
    stdin
        .write_all(line.as_bytes())
        .await
        .map_err(|error| format!("Failed to send nanobot bridge command: {error}"))?;
    stdin
        .write_all(b"\n")
        .await
        .map_err(|error| format!("Failed to flush nanobot bridge command: {error}"))?;

    Ok(())
}

async fn send_daemon_command(app: &AppHandle, command: Value) -> Result<(), String> {
    let state = app.state::<AppState>();
    let mut guard = state.nanobot_bridge.lock().await;
    send_command_with_guard(&mut guard, &command).await
}

async fn create_provider_bridge_thread(
    session: &std::sync::Arc<crate::codex::WorkspaceSession>,
    cwd: &str,
) -> Result<String, String> {
    let thread_result = timeout(
        Duration::from_secs(PROVIDER_THREAD_START_TIMEOUT_SECS),
        session.send_request(
            "thread/start",
            json!({
                "cwd": cwd,
                "approvalPolicy": "never",
            }),
        ),
    )
    .await
    .map_err(|_| "provider thread/start timed out".to_string())??;
    if let Some(error) = extract_error_message(&thread_result) {
        return Err(error);
    }
    extract_thread_id(&thread_result)
        .ok_or_else(|| "failed to create provider bridge thread".to_string())
}

async fn clear_provider_thread_for_key(app: &AppHandle, key: &str) {
    let state = app.state::<AppState>();
    {
        let mut guard = state.nanobot_bridge.lock().await;
        guard.provider_thread_by_key.remove(key);
        guard.provider_hashes_by_key.remove(key);
        guard.provider_system_hash_by_key.remove(key);
        guard.provider_tools_hash_by_key.remove(key);
    }
    if let Err(error) = persist_provider_state(app).await {
        eprintln!("[nanobot-bridge] failed to persist provider state after clear: {error}");
    }
}

async fn archive_provider_thread(
    session: &std::sync::Arc<crate::codex::WorkspaceSession>,
    thread_id: &str,
) {
    let _ = session
        .send_request(
            "thread/archive",
            json!({
                "threadId": thread_id,
            }),
        )
        .await;
}

async fn get_provider_turn_lock_for_key(app: &AppHandle, key: &str) -> Arc<TokioMutex<()>> {
    let state = app.state::<AppState>();
    let mut guard = state.nanobot_bridge.lock().await;
    guard
        .provider_turn_lock_by_key
        .entry(key.to_string())
        .or_insert_with(|| Arc::new(TokioMutex::new(())))
        .clone()
}

async fn run_provider_completion(
    app: &AppHandle,
    provider_key: &str,
    workspace_id: &str,
    system_context: Option<String>,
    provider_messages: Vec<Value>,
    messages_cursor: usize,
    tools: Vec<Value>,
    tools_hash: String,
    max_tokens: u32,
    temperature: f32,
    model: Option<String>,
    effort: Option<String>,
    _access_mode: String,
) -> Result<Value, String> {
    let session_turn_lock = get_provider_turn_lock_for_key(app, provider_key).await;
    let _session_turn_guard = session_turn_lock.lock().await;
    let state = app.state::<AppState>();
    if remote_backend::is_remote_mode(&*state).await {
        return Err("Provider bridge is unavailable in remote backend mode.".to_string());
    }
    let session = {
        let sessions = state.sessions.lock().await;
        sessions.get(workspace_id).cloned()
    }
    .or_else(|| state.global_session.get().cloned())
    .ok_or_else(|| "workspace not connected".to_string())?;
    let workspace_cwd = {
        let workspaces = state.workspaces.lock().await;
        workspaces
            .get(workspace_id)
            .map(|entry| entry.path.clone())
            .unwrap_or_else(|| session.entry.path.clone())
    };
    let provider_cwd = {
        let nanobot_root =
            nanobot::utils::get_data_path().unwrap_or_else(|_| PathBuf::from(&workspace_cwd));
        let isolated = nanobot_root.join(".openvibe").join("nanobot-provider");
        if std::fs::create_dir_all(&isolated).is_err() {
            // Fall back to a temp dir to avoid polluting a user workspace with internal provider threads.
            let tmp = std::env::temp_dir()
                .join("openvibe")
                .join("nanobot-provider");
            let _ = std::fs::create_dir_all(&tmp);
            tmp.to_string_lossy().to_string()
        } else {
            isolated.to_string_lossy().to_string()
        }
    };

    let mut provider_thread_id = {
        let guard = state.nanobot_bridge.lock().await;
        guard.provider_thread_by_key.get(provider_key).cloned()
    };

    for attempt in 0..2 {
        let mut created_new_thread = false;
        if provider_thread_id.is_none() {
            let created = create_provider_bridge_thread(&session, &provider_cwd).await?;
            {
                let mut guard = state.nanobot_bridge.lock().await;
                guard
                    .provider_thread_by_key
                    .insert(provider_key.to_string(), created.clone());
            }
            if let Err(error) = persist_provider_state(app).await {
                eprintln!("[nanobot-bridge] failed to persist provider thread mapping: {error}");
            }
            provider_thread_id = Some(created);
            created_new_thread = true;
        }
        let thread_id = provider_thread_id.clone().unwrap_or_default();

        let sanitized_system = system_context
            .as_deref()
            .map(sanitize_nanobot_system_prompt)
            .map(|value| value.trim().to_string())
            .filter(|value| !value.is_empty());
        let system_hash = sanitized_system
            .as_deref()
            .map(hash_text)
            .unwrap_or_default();

        // Decide what to include this turn:
        // - system/tools are only sent when the stable hash changes (or when the provider thread was rebuilt)
        // - messages are sent using a cursor to avoid re-sending full conversation history every request.
        let (include_system, include_tools) = {
            let guard = state.nanobot_bridge.lock().await;
            let include_system = !system_hash.is_empty()
                && (created_new_thread
                    || guard
                        .provider_system_hash_by_key
                        .get(provider_key)
                        .map(|stored| stored != &system_hash)
                        .unwrap_or(true));
            let include_tools = !tools_hash.is_empty()
                && (created_new_thread
                    || guard
                        .provider_tools_hash_by_key
                        .get(provider_key)
                        .map(|stored| stored != &tools_hash)
                        .unwrap_or(true));
            (include_system, include_tools)
        };

        let system_for_prompt = if include_system {
            sanitized_system.as_deref()
        } else {
            None
        };
        let tools_for_prompt = if include_tools {
            Some(tools.as_slice())
        } else {
            None
        };

        let mut snapshot = created_new_thread;
        if !snapshot {
            if messages_cursor == 0 {
                snapshot = true;
            } else if messages_cursor > provider_messages.len() {
                snapshot = true;
            }
        }

        let messages_for_prompt: Vec<Value> = if snapshot {
            provider_messages.clone()
        } else {
            provider_messages[messages_cursor..].to_vec()
        };
        let messages_for_prompt = if messages_for_prompt.is_empty() && !provider_messages.is_empty()
        {
            // Defensive: avoid sending an empty delta due to cursor mismatches.
            vec![provider_messages[provider_messages.len() - 1].clone()]
        } else {
            messages_for_prompt
        };

        let prompt = build_provider_prompt(
            if snapshot {
                "a full snapshot of"
            } else {
                "appended"
            },
            system_for_prompt,
            &messages_for_prompt,
            tools_for_prompt,
            model.as_deref(),
            max_tokens,
            temperature,
        );

        let (tx, mut rx) = mpsc::unbounded_channel::<Value>();
        {
            let mut callbacks = session.background_thread_callbacks.lock().await;
            callbacks.insert(thread_id.clone(), tx);
        }

        let mut turn_params = Map::new();
        turn_params.insert("threadId".to_string(), json!(thread_id.clone()));
        turn_params.insert(
            "input".to_string(),
            json!([{ "type": "text", "text": prompt }]),
        );
        turn_params.insert("cwd".to_string(), json!(provider_cwd.clone()));
        // Provider threads must never execute tools; treat the app-server as a pure model adapter.
        turn_params.insert("approvalPolicy".to_string(), json!("never"));
        turn_params.insert("sandboxPolicy".to_string(), json!({ "type": "readOnly" }));
        if let Some(model) = model.clone() {
            let trimmed = model.trim().to_string();
            if !trimmed.is_empty() {
                turn_params.insert("model".to_string(), json!(trimmed));
            }
        }
        if let Some(effort) = effort.clone() {
            let trimmed = effort.trim().to_string();
            if !trimmed.is_empty() {
                turn_params.insert("effort".to_string(), json!(trimmed));
            }
        }

        let turn_result = timeout(
            Duration::from_secs(PROVIDER_TURN_START_TIMEOUT_SECS),
            session.send_request("turn/start", Value::Object(turn_params)),
        )
        .await;
        let turn_result = match turn_result {
            Ok(Ok(value)) => value,
            Ok(Err(error)) => {
                let mut callbacks = session.background_thread_callbacks.lock().await;
                callbacks.remove(&thread_id);
                archive_provider_thread(&session, &thread_id).await;
                clear_provider_thread_for_key(app, provider_key).await;
                if attempt == 0 {
                    provider_thread_id = None;
                    continue;
                }
                return Err(error);
            }
            Err(_) => {
                let mut callbacks = session.background_thread_callbacks.lock().await;
                callbacks.remove(&thread_id);
                archive_provider_thread(&session, &thread_id).await;
                clear_provider_thread_for_key(app, provider_key).await;
                if attempt == 0 {
                    provider_thread_id = None;
                    continue;
                }
                return Err("provider turn/start timed out".to_string());
            }
        };
        if let Some(error) = extract_error_message(&turn_result) {
            let mut callbacks = session.background_thread_callbacks.lock().await;
            callbacks.remove(&thread_id);
            archive_provider_thread(&session, &thread_id).await;
            clear_provider_thread_for_key(app, provider_key).await;
            if attempt == 0 {
                provider_thread_id = None;
                continue;
            }
            return Err(error);
        }

        let collect_result = timeout(
            Duration::from_secs(PROVIDER_TURN_STREAM_TIMEOUT_SECS),
            async {
                let mut text = String::new();
                let first_event = timeout(
                    Duration::from_secs(PROVIDER_TURN_FIRST_EVENT_TIMEOUT_SECS),
                    rx.recv(),
                )
                .await
                .map_err(|_| "provider turn stalled waiting for output".to_string())?
                .ok_or_else(|| "provider turn stream closed".to_string())?;

                let mut pending = Some(first_event);
                loop {
                    let event = if let Some(value) = pending.take() {
                        value
                    } else {
                        match rx.recv().await {
                            Some(value) => value,
                            None => break,
                        }
                    };
                    let method = event.get("method").and_then(Value::as_str).unwrap_or("");
                    match method {
                        "item/agentMessage/delta" => {
                            if let Some(delta) = event
                                .get("params")
                                .and_then(|params| params.get("delta"))
                                .and_then(Value::as_str)
                            {
                                text.push_str(delta);
                            }
                        }
                        "item/completed" => {
                            if !text.trim().is_empty() {
                                continue;
                            }
                            let item = event
                                .get("params")
                                .and_then(|params| params.get("item"))
                                .cloned()
                                .unwrap_or_else(|| json!({}));
                            if item.get("type").and_then(Value::as_str) == Some("agentMessage") {
                                if let Some(completed_text) = extract_agent_text_from_item(&item) {
                                    text = completed_text;
                                }
                            }
                        }
                        "turn/completed" => break,
                        "turn/error" | "error" => {
                            let message = event
                                .get("params")
                                .and_then(|params| params.get("error"))
                                .and_then(|err| err.get("message"))
                                .and_then(Value::as_str)
                                .unwrap_or("provider turn failed")
                                .to_string();
                            return Err(message);
                        }
                        _ => {}
                    }
                }
                if text.trim().is_empty() {
                    return Err("provider returned empty response".to_string());
                }
                Ok(text)
            },
        )
        .await;

        {
            let mut callbacks = session.background_thread_callbacks.lock().await;
            callbacks.remove(&thread_id);
        }

        match collect_result {
            Ok(Ok(text)) => {
                let normalized = normalize_provider_response(&text);
                {
                    let mut guard = state.nanobot_bridge.lock().await;
                    if include_system && !system_hash.is_empty() {
                        guard
                            .provider_system_hash_by_key
                            .insert(provider_key.to_string(), system_hash);
                    } else if system_hash.is_empty() {
                        guard.provider_system_hash_by_key.remove(provider_key);
                    }

                    if include_tools && !tools_hash.is_empty() {
                        guard
                            .provider_tools_hash_by_key
                            .insert(provider_key.to_string(), tools_hash.clone());
                    } else if tools_hash.is_empty() {
                        guard.provider_tools_hash_by_key.remove(provider_key);
                    }
                }
                if let Err(error) = persist_provider_state(app).await {
                    eprintln!("[nanobot-bridge] failed to persist provider cursor hashes: {error}");
                }
                return Ok(normalized);
            }
            Ok(Err(error)) => {
                archive_provider_thread(&session, &thread_id).await;
                clear_provider_thread_for_key(app, provider_key).await;
                if attempt == 0 {
                    provider_thread_id = None;
                    continue;
                }
                return Err(error);
            }
            Err(_) => {
                archive_provider_thread(&session, &thread_id).await;
                clear_provider_thread_for_key(app, provider_key).await;
                if attempt == 0 {
                    provider_thread_id = None;
                    continue;
                }
                return Err("provider request timed out".to_string());
            }
        }
    }

    Err("failed to resolve provider bridge thread".to_string())
}

async fn handle_provider_request(app: &AppHandle, payload: &Value) -> Result<(), String> {
    let request_id = normalize_required(payload.get("requestId"), "requestId")?;
    let session_key = normalize_required(payload.get("sessionKey"), "sessionKey")?;
    let workspace_id = normalize_required(payload.get("workspaceId"), "workspaceId")?;
    let started_at = Instant::now();
    emit_provider_event(
        app,
        &session_key,
        &request_id,
        &workspace_id,
        "start",
        None,
        None,
    );
    let messages = payload
        .get("messages")
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default();
    let system_context = messages
        .first()
        .filter(|value| is_system_message(value))
        .and_then(extract_agent_text_from_item);
    let tools = payload
        .get("tools")
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default();
    let tools_hash = payload
        .get("toolsHash")
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToOwned::to_owned)
        .unwrap_or_else(|| hash_value(&Value::Array(tools.clone())));
    let messages_cursor = payload
        .get("messagesCursor")
        .and_then(Value::as_u64)
        .unwrap_or(0) as usize;
    let requested_model = payload
        .get("model")
        .and_then(Value::as_str)
        .map(ToOwned::to_owned);
    let provider_key = payload
        .get("threadId")
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .unwrap_or(session_key.as_str())
        .to_string();
    let overrides = resolve_provider_turn_overrides(app, requested_model.as_deref()).await;
    let max_tokens = payload
        .get("maxTokens")
        .and_then(Value::as_u64)
        .unwrap_or(4096) as u32;
    let temperature = payload
        .get("temperature")
        .and_then(Value::as_f64)
        .unwrap_or(0.7) as f32;

    let result = run_provider_completion(
        app,
        &provider_key,
        &workspace_id,
        system_context,
        normalize_provider_messages(&messages),
        messages_cursor,
        tools.clone(),
        tools_hash,
        max_tokens,
        temperature,
        overrides.model,
        overrides.effort,
        overrides.access_mode,
    )
    .await;
    match result {
        Ok(response) => {
            emit_provider_event(
                app,
                &session_key,
                &request_id,
                &workspace_id,
                "done",
                Some(started_at.elapsed().as_millis()),
                None,
            );
            send_daemon_command(
                app,
                json!({
                    "type": "provider-response",
                    "requestId": request_id,
                    "ok": true,
                    "response": response,
                }),
            )
            .await
        }
        Err(error) => {
            emit_provider_event(
                app,
                &session_key,
                &request_id,
                &workspace_id,
                "error",
                Some(started_at.elapsed().as_millis()),
                Some(error.clone()),
            );
            send_daemon_command(
                app,
                json!({
                    "type": "provider-response",
                    "requestId": request_id,
                    "ok": false,
                    "error": error,
                }),
            )
            .await
        }
    }
}

fn handle_agent_trace(app: &AppHandle, payload: &Value) -> Result<(), String> {
    let workspace_id = normalize_required(payload.get("workspaceId"), "workspaceId")?;
    let thread_id = normalize_required(payload.get("threadId"), "threadId")?;
    let role = normalize_required(payload.get("role"), "role")?;
    let content = normalize_required(payload.get("content"), "content")?;
    let created_at = payload
        .get("createdAt")
        .and_then(Value::as_i64)
        .unwrap_or_else(unix_time_ms);
    let item_id = format!(
        "nanobot-{}-{}-{}",
        role,
        created_at,
        Uuid::new_v4().simple()
    );
    let item = if role.eq_ignore_ascii_case("user") {
        json!({
            "id": item_id,
            "type": "userMessage",
            "content": [{ "type": "text", "text": content }],
        })
    } else {
        json!({
            "id": item_id,
            "type": "agentMessage",
            "text": content,
        })
    };
    let _ = app.emit(
        "app-server-event",
        json!({
            "workspace_id": workspace_id,
            "message": {
                "method": "item/completed",
                "params": {
                    "threadId": thread_id,
                    "item": item,
                }
            }
        }),
    );
    Ok(())
}

#[tauri::command]
pub(crate) async fn nanobot_bridge_status(
    state: State<'_, AppState>,
) -> Result<NanobotBridgeStatus, String> {
    let mut guard = state.nanobot_bridge.lock().await;
    let running = if let Some(child) = guard.child.as_mut() {
        if child_is_running(child) {
            true
        } else {
            guard.child = None;
            guard.stdin = None;
            false
        }
    } else {
        false
    };

    let mode = guard
        .config
        .as_ref()
        .map(|config| config.mode.clone())
        .unwrap_or_else(|| "bridge".to_string());
    let configured = guard
        .config
        .as_ref()
        .map(|config| config.should_run())
        .unwrap_or(false);

    Ok(NanobotBridgeStatus {
        running,
        configured,
        mode,
    })
}

pub(crate) async fn apply_settings(
    app: &AppHandle,
    state: &AppState,
    settings: &AppSettings,
) -> Result<(), String> {
    let config = NanobotBridgeConfig::from_settings(settings);
    let persisted = load_persisted_provider_state(app);
    let mut guard = state.nanobot_bridge.lock().await;
    if guard.provider_thread_by_key.is_empty()
        && guard.provider_hashes_by_key.is_empty()
        && guard.provider_system_hash_by_key.is_empty()
        && guard.provider_tools_hash_by_key.is_empty()
    {
        guard.provider_thread_by_key = persisted.provider_threads;
        guard.provider_hashes_by_key = persisted.provider_hashes;
        guard.provider_system_hash_by_key = persisted.provider_system_hashes;
        guard.provider_tools_hash_by_key = persisted.provider_tools_hashes;
    }
    if guard.config.as_ref() == Some(&config) {
        return Ok(());
    }

    if let Some(mut child) = guard.child.take() {
        stop_child(&mut child).await;
    }
    guard.stdin = None;
    guard.provider_turn_lock_by_key.clear();
    guard.config = Some(config.clone());

    if !config.should_run() {
        emit_status(app, false, None);
        return Ok(());
    }

    let daemon_binary = resolve_daemon_binary(app)?;
    let mut command = Command::new(&daemon_binary);
    crate::utils::apply_background_command_flags_tokio(&mut command);
    command.arg(DAEMON_ARG);
    command.stdin(Stdio::piped());
    command.stdout(Stdio::piped());
    command.stderr(Stdio::piped());
    command.kill_on_drop(true);

    let mut child = command.spawn().map_err(|error| {
        format!(
            "Failed to start nanobot bridge daemon at {}: {error}",
            daemon_binary.display()
        )
    })?;

    if let Some(stdout) = child.stdout.take() {
        spawn_stdout_reader(app.clone(), stdout);
    }
    if let Some(stderr) = child.stderr.take() {
        spawn_stderr_reader(app.clone(), stderr);
    }

    guard.stdin = child.stdin.take();
    guard.child = Some(child);
    Ok(())
}

pub(crate) async fn shutdown(state: &AppState) {
    let mut guard = state.nanobot_bridge.lock().await;
    if let Some(mut child) = guard.child.take() {
        stop_child(&mut child).await;
    }
    guard.stdin = None;
    guard.provider_turn_lock_by_key.clear();
    guard.config = None;
}

#[tauri::command]
pub(crate) async fn nanobot_bridge_send(
    command: Value,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let mut guard = state.nanobot_bridge.lock().await;
    send_command_with_guard(&mut guard, &command).await
}

async fn stop_child(child: &mut Child) {
    let _ = child.kill().await;
    let _ = child.wait().await;
}

fn spawn_stdout_reader(app: AppHandle, stdout: ChildStdout) {
    tokio::spawn(async move {
        let mut reader = BufReader::new(stdout).lines();
        while let Ok(Some(line)) = reader.next_line().await {
            if line.trim().is_empty() {
                continue;
            }
            if let Ok(payload) = serde_json::from_str::<Value>(&line) {
                let event_type = payload
                    .get("type")
                    .and_then(Value::as_str)
                    .unwrap_or_default();
                if event_type == "provider-request" {
                    if let Err(error) = handle_provider_request(&app, &payload).await {
                        eprintln!("[nanobot-bridge] provider request failed: {error}");
                        if let Some(request_id) = payload.get("requestId").and_then(Value::as_str) {
                            let _ = send_daemon_command(
                                &app,
                                json!({
                                    "type": "provider-response",
                                    "requestId": request_id,
                                    "ok": false,
                                    "error": error,
                                }),
                            )
                            .await;
                        }
                    }
                    continue;
                }
                if event_type == "agent-trace" {
                    if let Err(error) = handle_agent_trace(&app, &payload) {
                        eprintln!("[nanobot-bridge] agent trace emit failed: {error}");
                    }
                    let _ = app.emit("nanobot-bridge-event", payload);
                    continue;
                }
                let _ = app.emit("nanobot-bridge-event", payload);
            } else {
                println!("[nanobot-bridge] {line}");
            }
        }
        emit_status(
            &app,
            false,
            Some("nanobot bridge daemon disconnected".to_string()),
        );
    });
}

fn spawn_stderr_reader(app: AppHandle, stderr: tokio::process::ChildStderr) {
    tokio::spawn(async move {
        let mut reader = BufReader::new(stderr).lines();
        while let Ok(Some(line)) = reader.next_line().await {
            if line.trim().is_empty() {
                continue;
            }
            eprintln!("[nanobot-bridge] {line}");
            let _ = app.emit(
                "nanobot-bridge-event",
                json!({
                    "type": "stderr",
                    "message": line,
                }),
            );
        }
    });
}

fn resolve_daemon_binary(_app: &AppHandle) -> Result<PathBuf, String> {
    if let Ok(override_path) = std::env::var("OPENVIBE_NANOBOT_BRIDGE_BIN") {
        let path = PathBuf::from(override_path);
        if path.exists() {
            return Ok(path);
        }
        return Err(format!(
            "Nanobot bridge binary not found at {}",
            path.display()
        ));
    }

    std::env::current_exe()
        .map_err(|error| format!("Failed to resolve current executable path: {error}"))
}
