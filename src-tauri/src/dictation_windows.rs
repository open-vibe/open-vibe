use serde::Serialize;
use tauri::{AppHandle, Emitter, State};
use windows::core::HSTRING;
use windows::Foundation::TypedEventHandler;
use windows::Media::SpeechRecognition::{
    SpeechContinuousRecognitionCompletedEventArgs,
    SpeechContinuousRecognitionResultGeneratedEventArgs, SpeechRecognitionResultStatus,
    SpeechRecognitionScenario, SpeechRecognitionTopicConstraint, SpeechRecognizer,
};
use windows::Win32::System::WinRT::{RoInitialize, RO_INIT_MULTITHREADED};

use crate::state::AppState;

const DEFAULT_MODEL_ID: &str = "base";

#[derive(Debug, Serialize, Clone, Copy, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub(crate) enum DictationModelState {
    Missing,
    Downloading,
    Ready,
    Error,
}

#[derive(Debug, Serialize, Clone)]
pub(crate) struct DictationDownloadProgress {
    #[serde(rename = "downloadedBytes")]
    pub(crate) downloaded_bytes: u64,
    #[serde(rename = "totalBytes")]
    pub(crate) total_bytes: Option<u64>,
}

#[derive(Debug, Serialize, Clone)]
pub(crate) struct DictationModelStatus {
    pub(crate) state: DictationModelState,
    #[serde(rename = "modelId")]
    pub(crate) model_id: String,
    pub(crate) progress: Option<DictationDownloadProgress>,
    pub(crate) error: Option<String>,
    pub(crate) path: Option<String>,
}

#[derive(Debug, Serialize, Clone, Copy, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub(crate) enum DictationSessionState {
    Idle,
    Listening,
    Processing,
}

#[derive(Debug, Serialize, Clone)]
#[serde(tag = "type", rename_all = "snake_case")]
pub(crate) enum DictationEvent {
    State { state: DictationSessionState },
    Level { value: f32 },
    Transcript { text: String },
    Error { message: String },
    Canceled { message: String },
}

pub(crate) struct DictationSession {
    recognizer: SpeechRecognizer,
    result_token: i64,
    completed_token: i64,
}

pub(crate) struct DictationState {
    pub(crate) model_status: DictationModelStatus,
    pub(crate) session_state: DictationSessionState,
    session: Option<DictationSession>,
}

impl Default for DictationState {
    fn default() -> Self {
        Self {
            model_status: windows_ready_status(None),
            session_state: DictationSessionState::Idle,
            session: None,
        }
    }
}

fn emit_status(app: &AppHandle, status: &DictationModelStatus) {
    let _ = app.emit("dictation-download", status);
}

fn emit_event(app: &AppHandle, event: DictationEvent) {
    let _ = app.emit("dictation-event", event);
}

fn windows_ready_status(model_id: Option<String>) -> DictationModelStatus {
    DictationModelStatus {
        state: DictationModelState::Ready,
        model_id: model_id.unwrap_or_else(|| DEFAULT_MODEL_ID.to_string()),
        progress: None,
        error: None,
        path: None,
    }
}

fn format_windows_error(error: windows::core::Error) -> String {
    error.message().to_string()
}

fn status_to_message(status: SpeechRecognitionResultStatus) -> String {
    match status {
        SpeechRecognitionResultStatus::Success => "Success".to_string(),
        SpeechRecognitionResultStatus::TopicLanguageNotSupported => {
            "Selected language is not supported.".to_string()
        }
        SpeechRecognitionResultStatus::GrammarLanguageMismatch => {
            "Recognition language mismatch.".to_string()
        }
        SpeechRecognitionResultStatus::GrammarCompilationFailure => {
            "Failed to compile speech recognition constraints.".to_string()
        }
        SpeechRecognitionResultStatus::AudioQualityFailure => {
            "Microphone audio quality issue.".to_string()
        }
        SpeechRecognitionResultStatus::UserCanceled => "Dictation canceled.".to_string(),
        SpeechRecognitionResultStatus::Unknown => "Unknown speech recognition error.".to_string(),
        SpeechRecognitionResultStatus::TimeoutExceeded => "Dictation timed out.".to_string(),
        SpeechRecognitionResultStatus::PauseLimitExceeded => {
            "Dictation paused for too long.".to_string()
        }
        SpeechRecognitionResultStatus::NetworkFailure => {
            "Network error while using system dictation.".to_string()
        }
        SpeechRecognitionResultStatus::MicrophoneUnavailable => {
            "Microphone unavailable.".to_string()
        }
        _ => "Speech recognition error.".to_string(),
    }
}

