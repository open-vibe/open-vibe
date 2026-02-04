use std::path::PathBuf;

use serde_json::json;
use tauri::{AppHandle, State};

use crate::codex_home;
use crate::file_io::TextFileResponse;
use crate::file_ops::{read_with_policy, write_with_policy};
use crate::file_policy::{policy_for, FileKind, FileScope};
use crate::remote_backend;
use crate::state::AppState;

fn resolve_default_codex_home() -> Result<PathBuf, String> {
    codex_home::resolve_default_codex_home()
        .ok_or_else(|| "Unable to resolve CODEX_HOME".to_string())
}

async fn resolve_workspace_root(workspace_id: &str, state: &AppState) -> Result<PathBuf, String> {
    let workspaces = state.workspaces.lock().await;
    let entry = workspaces
        .get(workspace_id)
        .ok_or_else(|| "workspace not found".to_string())?;
    Ok(PathBuf::from(&entry.path))
}

async fn resolve_root(
    scope: FileScope,
    workspace_id: Option<&str>,
    state: &AppState,
) -> Result<PathBuf, String> {
    match scope {
        FileScope::Global => resolve_default_codex_home(),
        FileScope::Workspace => {
            let workspace_id = workspace_id.ok_or_else(|| "workspaceId is required".to_string())?;
            resolve_workspace_root(workspace_id, state).await
        }
    }
}

async fn file_read_impl(
    scope: FileScope,
    kind: FileKind,
    workspace_id: Option<String>,
    state: &AppState,
    app: &AppHandle,
) -> Result<TextFileResponse, String> {
    if remote_backend::is_remote_mode(state).await {
        let response = remote_backend::call_remote(
            state,
            app.clone(),
            "file_read",
            json!({ "scope": scope, "kind": kind, "workspaceId": workspace_id }),
        )
        .await?;
        return serde_json::from_value(response).map_err(|err| err.to_string());
    }

    let policy = policy_for(scope, kind)?;
    let root = resolve_root(scope, workspace_id.as_deref(), state).await?;
    read_with_policy(&root, policy)
}

async fn file_write_impl(
    scope: FileScope,
    kind: FileKind,
    workspace_id: Option<String>,
    content: String,
    state: &AppState,
    app: &AppHandle,
) -> Result<(), String> {
    if remote_backend::is_remote_mode(state).await {
        remote_backend::call_remote(
            state,
            app.clone(),
            "file_write",
            json!({
                "scope": scope,
                "kind": kind,
                "workspaceId": workspace_id,
                "content": content,
            }),
        )
        .await?;
        return Ok(());
    }

    let policy = policy_for(scope, kind)?;
    let root = resolve_root(scope, workspace_id.as_deref(), state).await?;
    write_with_policy(&root, policy, &content)
}

#[tauri::command]
pub(crate) async fn file_read(
    scope: FileScope,
    kind: FileKind,
    workspace_id: Option<String>,
    state: State<'_, AppState>,
    app: AppHandle,
) -> Result<TextFileResponse, String> {
    file_read_impl(scope, kind, workspace_id, &*state, &app).await
}

#[tauri::command]
pub(crate) async fn file_write(
    scope: FileScope,
    kind: FileKind,
    workspace_id: Option<String>,
    content: String,
    state: State<'_, AppState>,
    app: AppHandle,
) -> Result<(), String> {
    file_write_impl(scope, kind, workspace_id, content, &*state, &app).await
}
