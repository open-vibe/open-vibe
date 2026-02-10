use std::collections::HashMap;
use std::sync::Arc;
use std::time::{SystemTime, UNIX_EPOCH};

use anyhow::anyhow;
use async_trait::async_trait;
use nanobot::agent::AgentLoop;
use nanobot::bus::{MessageBus, OutboundMessage};
use nanobot::channels::manager::ChannelManager;
use nanobot::config::{Config, load_config};
use nanobot::providers::base::{LLMProvider, LLMResponse, ToolCallRequest};
use serde::Deserialize;
use serde_json::{Map, Value, json};
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::sync::{Mutex, mpsc, oneshot};
use tokio::time::{Duration, timeout};

const DAEMON_ARG: &str = "--nanobot-bridge-daemon";

tokio::task_local! {
    static ACTIVE_SESSION_KEY: String;
}

#[derive(Clone, Debug)]
struct SessionRoute {
    workspace_id: String,
    thread_id: String,
    channel: String,
    chat_id: String,
}

#[derive(Clone, Debug)]
enum SessionMode {
    Bridge,
    Agent,
}

#[derive(Default)]
struct RouteState {
    by_session_key: HashMap<String, SessionRoute>,
    session_key_by_thread: HashMap<String, String>,
    session_mode_by_session: HashMap<String, SessionMode>,
    recent_outbound_by_session: HashMap<String, (String, i64)>,
}

#[derive(Default)]
struct ProviderPendingState {
    next_id: u64,
    waiters: HashMap<String, oneshot::Sender<Result<LLMResponse, String>>>,
}

#[derive(Clone)]
struct OpenVibeProvider {
    out_tx: mpsc::UnboundedSender<String>,
    routes: Arc<Mutex<RouteState>>,
    pending: Arc<Mutex<ProviderPendingState>>,
    default_model: String,
}

impl OpenVibeProvider {
    fn new(
        out_tx: mpsc::UnboundedSender<String>,
        routes: Arc<Mutex<RouteState>>,
        pending: Arc<Mutex<ProviderPendingState>>,
        default_model: String,
    ) -> Self {
        Self {
            out_tx,
            routes,
            pending,
            default_model,
        }
    }
}

#[async_trait]
impl LLMProvider for OpenVibeProvider {
    async fn chat(
        &self,
        messages: &[Value],
        tools: Option<&[Value]>,
        model: Option<&str>,
        max_tokens: u32,
        temperature: f32,
    ) -> anyhow::Result<LLMResponse> {
        let session_key = ACTIVE_SESSION_KEY
            .try_with(|value| value.clone())
            .map_err(|_| anyhow!("missing active nanobot session context"))?;
        let route = {
            let guard = self.routes.lock().await;
            guard.by_session_key.get(&session_key).cloned()
        };
        let Some(route) = route else {
            return Err(anyhow!(
                "session route not bound for provider call: {}",
                session_key
            ));
        };

        let (request_id, rx) = {
            let mut guard = self.pending.lock().await;
            guard.next_id = guard.next_id.saturating_add(1);
            let request_id = format!("provider-{}", guard.next_id);
            let (tx, rx) = oneshot::channel::<Result<LLMResponse, String>>();
            guard.waiters.insert(request_id.clone(), tx);
            (request_id, rx)
        };

        emit_event(
            &self.out_tx,
            json!({
                "type": "provider-request",
                "requestId": request_id.clone(),
                "sessionKey": session_key,
                "workspaceId": route.workspace_id,
                "threadId": route.thread_id,
                "messages": messages,
                "tools": tools.unwrap_or_default(),
                "model": model,
                "maxTokens": max_tokens,
                "temperature": temperature,
            }),
        );

        let result = timeout(Duration::from_secs(180), rx).await;
        match result {
            Ok(Ok(Ok(response))) => Ok(response),
            Ok(Ok(Err(error))) => Err(anyhow!(error)),
            Ok(Err(_)) => Err(anyhow!("provider request canceled")),
            Err(_) => {
                let mut guard = self.pending.lock().await;
                guard.waiters.remove(&request_id);
                Err(anyhow!("provider request timed out"))
            }
        }
    }

    fn default_model(&self) -> &str {
        &self.default_model
    }
}

