use std::path::PathBuf;
use std::process::Stdio;

use serde::Serialize;
use serde_json::{Value, json};
use tauri::{AppHandle, Emitter, State};
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::process::{Child, ChildStdin, ChildStdout, Command};

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
        self.enabled && self.mode.eq_ignore_ascii_case("bridge")
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
        spawn_stderr_reader(stderr);
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

    let line = serde_json::to_string(&command)
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
            if let Ok(payload) = serde_json::from_str::<serde_json::Value>(&line) {
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

fn spawn_stderr_reader(stderr: tokio::process::ChildStderr) {
    tokio::spawn(async move {
        let mut reader = BufReader::new(stderr).lines();
        while let Ok(Some(line)) = reader.next_line().await {
            if line.trim().is_empty() {
                continue;
            }
            eprintln!("[nanobot-bridge] {line}");
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
