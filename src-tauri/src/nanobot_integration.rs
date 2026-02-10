use std::collections::HashSet;
use std::path::PathBuf;
use std::time::Duration;

use ::nanobot::config::{get_config_path, load_config, save_config, Config};
use serde_json::{json, Value};

use crate::types::AppSettings;

const DINGTALK_V1_ACCESS_TOKEN_ENDPOINT: &str = "https://api.dingtalk.com/v1.0/oauth2/accessToken";
const DINGTALK_V0_ACCESS_TOKEN_ENDPOINT: &str = "https://oapi.dingtalk.com/gettoken";

fn panic_to_string(payload: Box<dyn std::any::Any + Send>) -> String {
    if let Some(text) = payload.downcast_ref::<&str>() {
        return (*text).to_string();
    }
    if let Some(text) = payload.downcast_ref::<String>() {
        return text.clone();
    }
    "unknown panic".to_string()
}

fn load_nanobot_config_safe() -> Result<Config, String> {
    let result = std::panic::catch_unwind(|| load_config(None));
    match result {
        Ok(value) => value.map_err(|error| error.to_string()),
        Err(payload) => Err(format!("nanobot config load panic: {}", panic_to_string(payload))),
    }
}

fn save_nanobot_config_safe(config: &Config) -> Result<(), String> {
    let owned = config.clone();
    let result = std::panic::catch_unwind(move || save_config(&owned, None));
    match result {
        Ok(value) => value.map_err(|error| error.to_string()),
        Err(payload) => Err(format!("nanobot config save panic: {}", panic_to_string(payload))),
    }
}

fn parse_allow_from(raw: &str) -> Vec<String> {
    let mut seen = HashSet::new();
    let mut values = Vec::new();
    for item in raw
        .split(|c: char| c == ',' || c == ';' || c == '\n' || c == '\r')
        .map(str::trim)
        .filter(|value| !value.is_empty())
    {
        if seen.insert(item.to_string()) {
            values.push(item.to_string());
        }
    }
    values
}

fn serialize_allow_from(allow_from: &[String]) -> String {
    allow_from
        .iter()
        .map(|value| value.trim())
        .filter(|value| !value.is_empty())
        .collect::<Vec<_>>()
        .join(", ")
}

pub(crate) fn hydrate_settings_from_nanobot(settings: &mut AppSettings) -> Result<(), String> {
    let config = load_nanobot_config_safe()?;
    settings.nanobot_dingtalk_enabled = config.channels.dingtalk.enabled;
    settings.nanobot_dingtalk_client_id = config.channels.dingtalk.client_id;
    settings.nanobot_dingtalk_client_secret = config.channels.dingtalk.client_secret;
    settings.nanobot_dingtalk_allow_from = serialize_allow_from(&config.channels.dingtalk.allow_from);
    settings.nanobot_email_enabled = config.channels.email.enabled;
    settings.nanobot_email_consent_granted = config.channels.email.consent_granted;
    settings.nanobot_email_imap_host = config.channels.email.imap_host;
    settings.nanobot_email_imap_port = config.channels.email.imap_port;
    settings.nanobot_email_imap_username = config.channels.email.imap_username;
    settings.nanobot_email_imap_password = config.channels.email.imap_password;
    settings.nanobot_email_imap_mailbox = config.channels.email.imap_mailbox;
    settings.nanobot_email_imap_use_ssl = config.channels.email.imap_use_ssl;
    settings.nanobot_email_smtp_host = config.channels.email.smtp_host;
    settings.nanobot_email_smtp_port = config.channels.email.smtp_port;
    settings.nanobot_email_smtp_username = config.channels.email.smtp_username;
    settings.nanobot_email_smtp_password = config.channels.email.smtp_password;
    settings.nanobot_email_smtp_use_tls = config.channels.email.smtp_use_tls;
    settings.nanobot_email_smtp_use_ssl = config.channels.email.smtp_use_ssl;
    settings.nanobot_email_from_address = config.channels.email.from_address;
    settings.nanobot_email_auto_reply_enabled = config.channels.email.auto_reply_enabled;
    settings.nanobot_email_poll_interval_seconds = config.channels.email.poll_interval_seconds;
    settings.nanobot_email_allow_from = serialize_allow_from(&config.channels.email.allow_from);
    settings.nanobot_qq_enabled = config.channels.qq.enabled;
    settings.nanobot_qq_app_id = config.channels.qq.app_id;
    settings.nanobot_qq_secret = config.channels.qq.secret;
    settings.nanobot_qq_allow_from = serialize_allow_from(&config.channels.qq.allow_from);
    if settings.nanobot_dingtalk_enabled
        || settings.nanobot_email_enabled
        || settings.nanobot_qq_enabled
    {
        settings.nanobot_enabled = true;
    }
    Ok(())
}

