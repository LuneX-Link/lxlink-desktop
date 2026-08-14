mod commands;
mod screen_share;
use tauri::Manager;

#[derive(serde::Serialize)]
struct MdnsService {
    name: String,
    address: String,
    port: u16,
}

#[tauri::command]
async fn discover_mdns_services() -> Result<Vec<MdnsService>, String> {
    use mdns_sd::ServiceDaemon;

    let mdns = ServiceDaemon::new().map_err(|e| e.to_string())?;
    let receiver = mdns
        .browse("_lxlink._tcp.local")
        .map_err(|e| e.to_string())?;

    let mut services = Vec::new();
    let timeout = std::time::Duration::from_secs(2);
    let start = std::time::Instant::now();

    while start.elapsed() < timeout {
        if let Ok(mdns_sd::ServiceEvent::ServiceResolved(info)) =
            receiver.recv_timeout(std::time::Duration::from_millis(100))
        {
            let port = info.get_port();
            let ip = info
                .get_addresses()
                .iter()
                .next()
                .map(|a| a.to_string())
                .unwrap_or_default();

            services.push(MdnsService {
                name: info.get_fullname().to_string(),
                address: ip,
                port,
            });
        }
    }

    Ok(services)
}

fn setup_logging(app: &tauri::App) {
    use std::fs;
    use std::path::PathBuf;
    use std::time::{SystemTime, UNIX_EPOCH};

    let app_dir = app
        .path()
        .app_data_dir()
        .unwrap_or_else(|_| PathBuf::from("."));

    let _ = fs::create_dir_all(&app_dir);

    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);

    let log_file = app_dir.join("lxlink.log");
    let log_content = format!(
        "=== LX Link Log ===\n\
         Started at: {}\n\
         Version: {}\n\
         Platform: {}\n\
         \n",
        timestamp,
        env!("CARGO_PKG_VERSION"),
        std::env::consts::OS,
    );

    let _ = fs::write(&log_file, log_content);
}

pub fn run() {
    let run_result = tauri::Builder::default()
        .manage(screen_share::ScreenShareService::default())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            // Window management
            commands::splash::emit_loading_stage,
            commands::splash::restart_app,
            commands::splash::show_main_window,
            commands::splash::open_url,
            commands::screen_share::list_native_audio_input_devices,
            commands::screen_share::list_native_capture_sources,
            commands::screen_share::connect_native_media,
            commands::screen_share::start_native_screen_share,
            commands::screen_share::stop_native_screen_share,
            commands::screen_share::disconnect_native_media,
            commands::screen_share::set_native_microphone_muted,
            commands::screen_share::set_native_microphone_device,
            commands::screen_share::get_native_screen_share_status,
            discover_mdns_services,
        ])
        .setup(|app| {
            setup_logging(app);

            // Set black titlebar on Windows
            #[cfg(target_os = "windows")]
            {
                use windows::Win32::Foundation::COLORREF;
                use windows::Win32::Graphics::Dwm::{
                    DwmSetWindowAttribute, DWMWA_BORDER_COLOR, DWMWA_CAPTION_COLOR,
                };

                if let Some(window) = app.get_webview_window("main") {
                    if let Ok(hwnd) = window.hwnd() {
                        unsafe {
                            let color = COLORREF(0x000000);
                            let _ = DwmSetWindowAttribute(
                                hwnd,
                                DWMWA_CAPTION_COLOR,
                                &color as *const _ as *const _,
                                std::mem::size_of::<COLORREF>() as u32,
                            );
                            let _ = DwmSetWindowAttribute(
                                hwnd,
                                DWMWA_BORDER_COLOR,
                                &color as *const _ as *const _,
                                std::mem::size_of::<COLORREF>() as u32,
                            );
                        }
                    }
                }
            }

            Ok(())
        })
        .run(tauri::generate_context!());

    if let Err(error) = run_result {
        eprintln!("error while running tauri application: {error}");

        #[cfg(target_os = "windows")]
        {
            use windows::Win32::UI::WindowsAndMessaging::{MessageBoxW, MB_ICONERROR, MB_OK};

            let wide_msg: Vec<u16> = format!("LX Link failed to start:\n\n{}", error)
                .encode_utf16()
                .chain(std::iter::once(0))
                .collect();
            let wide_title: Vec<u16> = "LX Link".encode_utf16().chain(std::iter::once(0)).collect();

            unsafe {
                MessageBoxW(
                    None,
                    windows::core::PCWSTR(wide_msg.as_ptr()),
                    windows::core::PCWSTR(wide_title.as_ptr()),
                    MB_OK | MB_ICONERROR,
                );
            }
        }
    }
}
