use std::collections::HashMap;
use std::sync::Arc;
use std::time::{SystemTime, UNIX_EPOCH};

use nanobot::bus::{MessageBus, OutboundMessage};
use nanobot::channels::manager::ChannelManager;
use nanobot::config::{Config, load_config};
use serde::Deserialize;
use serde_json::{Value, json};
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::sync::mpsc;

const DAEMON_ARG: &str = "--nanobot-bridge-daemon";

#[derive(Clone, Debug)]
struct SessionRoute {
    workspace_id: String,
    thread_id: String,
    channel: String,
    chat_id: String,
}

#[derive(Default)]
struct RouteState {
    by_session_key: HashMap<String, SessionRoute>,
    session_key_by_thread: HashMap<String, String>,
    recent_outbound_by_session: HashMap<String, (String, i64)>,
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
    names
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
    let routes = Arc::new(tokio::sync::Mutex::new(RouteState::default()));

    let out_tx_for_inbound = out_tx.clone();
    let bus_for_inbound = bus.clone();
    let routes_for_inbound = routes.clone();
    let inbound_task = tokio::spawn(async move {
        while let Some(message) = bus_for_inbound.consume_inbound().await {
            let session_key = message.session_key();
            let mapped = {
                let guard = routes_for_inbound.lock().await;
                let drop_echo = guard
                    .recent_outbound_by_session
                    .get(&session_key)
                    .map(|(last_content, last_sent_at)| {
                        let recently_sent = unix_time_ms() - *last_sent_at <= 30_000;
                        recently_sent && *last_content == message.content
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
                    "content": message.content,
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

                let mut guard = routes.lock().await;
                if let Some(previous_session_key) =
                    guard
                        .session_key_by_thread
                        .insert(thread_id, session_key.clone())
                {
                    guard.by_session_key.remove(&previous_session_key);
                }
                guard.by_session_key.insert(session_key, route);
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

                let (session_key, route) = {
                    let guard = routes.lock().await;
                    let Some(session_key) = guard.session_key_by_thread.get(&thread_id) else {
                        continue;
                    };
                    let Some(route) = guard.by_session_key.get(session_key) else {
                        continue;
                    };
                    (session_key.clone(), route.clone())
                };

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
