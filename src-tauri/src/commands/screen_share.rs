use crate::screen_share::{
    list_audio_input_devices, list_capture_sources, CaptureSource, ConnectNativeMediaRequest,
    NativeAudioInputDevice, ScreenShareService, ScreenShareStatus, StartScreenShareRequest,
};
use tauri::State;

#[tauri::command]
pub fn list_native_capture_sources() -> Result<Vec<CaptureSource>, String> {
    list_capture_sources()
}

#[tauri::command]
pub fn list_native_audio_input_devices() -> Result<Vec<NativeAudioInputDevice>, String> {
    list_audio_input_devices()
}

#[tauri::command]
pub async fn connect_native_media(
    state: State<'_, ScreenShareService>,
    request: ConnectNativeMediaRequest,
) -> Result<(), String> {
    state.connect(request).await
}

#[tauri::command]
pub async fn start_native_screen_share(
    state: State<'_, ScreenShareService>,
    request: StartScreenShareRequest,
) -> Result<(), String> {
    state.start(request).await
}

#[tauri::command]
pub async fn stop_native_screen_share(state: State<'_, ScreenShareService>) -> Result<(), String> {
    state.stop().await
}

#[tauri::command]
pub async fn disconnect_native_media(state: State<'_, ScreenShareService>) -> Result<(), String> {
    state.disconnect().await
}

#[tauri::command]
pub fn set_native_microphone_muted(
    state: State<'_, ScreenShareService>,
    muted: bool,
) -> Result<(), String> {
    state.set_microphone_muted(muted)
}

#[tauri::command]
pub fn set_native_microphone_device(
    state: State<'_, ScreenShareService>,
    device_id: String,
) -> Result<(), String> {
    state.set_microphone_device(&device_id)
}

#[tauri::command]
pub fn get_native_screen_share_status(state: State<'_, ScreenShareService>) -> ScreenShareStatus {
    state.status()
}
