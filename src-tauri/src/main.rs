// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    if codex_monitor_lib::run_nanobot_bridge_daemon_from_args() {
        return;
    }
    if let Err(err) = fix_path_env::fix() {
        eprintln!("Failed to sync PATH from shell: {err}");
    }
    codex_monitor_lib::run()
}
