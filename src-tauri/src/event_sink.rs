use std::sync::atomic::{AtomicBool, Ordering};
use tauri::{AppHandle, Emitter, Manager};

use crate::backend::events::{AppServerEvent, EventSink, TerminalOutput};

#[derive(Clone)]
pub(crate) struct TauriEventSink {
    app: AppHandle,
}

impl TauriEventSink {
    pub(crate) fn new(app: AppHandle) -> Self {
        Self { app }
    }
}

impl EventSink for TauriEventSink {
    fn emit_app_server_event(&self, event: AppServerEvent) {
        static APP_SERVER_EMITTED: AtomicBool = AtomicBool::new(false);
        if let Some(window) = self.app.get_webview_window("main") {
            match window.emit("app-server-event", event) {
                Ok(_) => {
                    if !APP_SERVER_EMITTED.swap(true, Ordering::SeqCst) {
                        eprintln!("[event] app-server-event emitted");
                    }
                }
                Err(err) => {
                    eprintln!("[event] emit app-server-event failed: {err}");
                }
            }
            return;
        }
        match self.app.emit("app-server-event", event) {
            Ok(_) => {
                if !APP_SERVER_EMITTED.swap(true, Ordering::SeqCst) {
                    eprintln!("[event] app-server-event emitted");
                }
            }
            Err(err) => {
                eprintln!("[event] emit app-server-event failed: {err}");
            }
        }
    }

    fn emit_terminal_output(&self, event: TerminalOutput) {
        if let Some(window) = self.app.get_webview_window("main") {
            let _ = window.emit("terminal-output", event);
            return;
        }
        let _ = self.app.emit("terminal-output", event);
    }
}