fn build_recognizer() -> Result<SpeechRecognizer, String> {
    let recognizer =
        SpeechRecognizer::new().map_err(format_windows_error)?;
    let topic = SpeechRecognitionTopicConstraint::Create(
        SpeechRecognitionScenario::Dictation,
        &HSTRING::from("dictation"),
    )
    .map_err(format_windows_error)?;
    recognizer
        .Constraints()
        .map_err(format_windows_error)?
        .Append(&topic)
        .map_err(format_windows_error)?;
    let compilation = recognizer
        .CompileConstraintsAsync()
        .map_err(format_windows_error)?
        .get()
        .map_err(format_windows_error)?;
    let status = compilation.Status().map_err(format_windows_error)?;
    if status != SpeechRecognitionResultStatus::Success {
        return Err(status_to_message(status));
    }
    Ok(recognizer)
}

#[tauri::command]
pub(crate) async fn dictation_model_status(
    app: AppHandle,
    state: State<'_, AppState>,
    model_id: Option<String>,
) -> Result<DictationModelStatus, String> {
    let status = windows_ready_status(model_id);
    {
        let mut dictation = state.dictation.lock().await;
        dictation.model_status = status.clone();
        if dictation.session_state == DictationSessionState::Processing {
            dictation.session_state = DictationSessionState::Idle;
        }
    }
    emit_status(&app, &status);
    Ok(status)
}

#[tauri::command]
pub(crate) async fn dictation_download_model(
    app: AppHandle,
    state: State<'_, AppState>,
    model_id: Option<String>,
) -> Result<DictationModelStatus, String> {
    dictation_model_status(app, state, model_id).await
}

#[tauri::command]
pub(crate) async fn dictation_cancel_download(
    app: AppHandle,
    state: State<'_, AppState>,
    model_id: Option<String>,
) -> Result<DictationModelStatus, String> {
    dictation_model_status(app, state, model_id).await
}

#[tauri::command]
pub(crate) async fn dictation_remove_model(
    app: AppHandle,
    state: State<'_, AppState>,
    model_id: Option<String>,
) -> Result<DictationModelStatus, String> {
    dictation_model_status(app, state, model_id).await
}

