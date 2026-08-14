use tauri::Emitter;
use tauri::Manager;

#[derive(serde::Serialize, Clone)]
pub struct LoadingStage {
    pub progress: u32,
    pub text: String,
}

#[tauri::command]
pub async fn emit_loading_stage(
    app: tauri::AppHandle,
    progress: u32,
    text: String,
) -> Result<(), String> {
    app.emit("astrolune-loading-stage", LoadingStage { progress, text })
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn restart_app(app: tauri::AppHandle) -> Result<(), String> {
    app.restart();
}

#[tauri::command]
pub async fn show_main_window(app: tauri::AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("main") {
        window.show().map_err(|e| e.to_string())?;
        window.set_focus().map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub async fn open_url(url: String) -> Result<(), String> {
    open::that(&url).map_err(|e| e.to_string())?;
    Ok(())
}
