use std::path::PathBuf;
use std::process::Stdio;

use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager, State};
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::process::{Child, ChildStdin, ChildStdout, Command};

use crate::state::AppState;
use crate::types::AppSettings;

#[derive(Clone, Debug, PartialEq, Eq)]
struct HappyBridgeConfig {
    enabled: bool,
    server_url: String,
    token: Option<String>,
    secret: Option<String>,
}

impl HappyBridgeConfig {
    fn from_settings(settings: &AppSettings) -> Self {
        Self {
            enabled: settings.happy_enabled,
            server_url: settings.happy_server_url.trim().to_string(),
            token: settings
                .happy_token
                .as_ref()
                .map(|value| value.trim().to_string()),
            secret: settings
                .happy_secret
                .as_ref()
                .map(|value| value.trim().to_string()),
        }
    }

    fn should_run(&self) -> bool {
        self.enabled
    }
}

pub(crate) struct HappyBridgeState {
    child: Option<Child>,
    stdin: Option<ChildStdin>,
    config: Option<HappyBridgeConfig>,
}

impl Default for HappyBridgeState {
    fn default() -> Self {
        Self {
            child: None,
            stdin: None,
            config: None,
        }
    }
}

#[derive(Debug, Serialize)]
pub(crate) struct HappyBridgeStatus {
    pub(crate) running: bool,
    pub(crate) pid: Option<u32>,
    pub(crate) configured: bool,
}

#[tauri::command]
pub(crate) async fn happy_bridge_status(
    state: State<'_, AppState>,
) -> Result<HappyBridgeStatus, String> {
    let guard = state.happy_bridge.lock().await;
    Ok(HappyBridgeStatus {
        running: guard.child.is_some(),
        pid: guard.child.as_ref().and_then(|child| child.id()),
        configured: guard.config.is_some(),
    })
}

pub(crate) async fn apply_settings(
    app: &AppHandle,
    state: &AppState,
    settings: &AppSettings,
) -> Result<(), String> {
    let config = HappyBridgeConfig::from_settings(settings);
    let mut guard = state.happy_bridge.lock().await;
    if guard.config.as_ref() == Some(&config) {
        return Ok(());
    }

    if let Some(mut child) = guard.child.take() {
        stop_child(&mut child).await;
    }
    guard.stdin = None;

    guard.config = Some(config.clone());

    if !config.should_run() {
        return Ok(());
    }

    let script = resolve_bridge_script(app)?;
    let mut command = Command::new("node");
    crate::utils::apply_background_command_flags_tokio(&mut command);
    command.arg(script);
    command.env("HAPPY_BRIDGE_SERVER_URL", &config.server_url);
    command.env(
        "HAPPY_BRIDGE_ENABLED",
        if config.enabled { "1" } else { "0" },
    );
    if let Some(token) = config.token.as_ref() {
        command.env("HAPPY_BRIDGE_TOKEN", token);
    }
    if let Some(secret) = config.secret.as_ref() {
        command.env("HAPPY_BRIDGE_SECRET", secret);
    }
    if let Ok(data_dir) = app.path().app_data_dir() {
        command.env("OPENVIBE_DATA_DIR", data_dir);
    }
    command.stdin(Stdio::piped());
    command.stdout(Stdio::piped());
    command.stderr(Stdio::piped());
    command.kill_on_drop(true);

    let mut child = command
        .spawn()
        .map_err(|err| format!("Failed to start happy bridge: {err}"))?;
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
    let mut guard = state.happy_bridge.lock().await;
    if let Some(mut child) = guard.child.take() {
        stop_child(&mut child).await;
    }
    guard.stdin = None;
    guard.config = None;
}

#[tauri::command]
pub(crate) async fn happy_bridge_send(
    command: serde_json::Value,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let mut guard = state.happy_bridge.lock().await;
    let Some(stdin) = guard.stdin.as_mut() else {
        return Err("Happy bridge is not running".to_string());
    };
    let line = serde_json::to_string(&command)
        .map_err(|err| format!("Failed to serialize happy bridge command: {err}"))?;
    stdin
        .write_all(line.as_bytes())
        .await
        .map_err(|err| format!("Failed to send happy bridge command: {err}"))?;
    stdin
        .write_all(b"\n")
        .await
        .map_err(|err| format!("Failed to flush happy bridge command: {err}"))?;
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
                let _ = app.emit("happy-bridge-event", payload);
            } else {
                println!("[happy-bridge] {line}");
            }
        }
    });
}

fn spawn_stderr_reader(stderr: tokio::process::ChildStderr) {
    tokio::spawn(async move {
        let mut reader = BufReader::new(stderr).lines();
        while let Ok(Some(line)) = reader.next_line().await {
            if line.trim().is_empty() {
                continue;
            }
            eprintln!("[happy-bridge] {line}");
        }
    });
}

fn resolve_bridge_script(app: &AppHandle) -> Result<PathBuf, String> {
    if let Ok(override_path) = std::env::var("OPENVIBE_HAPPY_BRIDGE_PATH") {
        let path = PathBuf::from(override_path);
        if path.exists() {
            return Ok(path);
        }
        return Err(format!(
            "Happy bridge script not found at {}",
            path.display()
        ));
    }

    let mut path = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    path.pop();
    path.push("bridge");
    path.push("happy-bridge.js");
    if path.exists() {
        return Ok(path);
    }

    if let Ok(resource_dir) = app.path().resource_dir() {
        let resource_path = resource_dir.join("happy-bridge.js");
        if resource_path.exists() {
            return Ok(resource_path);
        }
    }

    Err("Happy bridge script not found. Set OPENVIBE_HAPPY_BRIDGE_PATH.".to_string())
}
