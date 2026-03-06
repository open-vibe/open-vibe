use serde::{Deserialize, Serialize};
use serde_json::json;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct MoltisTelegramMenuSyncResult {
    pub(crate) ok: bool,
    pub(crate) command_count: usize,
    pub(crate) description: String,
}

#[derive(Debug, Deserialize)]
struct TelegramSetMyCommandsResponse {
    ok: bool,
    #[serde(default)]
    description: Option<String>,
}

fn build_telegram_commands() -> Vec<serde_json::Value> {
    vec![
        json!({"command":"new","description":"Start a new session"}),
        json!({"command":"sessions","description":"List and switch sessions"}),
        json!({"command":"model","description":"Switch provider/model"}),
        json!({"command":"sandbox","description":"Toggle sandbox and choose image"}),
        json!({"command":"sh","description":"Enable command mode"}),
        json!({"command":"clear","description":"Clear session history"}),
        json!({"command":"compact","description":"Compact session context"}),
        json!({"command":"context","description":"Show session context info"}),
        json!({"command":"help","description":"Show Moltis help"}),
        json!({"command":"ov_help","description":"Show OpenVibe command menu"}),
        json!({"command":"ov_mode","description":"Switch OpenVibe mode"}),
        json!({"command":"ov_relay","description":"Bind chat to OpenVibe thread"}),
        json!({"command":"ov_thread","description":"Open or focus OpenVibe thread"}),
        json!({"command":"ov_workspace","description":"List/open OpenVibe workspace"}),
        json!({"command":"ov_settings","description":"Read/update OpenVibe settings"}),
    ]
}

#[tauri::command]
pub(crate) async fn moltis_sync_telegram_menu(
    token: String,
) -> Result<MoltisTelegramMenuSyncResult, String> {
    let token = token.trim().to_string();
    if token.is_empty() {
        return Err("Telegram bot token is required".to_string());
    }

    let commands = build_telegram_commands();
    let url = format!("https://api.telegram.org/bot{token}/setMyCommands");
    let body = json!({ "commands": commands });
    let command_count = body
        .get("commands")
        .and_then(|value| value.as_array())
        .map(|value| value.len())
        .unwrap_or(0);

    let client = reqwest::Client::new();
    let response = client
        .post(url)
        .json(&body)
        .send()
        .await
        .map_err(|error| format!("Telegram request failed: {error}"))?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response
            .text()
            .await
            .unwrap_or_else(|_| "<no body>".to_string());
        return Err(format!("Telegram API error {status}: {body}"));
    }

    let parsed = response
        .json::<TelegramSetMyCommandsResponse>()
        .await
        .map_err(|error| format!("Failed to parse Telegram response: {error}"))?;

    if !parsed.ok {
        return Err(parsed
            .description
            .unwrap_or_else(|| "Telegram rejected setMyCommands".to_string()));
    }

    Ok(MoltisTelegramMenuSyncResult {
        ok: true,
        command_count,
        description: parsed
            .description
            .unwrap_or_else(|| "Menu synced".to_string()),
    })
}