#[tauri::command]
pub(crate) async fn dictation_start(
    _preferred_language: Option<String>,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<DictationSessionState, String> {
    unsafe {
        let _ = RoInitialize(RO_INIT_MULTITHREADED);
    }
    {
        let dictation = state.dictation.lock().await;
        if dictation.session_state != DictationSessionState::Idle {
            let message = "Dictation is already active.".to_string();
            emit_event(&app, DictationEvent::Error { message: message.clone() });
            return Err(message);
        }
    }

    let recognizer = build_recognizer()?;
    let session = recognizer
        .ContinuousRecognitionSession()
        .map_err(format_windows_error)?;

    let app_for_results = app.clone();
    let result_token = session
        .ResultGenerated(&TypedEventHandler::<
            _,
            SpeechContinuousRecognitionResultGeneratedEventArgs,
        >::new(move |_, args| {
            if let Some(args) = args.as_ref() {
                let result = args.Result()?;
                if result.Status()? == SpeechRecognitionResultStatus::Success {
                    let text = result.Text()?.to_string();
                    if !text.trim().is_empty() {
                        emit_event(&app_for_results, DictationEvent::Transcript { text });
                    }
                }
            }
            Ok(())
        }))
        .map_err(format_windows_error)?;

    let app_for_completed = app.clone();
    let completed_token = session
        .Completed(&TypedEventHandler::<_, SpeechContinuousRecognitionCompletedEventArgs>::new(
            move |_, args| {
                if let Some(args) = args.as_ref() {
                    let status = args.Status()?;
                    if status != SpeechRecognitionResultStatus::Success {
                        emit_event(
                            &app_for_completed,
                            DictationEvent::Error {
                                message: status_to_message(status),
                            },
                        );
                    }
                }
                emit_event(
                    &app_for_completed,
                    DictationEvent::State {
                        state: DictationSessionState::Idle,
                    },
                );
                Ok(())
            },
        ))
        .map_err(format_windows_error)?;

    session
        .StartAsync()
        .map_err(format_windows_error)?
        .get()
        .map_err(format_windows_error)?;

    {
        let mut dictation = state.dictation.lock().await;
        dictation.session_state = DictationSessionState::Listening;
        dictation.session = Some(DictationSession {
            recognizer,
            result_token,
            completed_token,
        });
    }

    emit_event(
        &app,
        DictationEvent::State {
            state: DictationSessionState::Listening,
        },
    );

    Ok(DictationSessionState::Listening)
}

#[tauri::command]
pub(crate) async fn dictation_request_permission(_app: AppHandle) -> Result<bool, String> {
    Ok(true)
}

#[tauri::command]
pub(crate) async fn dictation_stop(
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<DictationSessionState, String> {
    let session = {
        let mut dictation = state.dictation.lock().await;
        if dictation.session_state != DictationSessionState::Listening {
            let message = "Dictation is not currently listening.".to_string();
            emit_event(&app, DictationEvent::Error { message: message.clone() });
            return Err(message);
        }
        dictation.session_state = DictationSessionState::Processing;
        dictation.session.take()
    };

    emit_event(
        &app,
        DictationEvent::State {
            state: DictationSessionState::Processing,
        },
    );

    if let Some(session) = session {
        let speech_session = session
            .recognizer
            .ContinuousRecognitionSession()
            .map_err(format_windows_error)?;
        speech_session
            .StopAsync()
            .map_err(format_windows_error)?
            .get()
            .map_err(format_windows_error)?;
        let _ = speech_session.RemoveResultGenerated(session.result_token);
        let _ = speech_session.RemoveCompleted(session.completed_token);
        let _ = session.recognizer.Close();
    }

    {
        let mut dictation = state.dictation.lock().await;
        dictation.session_state = DictationSessionState::Idle;
    }

    emit_event(
        &app,
        DictationEvent::State {
            state: DictationSessionState::Idle,
        },
    );

    Ok(DictationSessionState::Idle)
}

#[tauri::command]
pub(crate) async fn dictation_cancel(
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<DictationSessionState, String> {
    let session = {
        let mut dictation = state.dictation.lock().await;
        let session = dictation.session.take();
        dictation.session_state = DictationSessionState::Idle;
        session
    };

    if let Some(session) = session {
        let speech_session = session
            .recognizer
            .ContinuousRecognitionSession()
            .map_err(format_windows_error)?;
        if let Ok(action) = speech_session.CancelAsync() {
            let _ = action.get();
        }
        let _ = speech_session.RemoveResultGenerated(session.result_token);
        let _ = speech_session.RemoveCompleted(session.completed_token);
        let _ = session.recognizer.Close();
    }

    emit_event(
        &app,
        DictationEvent::State {
            state: DictationSessionState::Idle,
        },
    );
    emit_event(
        &app,
        DictationEvent::Canceled {
            message: "Canceled".to_string(),
        },
    );

    Ok(DictationSessionState::Idle)
}