pub(crate) fn apply_settings_to_nanobot(settings: &AppSettings) -> Result<(), String> {
    let mut config = load_nanobot_config_safe()?;
    config.channels.dingtalk.enabled = settings.nanobot_enabled && settings.nanobot_dingtalk_enabled;
    config.channels.dingtalk.client_id = settings.nanobot_dingtalk_client_id.trim().to_string();
    config.channels.dingtalk.client_secret = settings.nanobot_dingtalk_client_secret.trim().to_string();
    config.channels.dingtalk.allow_from = parse_allow_from(&settings.nanobot_dingtalk_allow_from);
    config.channels.email.enabled = settings.nanobot_enabled && settings.nanobot_email_enabled;
    config.channels.email.consent_granted = settings.nanobot_email_consent_granted;
    config.channels.email.imap_host = settings.nanobot_email_imap_host.trim().to_string();
    config.channels.email.imap_port = settings.nanobot_email_imap_port;
    config.channels.email.imap_username = settings.nanobot_email_imap_username.trim().to_string();
    config.channels.email.imap_password = settings.nanobot_email_imap_password.trim().to_string();
    config.channels.email.imap_mailbox = settings.nanobot_email_imap_mailbox.trim().to_string();
    config.channels.email.imap_use_ssl = settings.nanobot_email_imap_use_ssl;
    config.channels.email.smtp_host = settings.nanobot_email_smtp_host.trim().to_string();
    config.channels.email.smtp_port = settings.nanobot_email_smtp_port;
    config.channels.email.smtp_username = settings.nanobot_email_smtp_username.trim().to_string();
    config.channels.email.smtp_password = settings.nanobot_email_smtp_password.trim().to_string();
    config.channels.email.smtp_use_tls = settings.nanobot_email_smtp_use_tls;
    config.channels.email.smtp_use_ssl = settings.nanobot_email_smtp_use_ssl;
    config.channels.email.from_address = settings.nanobot_email_from_address.trim().to_string();
    config.channels.email.auto_reply_enabled = settings.nanobot_email_auto_reply_enabled;
    config.channels.email.poll_interval_seconds = settings.nanobot_email_poll_interval_seconds;
    config.channels.email.allow_from = parse_allow_from(&settings.nanobot_email_allow_from);
    config.channels.qq.enabled = settings.nanobot_enabled && settings.nanobot_qq_enabled;
    config.channels.qq.app_id = settings.nanobot_qq_app_id.trim().to_string();
    config.channels.qq.secret = settings.nanobot_qq_secret.trim().to_string();
    config.channels.qq.allow_from = parse_allow_from(&settings.nanobot_qq_allow_from);
    save_nanobot_config_safe(&config)
}

