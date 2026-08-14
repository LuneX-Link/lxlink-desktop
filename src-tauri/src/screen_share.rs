use serde::{Deserialize, Serialize};
use std::sync::{Arc, Mutex};

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CaptureSource {
    pub id: String,
    pub kind: String,
    pub name: String,
    pub width: u32,
    pub height: u32,
    pub is_primary: bool,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StartScreenShareRequest {
    pub source_id: String,
    pub width: u32,
    pub height: u32,
    pub fps: u32,
    pub bitrate_kbps: u32,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConnectNativeMediaRequest {
    pub livekit_url: String,
    pub token: String,
    pub microphone_enabled: bool,
    pub microphone_device_id: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NativeAudioInputDevice {
    pub id: String,
    pub name: String,
    pub is_default: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ScreenShareStatus {
    pub active: bool,
    pub source_id: Option<String>,
    pub target_width: u32,
    pub target_height: u32,
    pub target_fps: u32,
    pub actual_width: u32,
    pub actual_height: u32,
    pub actual_fps: f64,
    pub captured_frames: u64,
    pub dropped_frames: u64,
    pub encoder: String,
    pub error: Option<String>,
}

impl Default for ScreenShareStatus {
    fn default() -> Self {
        Self {
            active: false,
            source_id: None,
            target_width: 0,
            target_height: 0,
            target_fps: 0,
            actual_width: 0,
            actual_height: 0,
            actual_fps: 0.0,
            captured_frames: 0,
            dropped_frames: 0,
            encoder: "unavailable".to_string(),
            error: None,
        }
    }
}

pub struct ScreenShareService {
    status: Arc<Mutex<ScreenShareStatus>>,
    #[cfg(target_os = "windows")]
    session: Mutex<Option<windows_impl::NativeScreenShareSession>>,
}

impl Default for ScreenShareService {
    fn default() -> Self {
        Self {
            status: Arc::new(Mutex::new(ScreenShareStatus::default())),
            #[cfg(target_os = "windows")]
            session: Mutex::new(None),
        }
    }
}

impl ScreenShareService {
    pub fn status(&self) -> ScreenShareStatus {
        self.status
            .lock()
            .expect("screen share status mutex poisoned")
            .clone()
    }

    #[cfg(target_os = "windows")]
    pub async fn connect(&self, request: ConnectNativeMediaRequest) -> Result<(), String> {
        self.disconnect().await?;
        let session = windows_impl::connect(&request).await?;
        *self
            .session
            .lock()
            .expect("screen share session mutex poisoned") = Some(session);
        Ok(())
    }

    #[cfg(not(target_os = "windows"))]
    pub async fn connect(&self, _request: ConnectNativeMediaRequest) -> Result<(), String> {
        Err("Native media is currently supported on Windows only".to_string())
    }

    #[cfg(target_os = "windows")]
    pub async fn start(&self, request: StartScreenShareRequest) -> Result<(), String> {
        self.stop().await?;
        let session = self
            .session
            .lock()
            .expect("screen share session mutex poisoned")
            .take()
            .ok_or_else(|| "Native media is not connected to the call".to_string())?;
        let (session, result) =
            windows_impl::start(session, request, Arc::clone(&self.status)).await;
        *self
            .session
            .lock()
            .expect("screen share session mutex poisoned") = Some(session);
        result
    }

    #[cfg(not(target_os = "windows"))]
    pub async fn start(&self, _request: StartScreenShareRequest) -> Result<(), String> {
        Err("Native screen sharing is currently supported on Windows only".to_string())
    }

    #[cfg(target_os = "windows")]
    pub async fn stop(&self) -> Result<(), String> {
        let session = self
            .session
            .lock()
            .expect("screen share session mutex poisoned")
            .take();
        if let Some(mut session) = session {
            windows_impl::stop_capture(&mut session).await?;
            *self
                .session
                .lock()
                .expect("screen share session mutex poisoned") = Some(session);
        }
        let mut status = self
            .status
            .lock()
            .expect("screen share status mutex poisoned");
        status.active = false;
        status.actual_fps = 0.0;
        Ok(())
    }

    #[cfg(target_os = "windows")]
    pub async fn disconnect(&self) -> Result<(), String> {
        let session = self
            .session
            .lock()
            .expect("screen share session mutex poisoned")
            .take();
        if let Some(session) = session {
            windows_impl::disconnect(session).await?;
        }
        *self
            .status
            .lock()
            .expect("screen share status mutex poisoned") = ScreenShareStatus::default();
        Ok(())
    }

    #[cfg(target_os = "windows")]
    pub fn set_microphone_muted(&self, muted: bool) -> Result<(), String> {
        let session = self
            .session
            .lock()
            .expect("screen share session mutex poisoned");
        let session = session
            .as_ref()
            .ok_or_else(|| "Native media is not connected to the call".to_string())?;
        if muted {
            session.microphone.mute();
        } else {
            session.microphone.unmute();
        }
        Ok(())
    }

    #[cfg(not(target_os = "windows"))]
    pub fn set_microphone_muted(&self, _muted: bool) -> Result<(), String> {
        Err("Native media is currently supported on Windows only".to_string())
    }

    #[cfg(target_os = "windows")]
    pub fn set_microphone_device(&self, device_id: &str) -> Result<(), String> {
        let session = self
            .session
            .lock()
            .expect("screen share session mutex poisoned");
        let session = session
            .as_ref()
            .ok_or_else(|| "Native media is not connected to the call".to_string())?;
        let device = session
            .audio
            .recording_devices()
            .find(|device| device.id.as_str() == device_id)
            .ok_or_else(|| "Microphone device is no longer available".to_string())?;
        session
            .audio
            .switch_recording_device(&device.id)
            .map_err(|error| error.to_string())
    }

    #[cfg(not(target_os = "windows"))]
    pub fn set_microphone_device(&self, _device_id: &str) -> Result<(), String> {
        Err("Native media is currently supported on Windows only".to_string())
    }

    #[cfg(not(target_os = "windows"))]
    pub async fn stop(&self) -> Result<(), String> {
        Ok(())
    }

    #[cfg(not(target_os = "windows"))]
    pub async fn disconnect(&self) -> Result<(), String> {
        Ok(())
    }
}

#[cfg(target_os = "windows")]
pub fn list_capture_sources() -> Result<Vec<CaptureSource>, String> {
    windows_impl::list_capture_sources()
}

#[cfg(target_os = "windows")]
pub fn list_audio_input_devices() -> Result<Vec<NativeAudioInputDevice>, String> {
    windows_impl::list_audio_input_devices()
}

#[cfg(not(target_os = "windows"))]
pub fn list_capture_sources() -> Result<Vec<CaptureSource>, String> {
    Ok(Vec::new())
}

#[cfg(not(target_os = "windows"))]
pub fn list_audio_input_devices() -> Result<Vec<NativeAudioInputDevice>, String> {
    Ok(Vec::new())
}

#[cfg(target_os = "windows")]
mod windows_impl {
    use super::{
        CaptureSource, ConnectNativeMediaRequest, NativeAudioInputDevice, ScreenShareStatus,
        StartScreenShareRequest,
    };
    use livekit::options::{
        DegradationPreference, TrackPublishOptions, VideoCodec, VideoEncoderBackend, VideoEncoding,
    };
    use livekit::track::{LocalAudioTrack, LocalTrack, LocalVideoTrack, TrackSource};
    use livekit::webrtc::native::yuv_helper;
    use livekit::webrtc::prelude::{
        I420Buffer, RtcVideoSource, VideoFrame, VideoResolution, VideoRotation,
    };
    use livekit::webrtc::video_source::native::NativeVideoSource;
    use livekit::{PlatformAudio, Room, RoomOptions};
    use std::error::Error;
    use std::ffi::c_void;
    use std::sync::{Arc, Mutex};
    use std::time::{Duration, Instant};
    use tokio::task::JoinHandle;
    use windows_capture::capture::{CaptureControl, Context, GraphicsCaptureApiHandler};
    use windows_capture::frame::Frame;
    use windows_capture::graphics_capture_api::InternalCaptureControl;
    use windows_capture::monitor::Monitor;
    use windows_capture::settings::{
        ColorFormat, CursorCaptureSettings, DirtyRegionSettings, DrawBorderSettings,
        GraphicsCaptureItemType, MinimumUpdateIntervalSettings, SecondaryWindowSettings, Settings,
    };
    use windows_capture::window::Window;

    type CaptureError = Box<dyn Error + Send + Sync>;
    type NativeCaptureControl = CaptureControl<ScreenCaptureHandler, CaptureError>;

    struct ActiveCapture {
        control: NativeCaptureControl,
        track: LocalVideoTrack,
    }

    pub struct NativeScreenShareSession {
        room: Arc<Room>,
        event_task: JoinHandle<()>,
        capture: Option<ActiveCapture>,
        pub(super) audio: PlatformAudio,
        pub(super) microphone: LocalAudioTrack,
    }

    #[derive(Clone)]
    struct CaptureFlags {
        source: NativeVideoSource,
        status: Arc<Mutex<ScreenShareStatus>>,
        target_width: u32,
        target_height: u32,
        target_fps: u32,
    }

    struct ScreenCaptureHandler {
        flags: CaptureFlags,
        last_frame_at: Instant,
        fps_window_started_at: Instant,
        fps_window_frames: u64,
    }

    impl GraphicsCaptureApiHandler for ScreenCaptureHandler {
        type Flags = CaptureFlags;
        type Error = CaptureError;

        fn new(ctx: Context<Self::Flags>) -> Result<Self, Self::Error> {
            let now = Instant::now();
            Ok(Self {
                flags: ctx.flags,
                last_frame_at: now.checked_sub(Duration::from_secs(1)).unwrap_or(now),
                fps_window_started_at: now,
                fps_window_frames: 0,
            })
        }

        fn on_frame_arrived(
            &mut self,
            frame: &mut Frame,
            _capture_control: InternalCaptureControl,
        ) -> Result<(), Self::Error> {
            let minimum_interval = Duration::from_secs_f64(1.0 / f64::from(self.flags.target_fps));
            let now = Instant::now();
            if now.duration_since(self.last_frame_at) < minimum_interval {
                let mut status = self
                    .flags
                    .status
                    .lock()
                    .expect("screen share status mutex poisoned");
                status.dropped_frames = status.dropped_frames.saturating_add(1);
                return Ok(());
            }
            self.last_frame_at = now;

            let source_width = frame.width();
            let source_height = frame.height();
            let mut frame_buffer = frame.buffer()?;
            let source_stride = frame_buffer.row_pitch();
            let source_pixels = frame_buffer.as_raw_buffer();

            let mut i420 = I420Buffer::new(source_width, source_height);
            let (stride_y, stride_u, stride_v) = i420.strides();
            let (data_y, data_u, data_v) = i420.data_mut();
            yuv_helper::argb_to_i420(
                source_pixels,
                source_stride,
                data_y,
                stride_y,
                data_u,
                stride_u,
                data_v,
                stride_v,
                source_width as i32,
                source_height as i32,
            );

            let output = if source_width == self.flags.target_width
                && source_height == self.flags.target_height
            {
                i420
            } else {
                i420.scale(
                    self.flags.target_width as i32,
                    self.flags.target_height as i32,
                )
            };
            let video_frame = VideoFrame::new(VideoRotation::VideoRotation0, output);
            self.flags.source.capture_frame(&video_frame);

            self.fps_window_frames = self.fps_window_frames.saturating_add(1);
            let elapsed = now.duration_since(self.fps_window_started_at);
            let mut status = self
                .flags
                .status
                .lock()
                .expect("screen share status mutex poisoned");
            status.actual_width = self.flags.target_width;
            status.actual_height = self.flags.target_height;
            status.captured_frames = status.captured_frames.saturating_add(1);
            if elapsed >= Duration::from_secs(1) {
                status.actual_fps = self.fps_window_frames as f64 / elapsed.as_secs_f64();
                self.fps_window_frames = 0;
                self.fps_window_started_at = now;
            }
            Ok(())
        }

        fn on_closed(&mut self) -> Result<(), Self::Error> {
            let mut status = self
                .flags
                .status
                .lock()
                .expect("screen share status mutex poisoned");
            status.active = false;
            status.error = Some("The selected capture source was closed".to_string());
            Ok(())
        }
    }

    pub fn list_capture_sources() -> Result<Vec<CaptureSource>, String> {
        let mut sources = Vec::new();
        let primary_handle = Monitor::primary()
            .ok()
            .map(|monitor| monitor.as_raw_hmonitor() as usize);

        for monitor in Monitor::enumerate().map_err(|error| error.to_string())? {
            let index = monitor.index().map_err(|error| error.to_string())?;
            let width = monitor.width().map_err(|error| error.to_string())?;
            let height = monitor.height().map_err(|error| error.to_string())?;
            let name = monitor
                .name()
                .or_else(|_| monitor.device_name())
                .unwrap_or_else(|_| format!("Display {index}"));
            sources.push(CaptureSource {
                id: format!("monitor:{index}"),
                kind: "monitor".to_string(),
                name,
                width,
                height,
                is_primary: primary_handle == Some(monitor.as_raw_hmonitor() as usize),
            });
        }

        for window in Window::enumerate().map_err(|error| error.to_string())? {
            let title = match window.title() {
                Ok(title) if !title.trim().is_empty() => title,
                _ => continue,
            };
            let width = window.width().unwrap_or_default().max(0) as u32;
            let height = window.height().unwrap_or_default().max(0) as u32;
            if width < 64 || height < 64 {
                continue;
            }
            sources.push(CaptureSource {
                id: format!("window:{:x}", window.as_raw_hwnd() as usize),
                kind: "window".to_string(),
                name: title,
                width,
                height,
                is_primary: false,
            });
        }

        Ok(sources)
    }

    pub fn list_audio_input_devices() -> Result<Vec<NativeAudioInputDevice>, String> {
        let audio = PlatformAudio::new().map_err(|error| error.to_string())?;
        Ok(audio
            .recording_devices()
            .enumerate()
            .map(|(index, device)| NativeAudioInputDevice {
                id: device.id.to_string(),
                name: device.name,
                is_default: index == 0,
            })
            .collect())
    }

    pub async fn start(
        mut session: NativeScreenShareSession,
        request: StartScreenShareRequest,
        status: Arc<Mutex<ScreenShareStatus>>,
    ) -> (NativeScreenShareSession, Result<(), String>) {
        let target_width = request.width.clamp(640, 3840);
        let target_height = request.height.clamp(360, 2160);
        let target_fps = request.fps.clamp(15, 60);
        let bitrate_kbps = request.bitrate_kbps.clamp(2_500, 50_000);

        if let Err(error) = stop_capture(&mut session).await {
            return (session, Err(error));
        }

        let rtc_source = NativeVideoSource::new(
            VideoResolution {
                width: target_width,
                height: target_height,
            },
            true,
        );
        let track = LocalVideoTrack::create_video_track(
            "lxlink-native-screen",
            RtcVideoSource::Native(rtc_source.clone()),
        );
        let available_encoders: Vec<_> =
            VideoEncoderBackend::list_available().into_iter().collect();
        let encoder = if available_encoders.contains(&VideoEncoderBackend::Nvenc) {
            VideoEncoderBackend::Nvenc
        } else if available_encoders.contains(&VideoEncoderBackend::Hardware) {
            VideoEncoderBackend::Hardware
        } else {
            VideoEncoderBackend::Auto
        };
        let publish_options = TrackPublishOptions {
            source: TrackSource::Screenshare,
            video_codec: VideoCodec::H264,
            video_encoding: Some(VideoEncoding {
                max_bitrate: u64::from(bitrate_kbps) * 1_000,
                max_framerate: f64::from(target_fps),
            }),
            video_encoder: encoder,
            simulcast: false,
            degradation_preference: Some(DegradationPreference::MaintainResolution),
            ..Default::default()
        };
        if let Err(error) = session
            .room
            .local_participant()
            .publish_track(LocalTrack::Video(track.clone()), publish_options)
            .await
        {
            return (
                session,
                Err(format!("Unable to publish native screen track: {error}")),
            );
        }

        let flags = CaptureFlags {
            source: rtc_source,
            status: Arc::clone(&status),
            target_width,
            target_height,
            target_fps,
        };
        let control = match start_capture(&request.source_id, flags, target_fps) {
            Ok(control) => control,
            Err(error) => {
                let _ = session
                    .room
                    .local_participant()
                    .unpublish_track(&track.sid())
                    .await;
                return (
                    session,
                    Err(format!("Unable to start Windows Graphics Capture: {error}")),
                );
            }
        };
        session.capture = Some(ActiveCapture { control, track });

        let mut current = status.lock().expect("screen share status mutex poisoned");
        *current = ScreenShareStatus {
            active: true,
            source_id: Some(request.source_id),
            target_width,
            target_height,
            target_fps,
            encoder: format!("{encoder:?}"),
            ..Default::default()
        };
        drop(current);

        (session, Ok(()))
    }

    pub async fn connect(
        request: &ConnectNativeMediaRequest,
    ) -> Result<NativeScreenShareSession, String> {
        let mut room_options = RoomOptions::default();
        room_options.auto_subscribe = false;
        room_options.adaptive_stream = false;
        room_options.dynacast = false;
        let (room, mut room_events) =
            Room::connect(&request.livekit_url, &request.token, room_options)
                .await
                .map_err(|error| {
                    format!("Unable to connect native screen share to LiveKit: {error}")
                })?;
        let room = Arc::new(room);
        let event_task = tokio::spawn(async move { while room_events.recv().await.is_some() {} });

        let audio = PlatformAudio::new()
            .map_err(|error| format!("Unable to initialize native microphone: {error}"))?;
        if let Some(device_id) = request.microphone_device_id.as_deref() {
            let device = audio
                .recording_devices()
                .find(|device| device.id.as_str() == device_id)
                .ok_or_else(|| "Selected microphone is no longer available".to_string())?;
            audio
                .set_recording_device(&device.id)
                .map_err(|error| format!("Unable to select microphone: {error}"))?;
        }
        let microphone =
            LocalAudioTrack::create_audio_track("lxlink-native-microphone", audio.rtc_source());
        room.local_participant()
            .publish_track(
                LocalTrack::Audio(microphone.clone()),
                TrackPublishOptions {
                    source: TrackSource::Microphone,
                    ..Default::default()
                },
            )
            .await
            .map_err(|error| format!("Unable to publish native microphone: {error}"))?;
        if request.microphone_enabled {
            microphone.unmute();
        } else {
            microphone.mute();
        }

        Ok(NativeScreenShareSession {
            room,
            event_task,
            capture: None,
            audio,
            microphone,
        })
    }

    fn start_capture(
        source_id: &str,
        flags: CaptureFlags,
        target_fps: u32,
    ) -> Result<NativeCaptureControl, CaptureError> {
        if let Some(index) = source_id.strip_prefix("monitor:") {
            let monitor = Monitor::from_index(index.parse::<usize>()?)?;
            return start_capture_item(monitor, flags, target_fps);
        }
        if let Some(handle) = source_id.strip_prefix("window:") {
            let raw = usize::from_str_radix(handle.trim_start_matches("0x"), 16)?;
            let window = Window::from_raw_hwnd(raw as *mut c_void);
            return start_capture_item(window, flags, target_fps);
        }
        Err(format!("Unknown capture source: {source_id}").into())
    }

    fn start_capture_item<T>(
        item: T,
        flags: CaptureFlags,
        target_fps: u32,
    ) -> Result<NativeCaptureControl, CaptureError>
    where
        T: TryInto<GraphicsCaptureItemType> + Send + 'static,
    {
        let interval = Duration::from_secs_f64(1.0 / f64::from(target_fps));
        let settings = Settings::new(
            item,
            CursorCaptureSettings::WithCursor,
            DrawBorderSettings::WithoutBorder,
            SecondaryWindowSettings::Include,
            MinimumUpdateIntervalSettings::Custom(interval),
            DirtyRegionSettings::ReportAndRender,
            ColorFormat::Bgra8,
            flags,
        );
        ScreenCaptureHandler::start_free_threaded(settings)
            .map_err(|error| error.to_string().into())
    }

    pub async fn stop_capture(session: &mut NativeScreenShareSession) -> Result<(), String> {
        let Some(ActiveCapture { control, track }) = session.capture.take() else {
            return Ok(());
        };
        tokio::task::spawn_blocking(move || control.stop().map_err(|error| error.to_string()))
            .await
            .map_err(|error| format!("Native capture stop task failed: {error}"))??;
        let _ = session
            .room
            .local_participant()
            .unpublish_track(&track.sid())
            .await;
        Ok(())
    }

    pub async fn disconnect(mut session: NativeScreenShareSession) -> Result<(), String> {
        stop_capture(&mut session).await?;
        session
            .room
            .close()
            .await
            .map_err(|error| format!("Unable to close native LiveKit room: {error}"))?;
        session.event_task.abort();
        let _ = session.event_task.await;
        Ok(())
    }
}