#[derive(Debug, Deserialize)]
#[serde(tag = "type", rename_all = "kebab-case")]
enum BridgeCommand {
    BindSession {
        #[serde(rename = "sessionKey")]
        session_key: String,
        channel: String,
        #[serde(rename = "chatId")]
        chat_id: String,
        #[serde(rename = "workspaceId")]
        workspace_id: String,
        #[serde(rename = "threadId")]
        thread_id: String,
    },
    DirectMessage {
        channel: String,
        #[serde(rename = "chatId")]
        chat_id: String,
        content: String,
    },
    SetSessionMode {
        #[serde(rename = "sessionKey")]
        session_key: String,
        mode: String,
    },
    AgentMessage {
        #[serde(rename = "sessionKey")]
        session_key: String,
        channel: String,
        #[serde(rename = "chatId")]
        chat_id: String,
        #[serde(rename = "workspaceId")]
        workspace_id: String,
        #[serde(rename = "threadId")]
        thread_id: String,
        content: String,
    },
    ProviderResponse {
        #[serde(rename = "requestId")]
        request_id: String,
        ok: bool,
        response: Option<Value>,
        error: Option<String>,
    },
    ThreadMessage {
        #[serde(rename = "messageId")]
        message_id: Option<String>,
        #[serde(rename = "threadId")]
        thread_id: String,
        role: String,
        content: String,
    },
}

fn panic_to_string(payload: Box<dyn std::any::Any + Send>) -> String {
    if let Some(text) = payload.downcast_ref::<&str>() {
        return (*text).to_string();
    }
    if let Some(text) = payload.downcast_ref::<String>() {
        return text.clone();
    }
    "unknown panic".to_string()
}

fn unix_time_ms() -> i64 {
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default();
    now.as_millis() as i64
}

fn load_nanobot_config_safe() -> Result<Config, String> {
    let result = std::panic::catch_unwind(|| load_config(None));
    match result {
        Ok(value) => value.map_err(|error| error.to_string()),
        Err(payload) => Err(format!(
            "nanobot config load panic: {}",
            panic_to_string(payload)
        )),
    }
}

fn normalize_required(value: String, field: &str) -> Result<String, String> {
    let trimmed = value.trim().to_string();
    if trimmed.is_empty() {
        return Err(format!("missing field: {field}"));
    }
    Ok(trimmed)
}

fn parse_session_mode(value: &str) -> SessionMode {
    if value.trim().eq_ignore_ascii_case("agent") {
        SessionMode::Agent
    } else {
        SessionMode::Bridge
    }
}

fn emit_event(tx: &mpsc::UnboundedSender<String>, payload: Value) {
    if let Ok(line) = serde_json::to_string(&payload) {
        let _ = tx.send(line);
    }
}

fn emit_status(tx: &mpsc::UnboundedSender<String>, connected: bool, reason: Option<String>) {
    emit_event(
        tx,
        json!({
            "type": "status",
            "connected": connected,
            "reason": reason,
        }),
    );
}

fn emit_message_sync(
    tx: &mpsc::UnboundedSender<String>,
    message_id: String,
    thread_id: String,
    status: &str,
    reason: Option<String>,
) {
    emit_event(
        tx,
        json!({
            "type": "message-sync",
            "messageId": message_id,
            "threadId": thread_id,
            "status": status,
            "reason": reason,
        }),
    );
}

fn enabled_channel_names(config: &Config) -> Vec<&'static str> {
    let mut names = Vec::new();
    if config.channels.telegram.enabled {
        names.push("telegram");
    }
    if config.channels.whatsapp.enabled {
        names.push("whatsapp");
    }
    if config.channels.discord.enabled {
        names.push("discord");
    }
    if config.channels.feishu.enabled {
        names.push("feishu");
    }
    if config.channels.dingtalk.enabled {
        names.push("dingtalk");
    }
    if config.channels.email.enabled {
        names.push("email");
    }
    if config.channels.slack.enabled {
        names.push("slack");
    }
    if config.channels.qq.enabled {
        names.push("qq");
    }
    names
}

