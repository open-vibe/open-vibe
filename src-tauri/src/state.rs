use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Arc;
use tauri::{AppHandle, Manager};
use tokio::sync::{Mutex, OnceCell};

use crate::dictation::DictationState;
use crate::happy_bridge::HappyBridgeState;
use crate::nanobot_bridge::NanobotBridgeState;
use crate::storage::{read_settings, read_workspaces};
use crate::types::{AppSettings, WorkspaceEntry};

pub(crate) struct AppState {
    pub(crate) workspaces: Mutex<HashMap<String, WorkspaceEntry>>,
    pub(crate) sessions: Mutex<HashMap<String, Arc<crate::codex::WorkspaceSession>>>,
    pub(crate) global_session: OnceCell<Arc<crate::codex::WorkspaceSession>>,
    pub(crate) terminal_sessions:
        Mutex<HashMap<String, Arc<crate::terminal::TerminalSession>>>,
    pub(crate) remote_backend: Mutex<Option<crate::remote_backend::RemoteBackend>>,
    pub(crate) history_streams:
        Mutex<HashMap<String, crate::codex::HistoryStreamState>>,
    pub(crate) storage_path: PathBuf,
    pub(crate) settings_path: PathBuf,
    pub(crate) app_settings: Mutex<AppSettings>,
    pub(crate) dictation: Mutex<DictationState>,
    pub(crate) happy_bridge: Mutex<HappyBridgeState>,
    pub(crate) nanobot_bridge: Mutex<NanobotBridgeState>,
}

impl AppState {
    pub(crate) fn load(app: &AppHandle) -> Self {
        let data_dir = app
            .path()
            .app_data_dir()
            .unwrap_or_else(|_| std::env::current_dir().unwrap_or_else(|_| ".".into()));
        let storage_path = data_dir.join("workspaces.json");
        let settings_path = data_dir.join("settings.json");
        let workspaces = read_workspaces(&storage_path).unwrap_or_default();
        let app_settings = read_settings(&settings_path).unwrap_or_default();
        Self {
            workspaces: Mutex::new(workspaces),
            sessions: Mutex::new(HashMap::new()),
            global_session: OnceCell::new(),
            terminal_sessions: Mutex::new(HashMap::new()),
            remote_backend: Mutex::new(None),
            history_streams: Mutex::new(HashMap::new()),
            storage_path,
            settings_path,
            app_settings: Mutex::new(app_settings),
            dictation: Mutex::new(DictationState::default()),
            happy_bridge: Mutex::new(HappyBridgeState::default()),
            nanobot_bridge: Mutex::new(NanobotBridgeState::default()),
        }
    }
}