async fn request_dingtalk_v1_token(
    client: &reqwest::Client,
    client_id: &str,
    client_secret: &str,
) -> Result<(), String> {
    let response = client
        .post(DINGTALK_V1_ACCESS_TOKEN_ENDPOINT)
        .json(&json!({
            "appKey": client_id,
            "appSecret": client_secret,
        }))
        .send()
        .await
        .map_err(|error| error.to_string())?;
    let status = response.status();
    let body: Value = response
        .json()
        .await
        .unwrap_or_else(|_| json!({ "message": "Failed to parse response." }));
    let token = body
        .get("accessToken")
        .and_then(|value| value.as_str())
        .unwrap_or_default();
    if status.is_success() && !token.is_empty() {
        return Ok(());
    }
    let message = body
        .get("message")
        .and_then(|value| value.as_str())
        .or_else(|| body.get("errmsg").and_then(|value| value.as_str()))
        .unwrap_or("DingTalk v1 token check failed.");
    Err(format!("{} (HTTP {})", message, status.as_u16()))
}

async fn request_dingtalk_v0_token(
    client: &reqwest::Client,
    client_id: &str,
    client_secret: &str,
) -> Result<(), String> {
    let response = client
        .get(DINGTALK_V0_ACCESS_TOKEN_ENDPOINT)
        .query(&[
            ("appkey", client_id),
            ("appsecret", client_secret),
        ])
        .send()
        .await
        .map_err(|error| error.to_string())?;
    let status = response.status();
    let body: Value = response
        .json()
        .await
        .unwrap_or_else(|_| json!({ "errmsg": "Failed to parse response." }));
    let token = body
        .get("access_token")
        .and_then(|value| value.as_str())
        .unwrap_or_default();
    let errcode = body.get("errcode").and_then(|value| value.as_i64()).unwrap_or(0);
    if status.is_success() && errcode == 0 && !token.is_empty() {
        return Ok(());
    }
    let message = body
        .get("errmsg")
        .and_then(|value| value.as_str())
        .unwrap_or("DingTalk token check failed.");
    Err(format!(
        "{} (HTTP {}, errcode {})",
        message,
        status.as_u16(),
        errcode
    ))
}

#[tauri::command]
pub(crate) async fn nanobot_test_dingtalk(
    client_id: String,
    client_secret: String,
) -> Result<Value, String> {
    let client_id = client_id.trim();
    let client_secret = client_secret.trim();
    if client_id.is_empty() || client_secret.is_empty() {
        return Ok(json!({
            "ok": false,
            "endpoint": Value::Null,
            "message": "Client ID and Client Secret are required.",
        }));
    }

    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(10))
        .build()
        .map_err(|error| error.to_string())?;

    match request_dingtalk_v1_token(&client, client_id, client_secret).await {
        Ok(()) => Ok(json!({
            "ok": true,
            "endpoint": DINGTALK_V1_ACCESS_TOKEN_ENDPOINT,
            "message": "DingTalk authentication succeeded.",
        })),
        Err(v1_error) => match request_dingtalk_v0_token(&client, client_id, client_secret).await {
            Ok(()) => Ok(json!({
                "ok": true,
                "endpoint": DINGTALK_V0_ACCESS_TOKEN_ENDPOINT,
                "message": "DingTalk authentication succeeded.",
            })),
            Err(v0_error) => Ok(json!({
                "ok": false,
                "endpoint": Value::Null,
                "message": format!("{v1_error}; {v0_error}"),
            })),
        },
    }
}

#[tauri::command]
pub(crate) async fn nanobot_config_path() -> Result<String, String> {
    let path = match std::panic::catch_unwind(get_config_path) {
        Ok(value) => value.map_err(|error| error.to_string())?,
        Err(payload) => {
            return Err(format!(
                "nanobot config path panic: {}",
                panic_to_string(payload)
            ))
        }
    };
    path.to_str()
        .map(|value| value.to_string())
        .ok_or_else(|| "Unable to resolve nanobot config path.".to_string())
}

pub(crate) fn nanobot_workspace_root_path() -> Result<PathBuf, String> {
    let config_path = match std::panic::catch_unwind(get_config_path) {
        Ok(value) => value.map_err(|error| error.to_string())?,
        Err(payload) => {
            return Err(format!(
                "nanobot config path panic: {}",
                panic_to_string(payload)
            ))
        }
    };
    config_path
        .parent()
        .map(|value| value.to_path_buf())
        .ok_or_else(|| "Unable to resolve nanobot workspace root.".to_string())
}