fn parse_provider_response(value: Value) -> Result<LLMResponse, String> {
    let content = value
        .get("content")
        .and_then(Value::as_str)
        .map(ToOwned::to_owned)
        .or_else(|| {
            value
                .get("content")
                .filter(|v| v.is_null())
                .map(|_| String::new())
        })
        .and_then(|text| if text.is_empty() { None } else { Some(text) });
    let finish_reason = value
        .get("finish_reason")
        .or_else(|| value.get("finishReason"))
        .and_then(Value::as_str)
        .unwrap_or("stop")
        .to_string();
    let reasoning_content = value
        .get("reasoning_content")
        .or_else(|| value.get("reasoningContent"))
        .and_then(Value::as_str)
        .map(ToOwned::to_owned);
    let usage = value
        .get("usage")
        .and_then(Value::as_object)
        .cloned()
        .unwrap_or_default();
    let tool_calls_value = value
        .get("tool_calls")
        .or_else(|| value.get("toolCalls"))
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default();
    let mut tool_calls = Vec::new();
    for entry in tool_calls_value {
        let Some(obj) = entry.as_object() else {
            continue;
        };
        let id = obj
            .get("id")
            .and_then(Value::as_str)
            .unwrap_or("")
            .trim()
            .to_string();
        let name = obj
            .get("name")
            .and_then(Value::as_str)
            .unwrap_or("")
            .trim()
            .to_string();
        if id.is_empty() || name.is_empty() {
            continue;
        }
        let arguments = obj
            .get("arguments")
            .and_then(Value::as_object)
            .cloned()
            .unwrap_or_else(Map::new);
        tool_calls.push(ToolCallRequest {
            id,
            name,
            arguments,
        });
    }
    Ok(LLMResponse {
        content,
        tool_calls,
        finish_reason,
        usage,
        reasoning_content,
    })
}

fn spawn_agent_turn(
    session_key: String,
    workspace_id: String,
    thread_id: String,
    channel: String,
    chat_id: String,
    content: String,
    bus: Arc<MessageBus>,
    routes: Arc<Mutex<RouteState>>,
    out_tx: mpsc::UnboundedSender<String>,
    agent: Arc<AgentLoop>,
) {
    emit_event(
        &out_tx,
        json!({
            "type": "agent-trace",
            "sessionKey": session_key,
            "workspaceId": workspace_id,
            "threadId": thread_id,
            "role": "user",
            "content": content,
            "createdAt": unix_time_ms(),
        }),
    );

    tokio::spawn(async move {
        let response = ACTIVE_SESSION_KEY
            .scope(session_key.clone(), async {
                agent
                    .process_direct(
                        &content,
                        Some(&session_key),
                        Some(&channel),
                        Some(&chat_id),
                    )
                    .await
            })
            .await;

        match response {
            Ok(answer) => {
                emit_event(
                    &out_tx,
                    json!({
                        "type": "agent-trace",
                        "sessionKey": session_key,
                        "workspaceId": workspace_id,
                        "threadId": thread_id,
                        "role": "assistant",
                        "content": answer.clone(),
                        "createdAt": unix_time_ms(),
                    }),
                );
                if let Err(error) = bus
                    .publish_outbound(OutboundMessage::new(
                        channel.clone(),
                        chat_id.clone(),
                        answer.clone(),
                    ))
                    .await
                {
                    eprintln!("[nanobot-bridge-daemon] agent outbound failed: {error}");
                } else {
                    let mut guard = routes.lock().await;
                    guard
                        .recent_outbound_by_session
                        .insert(session_key, (answer, unix_time_ms()));
                }
            }
            Err(error) => {
                let message = format!("Agent mode failed: {error}");
                let _ = bus
                    .publish_outbound(OutboundMessage::new(
                        channel.clone(),
                        chat_id.clone(),
                        message.clone(),
                    ))
                    .await;
                emit_event(
                    &out_tx,
                    json!({
                        "type": "agent-trace",
                        "sessionKey": session_key,
                        "workspaceId": workspace_id,
                        "threadId": thread_id,
                        "role": "assistant",
                        "content": message,
                        "createdAt": unix_time_ms(),
                    }),
                );
            }
        }
    });
}

