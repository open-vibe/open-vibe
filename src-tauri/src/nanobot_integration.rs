use std::collections::HashSet;
use std::path::PathBuf;
use std::time::Duration;

use ::nanobot::config::{get_config_path, load_config, save_config, Config};
use btleplug::api::{Central as _, Manager as _, Peripheral as _, ScanFilter};
use btleplug::platform::Manager;
use serde_json::{json, Value};

use crate::types::AppSettings;

const DINGTALK_V1_ACCESS_TOKEN_ENDPOINT: &str = "https://api.dingtalk.com/v1.0/oauth2/accessToken";
const DINGTALK_V0_ACCESS_TOKEN_ENDPOINT: &str = "https://oapi.dingtalk.com/gettoken";

#[cfg(target_os = "windows")]
fn utf16_buf_to_string(value: &[u16]) -> String {
    let end = value
        .iter()
        .position(|item| *item == 0)
        .unwrap_or(value.len());
    String::from_utf16_lossy(&value[..end]).trim().to_string()
}

#[cfg(target_os = "windows")]
fn format_bluetooth_address(value: u64) -> String {
    let bytes = value.to_be_bytes();
    format!(
        "{:02X}:{:02X}:{:02X}:{:02X}:{:02X}:{:02X}",
        bytes[2], bytes[3], bytes[4], bytes[5], bytes[6], bytes[7]
    )
}

