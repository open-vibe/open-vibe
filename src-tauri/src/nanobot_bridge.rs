use std::path::PathBuf;
use std::process::Stdio;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use serde::Serialize;
use serde_json::{Map, Value, json};
use tauri::{AppHandle, Emitter, Manager, State};
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::process::{Child, ChildStdin, ChildStdout, Command};
use tokio::sync::mpsc;
use tokio::time::timeout;
use uuid::Uuid;

use crate::remote_backend;
use crate::state::AppState;
use crate::types::AppSettings;

const DAEMON_ARG: &str = "--nanobot-bridge-daemon";

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
}

impl Default for NanobotBridgeState {
    fn default() -> Self {
        Self {
            child: None,
            stdin: None,
            config: None,
        }
    }
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
    item.get("text")
        .and_then(Value::as_str)
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
}

fn build_provider_prompt(
    messages: &[Value],
    tools: &[Value],
    model: Option<&str>,
    max_tokens: u32,
    temperature: f32,
) -> String {
    let messages_text = serde_json::to_string_pretty(messages).unwrap_or_else(|_| "[]".to_string());
    let tools_text = serde_json::to_string_pretty(tools).unwrap_or_else(|_| "[]".to_string());
    let model_text = model.unwrap_or("default");
    format!(
        "You are OpenVibe's nanobot provider adapter.\n\
Given chat history and tool definitions, return exactly one JSON object.\n\
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
Messages:\n{messages_text}\n\n\
Tools:\n{tools_text}\n"
    )
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

async fn resolve_provider_model(app: &AppHandle, requested_model: Option<&str>) -> Option<String> {
    let preferred = {
        let state = app.state::<AppState>();
        let settings = state.app_settings.lock().await;
        settings
            .last_composer_model_id
            .as_ref()
            .map(|value| value.trim().to_string())
            .filter(|value| !value.is_empty())
    };
    if preferred.is_some() {
        return preferred;
    }
    requested_model
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToOwned::to_owned)
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

async fn run_provider_completion(
    app: &AppHandle,
    workspace_id: &str,
    prompt: String,
    model: Option<String>,
) -> Result<Value, String> {
    let state = app.state::<AppState>();
    if remote_backend::is_remote_mode(&*state).await {
        return Err("Provider bridge is unavailable in remote backend mode.".to_string());
    }

    let session = {
        let sessions = state.sessions.lock().await;
        sessions
            .get(workspace_id)
            .cloned()
            .ok_or_else(|| format!("workspace not connected: {workspace_id}"))?
    };

    let thread_result = session
        .send_request(
            "thread/start",
            json!({
                "cwd": session.entry.path.clone(),
                "approvalPolicy": "never",
            }),
        )
        .await?;
    if let Some(error) = extract_error_message(&thread_result) {
        return Err(error);
    }
    let provider_thread_id = extract_thread_id(&thread_result)
        .ok_or_else(|| "failed to create provider bridge thread".to_string())?;

    let (tx, mut rx) = mpsc::unbounded_channel::<Value>();
    {
        let mut callbacks = session.background_thread_callbacks.lock().await;
        callbacks.insert(provider_thread_id.clone(), tx);
    }

    let mut turn_params = Map::new();
    turn_params.insert("threadId".to_string(), json!(provider_thread_id.clone()));
    turn_params.insert(
        "input".to_string(),
        json!([{ "type": "text", "text": prompt }]),
    );
    turn_params.insert("cwd".to_string(), json!(session.entry.path.clone()));
    turn_params.insert("approvalPolicy".to_string(), json!("never"));
    turn_params.insert("sandboxPolicy".to_string(), json!({ "type": "readOnly" }));
    if let Some(model) = model {
        let trimmed = model.trim().to_string();
        if !trimmed.is_empty() {
            turn_params.insert("model".to_string(), json!(trimmed));
        }
    }

    let turn_result = session
        .send_request("turn/start", Value::Object(turn_params))
        .await;
    let turn_result = match turn_result {
        Ok(value) => value,
        Err(error) => {
            let mut callbacks = session.background_thread_callbacks.lock().await;
            callbacks.remove(&provider_thread_id);
            let _ = session
                .send_request(
                    "thread/archive",
                    json!({
                        "threadId": provider_thread_id.clone(),
                    }),
                )
                .await;
            return Err(error);
        }
    };
    if let Some(error) = extract_error_message(&turn_result) {
        let mut callbacks = session.background_thread_callbacks.lock().await;
        callbacks.remove(&provider_thread_id);
        let _ = session
            .send_request(
                "thread/archive",
                json!({
                    "threadId": provider_thread_id.clone(),
                }),
            )
            .await;
        return Err(error);
    }

    let collect_result = timeout(Duration::from_secs(120), async {
        let mut text = String::new();
        while let Some(event) = rx.recv().await {
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
    })
    .await;

    {
        let mut callbacks = session.background_thread_callbacks.lock().await;
        callbacks.remove(&provider_thread_id);
    }
    let _ = session
        .send_request(
            "thread/archive",
            json!({
                "threadId": provider_thread_id,
            }),
        )
        .await;

    let raw_text = match collect_result {
        Ok(Ok(text)) => text,
        Ok(Err(error)) => return Err(error),
        Err(_) => return Err("provider request timed out".to_string()),
    };
    Ok(normalize_provider_response(&raw_text))
}

async fn handle_provider_request(app: &AppHandle, payload: &Value) -> Result<(), String> {
    let request_id = normalize_required(payload.get("requestId"), "requestId")?;
    let workspace_id = normalize_required(payload.get("workspaceId"), "workspaceId")?;
    let messages = payload
        .get("messages")
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default();
    let tools = payload
        .get("tools")
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default();
    let requested_model = payload
        .get("model")
        .and_then(Value::as_str)
        .map(ToOwned::to_owned);
    let model = resolve_provider_model(app, requested_model.as_deref()).await;
    let max_tokens = payload
        .get("maxTokens")
        .and_then(Value::as_u64)
        .unwrap_or(4096) as u32;
    let temperature = payload
        .get("temperature")
        .and_then(Value::as_f64)
        .unwrap_or(0.7) as f32;

    let prompt =
        build_provider_prompt(&messages, &tools, model.as_deref(), max_tokens, temperature);
    let result = run_provider_completion(app, &workspace_id, prompt, model).await;
    match result {
        Ok(response) => {
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
    let mut guard = state.nanobot_bridge.lock().await;
    if guard.config.as_ref() == Some(&config) {
        return Ok(());
    }

    if let Some(mut child) = guard.child.take() {
        stop_child(&mut child).await;
    }
    guard.stdin = None;
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