async fn run_daemon() -> Result<(), String> {
    let config = load_nanobot_config_safe()?;
    let enabled_channels = enabled_channel_names(&config);

    let (out_tx, mut out_rx) = mpsc::unbounded_channel::<String>();
    let writer_task = tokio::spawn(async move {
        let mut out = tokio::io::stdout();
        while let Some(line) = out_rx.recv().await {
            if out.write_all(line.as_bytes()).await.is_err() {
                break;
            }
            if out.write_all(b"\n").await.is_err() {
                break;
            }
            if out.flush().await.is_err() {
                break;
            }
        }
    });

    if enabled_channels.is_empty() {
        emit_status(
            &out_tx,
            false,
            Some("No enabled nanobot channels in ~/.nanobot/config.json".to_string()),
        );
        drop(out_tx);
        let _ = writer_task.await;
        return Ok(());
    }

    let bus = Arc::new(MessageBus::new(256));
    let manager = Arc::new(ChannelManager::new(&config, bus.clone(), None));
    let routes = Arc::new(Mutex::new(RouteState::default()));
    let provider_pending = Arc::new(Mutex::new(ProviderPendingState::default()));
    let provider = Arc::new(OpenVibeProvider::new(
        out_tx.clone(),
        routes.clone(),
        provider_pending.clone(),
        config.agents.defaults.model.clone(),
    ));
    let agent = Arc::new(
        AgentLoop::new(
            bus.clone(),
            provider,
            config.workspace_path(),
            Some(config.agents.defaults.model.clone()),
            config.agents.defaults.max_tool_iterations,
            if config.tools.web.search.api_key.is_empty() {
                None
            } else {
                Some(config.tools.web.search.api_key.clone())
            },
            config.tools.exec.timeout,
            config.tools.restrict_to_workspace,
            None,
            None,
        )
        .map_err(|error| error.to_string())?,
    );

    let out_tx_for_inbound = out_tx.clone();
    let bus_for_inbound = bus.clone();
    let routes_for_inbound = routes.clone();
    let inbound_task = tokio::spawn(async move {
        while let Some(message) = bus_for_inbound.consume_inbound().await {
            let session_key = message.session_key();
            let content = message.content.clone();
            let mapped = {
                let guard = routes_for_inbound.lock().await;
                let drop_echo = guard
                    .recent_outbound_by_session
                    .get(&session_key)
                    .map(|(last_content, last_sent_at)| {
                        let recently_sent = unix_time_ms() - *last_sent_at <= 30_000;
                        recently_sent && *last_content == content
                    })
                    .unwrap_or(false);
                if drop_echo {
                    continue;
                }
                guard.by_session_key.get(&session_key).cloned()
            };

            emit_event(
                &out_tx_for_inbound,
                json!({
                    "type": "remote-message",
                    "channel": message.channel,
                    "chatId": message.chat_id,
                    "senderId": message.sender_id,
                    "sessionKey": session_key,
                    "content": content,
                    "createdAt": message.timestamp.timestamp_millis(),
                    "workspaceId": mapped.as_ref().map(|route| route.workspace_id.clone()),
                    "threadId": mapped.as_ref().map(|route| route.thread_id.clone()),
                }),
            );
        }
    });

    let manager_for_task = manager.clone();
    let manager_task = tokio::spawn(async move {
        manager_for_task.start_all().await;
    });

    emit_status(&out_tx, true, None);

    let mut input_lines = BufReader::new(tokio::io::stdin()).lines();
    while let Ok(Some(line)) = input_lines.next_line().await {
        let trimmed = line.trim();
        if trimmed.is_empty() {
            continue;
        }
        let command = match serde_json::from_str::<BridgeCommand>(trimmed) {
            Ok(command) => command,
            Err(error) => {
                eprintln!("[nanobot-bridge-daemon] invalid command: {error}");
                continue;
            }
        };

        match command {
            BridgeCommand::BindSession {
                session_key,
                channel,
                chat_id,
                workspace_id,
                thread_id,
            } => {
                let session_key = match normalize_required(session_key, "sessionKey") {
                    Ok(value) => value,
                    Err(error) => {
                        eprintln!("[nanobot-bridge-daemon] {error}");
                        continue;
                    }
                };
                let channel = match normalize_required(channel, "channel") {
                    Ok(value) => value,
                    Err(error) => {
                        eprintln!("[nanobot-bridge-daemon] {error}");
                        continue;
                    }
                };
                let chat_id = match normalize_required(chat_id, "chatId") {
                    Ok(value) => value,
                    Err(error) => {
                        eprintln!("[nanobot-bridge-daemon] {error}");
                        continue;
                    }
                };
                let workspace_id = match normalize_required(workspace_id, "workspaceId") {
                    Ok(value) => value,
                    Err(error) => {
                        eprintln!("[nanobot-bridge-daemon] {error}");
                        continue;
                    }
                };
                let thread_id = match normalize_required(thread_id, "threadId") {
                    Ok(value) => value,
                    Err(error) => {
                        eprintln!("[nanobot-bridge-daemon] {error}");
                        continue;
                    }
                };

                let route = SessionRoute {
                    workspace_id,
                    thread_id: thread_id.clone(),
                    channel,
                    chat_id,
                };
                let session_key_for_mode = session_key.clone();
                let mut guard = routes.lock().await;
                if let Some(previous_session_key) =
                    guard
                        .session_key_by_thread
                        .insert(thread_id, session_key.clone())
                {
                    guard.by_session_key.remove(&previous_session_key);
                    guard.session_mode_by_session.remove(&previous_session_key);
                    guard.recent_outbound_by_session.remove(&previous_session_key);
                }
                guard.by_session_key.insert(session_key, route);
                guard
                    .session_mode_by_session
                    .entry(session_key_for_mode)
                    .or_insert(SessionMode::Bridge);
            }
            BridgeCommand::DirectMessage {
                channel,
                chat_id,
                content,
            } => {
                let channel = match normalize_required(channel, "channel") {
                    Ok(value) => value,
                    Err(error) => {
                        eprintln!("[nanobot-bridge-daemon] {error}");
                        continue;
                    }
                };
                let chat_id = match normalize_required(chat_id, "chatId") {
                    Ok(value) => value,
                    Err(error) => {
                        eprintln!("[nanobot-bridge-daemon] {error}");
                        continue;
                    }
                };
                let content = match normalize_required(content, "content") {
                    Ok(value) => value,
                    Err(error) => {
                        eprintln!("[nanobot-bridge-daemon] {error}");
                        continue;
                    }
                };
                let outbound = OutboundMessage::new(channel, chat_id, content);
                if let Err(error) = bus.publish_outbound(outbound).await {
                    eprintln!("[nanobot-bridge-daemon] direct message send failed: {error}");
                }
            }
            BridgeCommand::SetSessionMode { session_key, mode } => {
                let session_key = match normalize_required(session_key, "sessionKey") {
                    Ok(value) => value,
                    Err(error) => {
                        eprintln!("[nanobot-bridge-daemon] {error}");
                        continue;
                    }
                };
                let parsed_mode = parse_session_mode(&mode);
                let mut guard = routes.lock().await;
                guard.session_mode_by_session.insert(session_key, parsed_mode);
            }
            BridgeCommand::AgentMessage {
                session_key,
                channel,
                chat_id,
                workspace_id,
                thread_id,
                content,
            } => {
                let session_key = match normalize_required(session_key, "sessionKey") {
                    Ok(value) => value,
                    Err(error) => {
                        eprintln!("[nanobot-bridge-daemon] {error}");
                        continue;
                    }
                };
                let channel = match normalize_required(channel, "channel") {
                    Ok(value) => value,
                    Err(error) => {
                        eprintln!("[nanobot-bridge-daemon] {error}");
                        continue;
                    }
                };
                let chat_id = match normalize_required(chat_id, "chatId") {
                    Ok(value) => value,
                    Err(error) => {
                        eprintln!("[nanobot-bridge-daemon] {error}");
                        continue;
                    }
                };
                let workspace_id = match normalize_required(workspace_id, "workspaceId") {
                    Ok(value) => value,
                    Err(error) => {
                        eprintln!("[nanobot-bridge-daemon] {error}");
                        continue;
                    }
                };
                let thread_id = match normalize_required(thread_id, "threadId") {
                    Ok(value) => value,
                    Err(error) => {
                        eprintln!("[nanobot-bridge-daemon] {error}");
                        continue;
                    }
                };
                let content = match normalize_required(content, "content") {
                    Ok(value) => value,
                    Err(error) => {
                        eprintln!("[nanobot-bridge-daemon] {error}");
                        continue;
                    }
                };

                let is_agent_mode = {
                    let guard = routes.lock().await;
                    matches!(
                        guard.session_mode_by_session.get(&session_key),
                        Some(SessionMode::Agent)
                    )
                };
                if !is_agent_mode {
                    continue;
                }
                spawn_agent_turn(
                    session_key,
                    workspace_id,
                    thread_id,
                    channel,
                    chat_id,
                    content,
                    bus.clone(),
                    routes.clone(),
                    out_tx.clone(),
                    agent.clone(),
                );
            }
            BridgeCommand::ProviderResponse {
                request_id,
                ok,
                response,
                error,
            } => {
                let request_id = match normalize_required(request_id, "requestId") {
                    Ok(value) => value,
                    Err(err) => {
                        eprintln!("[nanobot-bridge-daemon] {err}");
                        continue;
                    }
                };
                let waiter = {
                    let mut guard = provider_pending.lock().await;
                    guard.waiters.remove(&request_id)
                };
                if let Some(waiter) = waiter {
                    let result = if ok {
                        let payload = response.unwrap_or_else(|| json!({}));
                        parse_provider_response(payload)
                    } else {
                        Err(error.unwrap_or_else(|| "provider request failed".to_string()))
                    };
                    let _ = waiter.send(result);
                }
            }
            BridgeCommand::ThreadMessage {
                message_id,
                thread_id,
                role,
                content,
            } => {
                if role != "assistant" {
                    continue;
                }
                let thread_id = match normalize_required(thread_id, "threadId") {
                    Ok(value) => value,
                    Err(error) => {
                        eprintln!("[nanobot-bridge-daemon] {error}");
                        continue;
                    }
                };
                let content = match normalize_required(content, "content") {
                    Ok(value) => value,
                    Err(error) => {
                        if let Some(message_id) = message_id {
                            emit_message_sync(
                                &out_tx,
                                message_id,
                                thread_id,
                                "failed",
                                Some(error),
                            );
                        }
                        continue;
                    }
                };

                let (session_key, route, is_agent_mode) = {
                    let guard = routes.lock().await;
                    let Some(session_key) = guard.session_key_by_thread.get(&thread_id) else {
                        continue;
                    };
                    let Some(route) = guard.by_session_key.get(session_key) else {
                        continue;
                    };
                    let is_agent_mode = matches!(
                        guard.session_mode_by_session.get(session_key),
                        Some(SessionMode::Agent)
                    );
                    (session_key.clone(), route.clone(), is_agent_mode)
                };
                if is_agent_mode {
                    continue;
                }

                let outbound = OutboundMessage::new(route.channel, route.chat_id, content.clone());
                match bus.publish_outbound(outbound).await {
                    Ok(()) => {
                        let mut guard = routes.lock().await;
                        guard
                            .recent_outbound_by_session
                            .insert(session_key, (content, unix_time_ms()));
                        if let Some(message_id) = message_id {
                            emit_message_sync(&out_tx, message_id, thread_id, "success", None);
                        }
                    }
                    Err(error) => {
                        if let Some(message_id) = message_id {
                            emit_message_sync(
                                &out_tx,
                                message_id,
                                thread_id,
                                "failed",
                                Some(error.to_string()),
                            );
                        }
                    }
                }
            }
        }
    }

    manager.stop_all().await;
    inbound_task.abort();
    let _ = inbound_task.await;
    let _ = manager_task.await;

    emit_status(&out_tx, false, Some("daemon stopped".to_string()));
    drop(out_tx);
    let _ = writer_task.await;

    Ok(())
}

pub(crate) fn run_if_requested() -> bool {
    if !std::env::args().skip(1).any(|arg| arg == DAEMON_ARG) {
        return false;
    }

    let runtime = tokio::runtime::Builder::new_multi_thread()
        .enable_all()
        .build()
        .expect("failed to create tokio runtime for nanobot bridge daemon");

    if let Err(error) = runtime.block_on(run_daemon()) {
        eprintln!("[nanobot-bridge-daemon] {error}");
        std::process::exit(1);
    }

    true
}