#[cfg(target_os = "windows")]
fn probe_windows_classic_bluetooth(keyword: &str) -> Result<Vec<Value>, String> {
    use std::mem::size_of;
    use windows::Win32::Devices::Bluetooth::{
        BluetoothFindDeviceClose, BluetoothFindFirstDevice, BluetoothFindFirstRadio,
        BluetoothFindNextDevice, BluetoothFindNextRadio, BluetoothFindRadioClose,
        BLUETOOTH_DEVICE_INFO, BLUETOOTH_DEVICE_SEARCH_PARAMS, BLUETOOTH_FIND_RADIO_PARAMS,
    };
    use windows::Win32::Foundation::{CloseHandle, HANDLE};

    let mut devices = Vec::new();
    let mut seen = HashSet::new();
    let lowered_keyword = keyword.trim().to_lowercase();

    unsafe {
        let mut radio_search = BLUETOOTH_FIND_RADIO_PARAMS {
            dwSize: size_of::<BLUETOOTH_FIND_RADIO_PARAMS>() as u32,
        };
        let mut radio_handle = HANDLE::default();
        let radio_find = match BluetoothFindFirstRadio(&mut radio_search, &mut radio_handle) {
            Ok(value) => value,
            Err(_) => return Ok(devices),
        };

        loop {
            let search = BLUETOOTH_DEVICE_SEARCH_PARAMS {
                dwSize: size_of::<BLUETOOTH_DEVICE_SEARCH_PARAMS>() as u32,
                fReturnAuthenticated: true.into(),
                fReturnRemembered: true.into(),
                fReturnUnknown: true.into(),
                fReturnConnected: true.into(),
                fIssueInquiry: true.into(),
                cTimeoutMultiplier: 2,
                hRadio: radio_handle,
            };
            let mut device = BLUETOOTH_DEVICE_INFO {
                dwSize: size_of::<BLUETOOTH_DEVICE_INFO>() as u32,
                ..Default::default()
            };
            if let Ok(device_find) = BluetoothFindFirstDevice(&search, &mut device) {
                loop {
                    let address = format_bluetooth_address(device.Address.Anonymous.ullLong);
                    let name = utf16_buf_to_string(&device.szName);
                    let display_name = if name.is_empty() {
                        format!("Unknown ({})", &address)
                    } else {
                        name
                    };
                    if lowered_keyword.is_empty()
                        || display_name.to_lowercase().contains(&lowered_keyword)
                        || address.to_lowercase().contains(&lowered_keyword)
                    {
                        let id = format!("classic:{address}");
                        if seen.insert(id.clone()) {
                            devices.push(json!({
                                "id": id,
                                "name": display_name,
                                "rssi": Value::Null,
                                "source": "classic",
                            }));
                        }
                    }
                    if BluetoothFindNextDevice(device_find, &mut device).is_err() {
                        break;
                    }
                }
                let _ = BluetoothFindDeviceClose(device_find);
            }

            let _ = CloseHandle(radio_handle);
            let mut next_radio = HANDLE::default();
            if BluetoothFindNextRadio(radio_find, &mut next_radio).is_err() {
                break;
            }
            radio_handle = next_radio;
        }

        let _ = BluetoothFindRadioClose(radio_find);
    }

    Ok(devices)
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

fn save_nanobot_config_safe(config: &Config) -> Result<(), String> {
    let owned = config.clone();
    let result = std::panic::catch_unwind(move || save_config(&owned, None));
    match result {
        Ok(value) => value.map_err(|error| error.to_string()),
        Err(payload) => Err(format!(
            "nanobot config save panic: {}",
            panic_to_string(payload)
        )),
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
    settings.nanobot_dingtalk_allow_from =
        serialize_allow_from(&config.channels.dingtalk.allow_from);
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
    config.channels.dingtalk.enabled =
        settings.nanobot_enabled && settings.nanobot_dingtalk_enabled;
    config.channels.dingtalk.client_id = settings.nanobot_dingtalk_client_id.trim().to_string();
    config.channels.dingtalk.client_secret =
        settings.nanobot_dingtalk_client_secret.trim().to_string();
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
        .query(&[("appkey", client_id), ("appsecret", client_secret)])
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
    let errcode = body
        .get("errcode")
        .and_then(|value| value.as_i64())
        .unwrap_or(0);
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

#[tauri::command]
pub(crate) async fn nanobot_bluetooth_probe(
    keyword: Option<String>,
    timeout_ms: Option<u64>,
) -> Result<Value, String> {
    let timeout = Duration::from_millis(timeout_ms.unwrap_or(2200).clamp(300, 10_000));
    let keyword = keyword.unwrap_or_default().trim().to_lowercase();
    let mut errors: Vec<String> = Vec::new();
    let mut supported = false;
    let mut adapter_count = 0usize;
    let mut devices = Vec::new();
    let mut seen_ids = HashSet::new();

    #[cfg(target_os = "windows")]
    {
        match probe_windows_classic_bluetooth(&keyword) {
            Ok(classic_devices) => {
                supported = true;
                for device in classic_devices {
                    let id = device
                        .get("id")
                        .and_then(|value| value.as_str())
                        .unwrap_or_default()
                        .to_string();
                    if !id.is_empty() && seen_ids.insert(id) {
                        devices.push(device);
                    }
                }
            }
            Err(error) => errors.push(error),
        }
    }

    match Manager::new().await {
        Ok(manager) => {
            supported = true;
            match manager.adapters().await {
                Ok(adapters) => {
                    adapter_count = adapters.len();
                    for adapter in adapters {
                        if let Err(error) = adapter.start_scan(ScanFilter::default()).await {
                            errors.push(format!("Bluetooth scan start failed: {error}"));
                            continue;
                        }
                        tokio::time::sleep(timeout).await;
                        let peripherals = match adapter.peripherals().await {
                            Ok(value) => value,
                            Err(error) => {
                                let _ = adapter.stop_scan().await;
                                errors.push(format!("Failed to read Bluetooth devices: {error}"));
                                continue;
                            }
                        };
                        for peripheral in peripherals {
                            let properties = match peripheral.properties().await {
                                Ok(value) => value,
                                Err(error) => {
                                    errors.push(format!(
                                        "Failed to read Bluetooth device details: {error}"
                                    ));
                                    continue;
                                }
                            };
                            let Some(properties) = properties else {
                                continue;
                            };
                            let id = peripheral.id().to_string();
                            let local_name =
                                properties.local_name.unwrap_or_default().trim().to_string();
                            let display_name = if local_name.is_empty() {
                                format!("Unknown ({})", &id.chars().take(8).collect::<String>())
                            } else {
                                local_name
                            };
                            if !keyword.is_empty() {
                                let id_lower = id.to_lowercase();
                                let name_lower = display_name.to_lowercase();
                                if !id_lower.contains(&keyword) && !name_lower.contains(&keyword) {
                                    continue;
                                }
                            }
                            let scoped_id = format!("ble:{id}");
                            if seen_ids.insert(scoped_id.clone()) {
                                devices.push(json!({
                                    "id": scoped_id,
                                    "name": display_name,
                                    "rssi": properties.rssi,
                                    "source": "ble",
                                }));
                            }
                        }
                        let _ = adapter.stop_scan().await;
                    }
                }
                Err(error) => {
                    errors.push(format!("Failed to enumerate Bluetooth adapters: {error}"))
                }
            }
        }
        Err(error) => errors.push(format!("Bluetooth manager unavailable: {error}")),
    }

    if !supported {
        return Ok(json!({
            "supported": false,
            "devices": [],
            "adapterCount": adapter_count,
            "error": errors.first().cloned().unwrap_or_else(|| "Bluetooth unavailable.".to_string()),
        }));
    }

    Ok(json!({
        "supported": true,
        "devices": devices,
        "adapterCount": adapter_count,
        "error": if errors.is_empty() { Value::Null } else { Value::String(errors.join("; ")) },
    }))
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
