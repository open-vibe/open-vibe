use tauri::{Manager, State, Window};

use crate::codex_config;
use crate::happy_bridge;
use crate::menu;
use crate::nanobot_bridge;
use crate::nanobot_integration;
use crate::state::AppState;
use crate::storage::write_settings;
use crate::types::AppSettings;
use crate::window;

#[tauri::command]
pub(crate) async fn get_app_settings(
    state: State<'_, AppState>,
    window: Window,
) -> Result<AppSettings, String> {
    let mut settings = state.app_settings.lock().await.clone();
    if let Err(error) = nanobot_integration::hydrate_settings_from_nanobot(&mut settings) {
        eprintln!("nanobot settings hydrate failed: {error}");
    }
    if let Ok(Some(collab_enabled)) = codex_config::read_collab_enabled() {
        settings.experimental_collab_enabled = collab_enabled;
    }
    if let Ok(Some(collaboration_modes_enabled)) = codex_config::read_collaboration_modes_enabled()
    {
        settings.experimental_collaboration_modes_enabled = collaboration_modes_enabled;
    }
    if let Ok(Some(steer_enabled)) = codex_config::read_steer_enabled() {
        settings.experimental_steer_enabled = steer_enabled;
    }
    if let Ok(Some(unified_exec_enabled)) = codex_config::read_unified_exec_enabled() {
        settings.experimental_unified_exec_enabled = unified_exec_enabled;
    }
    let _ = window::apply_window_appearance(&window, settings.theme.as_str());
    let app_handle = window.app_handle();
    if let Err(error) = menu::apply_menu_language(&app_handle, settings.language.as_str()) {
        eprintln!("menu language apply failed: {error}");
    }
    Ok(settings)
}

#[tauri::command]
pub(crate) async fn update_app_settings(
    settings: AppSettings,
    state: State<'_, AppState>,
    window: Window,
) -> Result<AppSettings, String> {
    let previous_settings = state.app_settings.lock().await.clone();
    let theme_changed = previous_settings.theme != settings.theme;
    let language_changed = previous_settings.language != settings.language;
    let _ = codex_config::write_collab_enabled(settings.experimental_collab_enabled);
    let _ = codex_config::write_collaboration_modes_enabled(
        settings.experimental_collaboration_modes_enabled,
    );
    let _ = codex_config::write_steer_enabled(settings.experimental_steer_enabled);
    let _ = codex_config::write_unified_exec_enabled(settings.experimental_unified_exec_enabled);
    if let Err(error) = nanobot_integration::apply_settings_to_nanobot(&settings) {
        eprintln!("nanobot settings sync failed: {error}");
    }
    write_settings(&state.settings_path, &settings)?;
    let mut current = state.app_settings.lock().await;
    *current = settings.clone();
    if theme_changed {
        let _ = window::apply_window_appearance(&window, settings.theme.as_str());
    }
    let app_handle = window.app_handle();
    let _ = happy_bridge::apply_settings(&app_handle, &state, &settings).await;
    let _ = nanobot_bridge::apply_settings(&app_handle, &state, &settings).await;
    if language_changed {
        if let Err(error) = menu::apply_menu_language(&app_handle, settings.language.as_str()) {
            eprintln!("menu language apply failed: {error}");
        }
    }
    Ok(settings)
}

#[tauri::command]
pub(crate) async fn get_codex_config_path() -> Result<String, String> {
    codex_config::config_toml_path()
        .ok_or_else(|| "Unable to resolve CODEX_HOME".to_string())
        .and_then(|path| {
            path.to_str()
                .map(|value| value.to_string())
                .ok_or_else(|| "Unable to resolve CODEX_HOME".to_string())
        })
}
