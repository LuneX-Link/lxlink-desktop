import { invoke, invokeStrict, isHostBridgeAvailable } from "./host/bridge"

export interface CaptureSource {
  id: string
  kind: "monitor" | "window"
  name: string
  thumbnail?: string
  width: number
  height: number
  isPrimary?: boolean
}

export interface MediaDevice {
  id: string
  deviceId: string
  name: string
  label: string
  kind: "audioinput" | "audiooutput" | "videoinput"
  isDefault?: boolean
}

export interface MediaDevicesSnapshot {
  audioInputs: MediaDevice[]
  audioOutputs: MediaDevice[]
  videoInputs: MediaDevice[]
}

export interface MediaCapabilities {
  hasCamera: boolean
  hasMicrophone: boolean
  canScreenShare: boolean
}

export interface ChannelMediaToken {
  token: string
  url: string
}

export interface StartVoiceRequest {
  channelId: string
  deviceId?: string
}

export interface StartCameraRequest {
  deviceId?: string
  resolution?: [number, number]
  fps?: number
}

export interface StartScreenShareRequest {
  sourceId: string
  width: number
  height: number
  fps: number
  bitrateKbps: number
}

export interface ConnectNativeMediaRequest {
  livekitUrl: string
  token: string
  microphoneEnabled: boolean
  microphoneDeviceId?: string
}

export interface NativeScreenShareStatus {
  active: boolean
  sourceId: string | null
  targetWidth: number
  targetHeight: number
  targetFps: number
  actualWidth: number
  actualHeight: number
  actualFps: number
  capturedFrames: number
  droppedFrames: number
  encoder: string
  error: string | null
}

export const requestChannelToken = async (
  channelId: string,
  _purpose?: string,
  _variant?: string,
): Promise<ChannelMediaToken> => {
  return await invoke<ChannelMediaToken>("get_voice_token", { channelId })
}

export const startVoiceNative = async (_request: StartVoiceRequest): Promise<void> => {
  // Voice handled by Rust + LiveKit integration.
}

export const stopVoiceNative = async (): Promise<void> => {
  // Voice handled by Rust + LiveKit integration.
}

export const startCameraNative = async (_request: StartCameraRequest): Promise<void> => {
  // Camera is currently handled in the browser layer.
}

export const stopCameraNative = async (): Promise<void> => {
  // Camera is currently handled in the browser layer.
}

export const startScreenShareNative = async (request: StartScreenShareRequest): Promise<void> => {
  await invokeStrict("start_native_screen_share", { request })
}

export const connectNativeMedia = async (request: ConnectNativeMediaRequest): Promise<void> => {
  await invokeStrict("connect_native_media", { request })
}

export const disconnectNativeMedia = async (): Promise<void> => {
  await invokeStrict("disconnect_native_media")
}

export const setMicrophoneMutedNative = async (muted: boolean): Promise<void> => {
  await invokeStrict("set_native_microphone_muted", { muted })
}

export const setMicrophoneDeviceNative = async (deviceId: string): Promise<void> => {
  await invokeStrict("set_native_microphone_device", { deviceId })
}

export const stopScreenShareNative = async (): Promise<void> => {
  await invokeStrict("stop_native_screen_share")
}

export const getScreenShareStatusNative = async (): Promise<NativeScreenShareStatus> => {
  return await invokeStrict<NativeScreenShareStatus>("get_native_screen_share_status")
}

export const connectLivekitNative = async (
  requestOrUrl: { livekitUrl: string; token: string } | string,
  token?: string,
): Promise<void> => {
  const payload = typeof requestOrUrl === "string"
    ? { url: requestOrUrl, token: token ?? "" }
    : { url: requestOrUrl.livekitUrl, token: requestOrUrl.token }

  await invoke("join_voice", { channelId: payload.url }).catch(() => undefined)
}

export const disconnectLivekitNative = async (): Promise<void> => {
  await invoke("leave_voice").catch(() => undefined)
}

export const listAudioInputDevicesNative = async (): Promise<MediaDevice[]> => {
  if (isHostBridgeAvailable()) {
    const devices = await invokeStrict<Array<{ id: string; name: string; isDefault: boolean }>>(
      "list_native_audio_input_devices",
    )
    return devices.map((device) => ({
      id: device.id,
      deviceId: device.id,
      name: device.name,
      label: device.name,
      kind: "audioinput" as const,
      isDefault: device.isDefault,
    }))
  }

  const devices = await navigator.mediaDevices.enumerateDevices()
  return devices
    .filter((device) => device.kind === "audioinput")
    .map((device, index) => ({
      id: device.deviceId,
      deviceId: device.deviceId,
      name: device.label || `Microphone ${device.deviceId.slice(0, 8)}`,
      label: device.label || `Microphone ${device.deviceId.slice(0, 8)}`,
      kind: "audioinput" as const,
      isDefault: index === 0,
    }))
}

export const listMediaDevicesNative = async (): Promise<MediaDevicesSnapshot> => {
  const [audioInputs, devices] = await Promise.all([
    listAudioInputDevicesNative(),
    navigator.mediaDevices.enumerateDevices(),
  ])
  return {
    audioInputs,
    audioOutputs: devices
      .filter((device) => device.kind === "audiooutput")
      .map((device, index) => ({
        id: device.deviceId,
        deviceId: device.deviceId,
        name: device.label || `Speaker ${device.deviceId.slice(0, 8)}`,
        label: device.label || `Speaker ${device.deviceId.slice(0, 8)}`,
        kind: "audiooutput" as const,
        isDefault: index === 0,
      })),
    videoInputs: devices
      .filter((device) => device.kind === "videoinput")
      .map((device, index) => ({
        id: device.deviceId,
        deviceId: device.deviceId,
        name: device.label || `Camera ${device.deviceId.slice(0, 8)}`,
        label: device.label || `Camera ${device.deviceId.slice(0, 8)}`,
        kind: "videoinput" as const,
        isDefault: index === 0,
      })),
  }
}

export const listCaptureSourcesNative = async (): Promise<CaptureSource[]> => {
  return await invokeStrict<CaptureSource[]>("list_native_capture_sources")
}
