"use client"

import type React from "react"
import { useState, useEffect, useRef, useCallback } from "react"
import {
  Mic,
  Volume2,
  Camera,
  Video,
  Monitor,
  Headphones,
  Zap,
  Check,
  ChevronDown,
  ChevronUp,
  Keyboard,
} from "lucide-react"
import { createPortal } from "react-dom"
import { CheckboxField } from "../../ui/checkbox-field/checkbox-field"
import { Button } from "../../ui/button/button"
import { AudioLevelIndicator } from "../../audio-level-indicator/audio-level-indicator"
import { DeviceTestModal } from "../../device-test-modal/device-test-modal"
import { useTranslation } from "react-i18next"
import cn from "classnames"
import "./voice-video-section.scss"

// ─── Types ──────────────────────────────────────────────────────────────

interface AudioDevice {
  deviceId: string
  label: string
  kind: "audioinput" | "audiooutput" | "videoinput"
}

interface VoiceVideoSectionProps {
  audioDevices: AudioDevice[]
  selectedMicId: string
  selectedSpeakerId: string
  selectedCameraId: string
  onMicChange: (deviceId: string) => void
  onSpeakerChange: (deviceId: string) => void
  onCameraChange: (deviceId: string) => void
  onRefreshDevices: () => void
  inputVolume: number
  outputVolume: number
  onInputVolumeChange: (value: number) => void
  onOutputVolumeChange: (value: number) => void
  noiseSuppression: boolean
  echoCancellation: boolean
  autoGainControl: boolean
  voiceActivityDetection: boolean
  hardwareMute: boolean
  autoAdjustMic: boolean
  pushToTalk: boolean
  onNoiseSuppressionChange: (value: boolean) => void
  onEchoCancellationChange: (value: boolean) => void
  onAutoGainControlChange: (value: boolean) => void
  onVoiceActivityDetectionChange: (value: boolean) => void
  onHardwareMuteChange: (value: boolean) => void
  onAutoAdjustMicChange: (value: boolean) => void
  onPushToTalkChange: (value: boolean) => void
  videoQuality: string
  videoFps: string
  screenShareQuality: string
  screenShareFps: string
  hardwareAcceleration: boolean
  onVideoQualityChange: (value: string) => void
  onVideoFpsChange: (value: string) => void
  onScreenShareQualityChange: (value: string) => void
  onScreenShareFpsChange: (value: string) => void
  onHardwareAccelerationChange: (value: boolean) => void
  screenShareCodec: string
  onScreenShareCodecChange: (value: string) => void
  screenShareGpu: string
  onScreenShareGpuChange: (value: string) => void
  ax3dEnabled: boolean
  onAx3dChange: (value: boolean) => void
  pushToTalkKey: string
  onPushToTalkKeyChange: (key: string) => void
}

// ─── Device Dropdown ────────────────────────────────────────────────────

const DeviceDropdown: React.FC<{
  devices: AudioDevice[]
  selectedId: string
  onSelect: (id: string) => void
  label: string
  icon: React.ReactNode
  placeholder?: string
}> = ({ devices, selectedId, onSelect, label, icon, placeholder }) => {
  const [isOpen, setIsOpen] = useState(false)
  const [menuPos, setMenuPos] = useState<"bottom" | "top">("bottom")
  const ref = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)

  const selected = devices.find((d) => d.deviceId === selectedId)

  useEffect(() => {
    if (!isOpen) return

    // Prevent modal scroll when dropdown is open
    const modalContent = document.querySelector('.settings-modal') as HTMLElement | null
    if (modalContent) {
      modalContent.style.overflow = 'hidden'
    }

    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setIsOpen(false)
    }

    const timer = setTimeout(() => {
      document.addEventListener("mousedown", handler)
    }, 0)

    return () => {
      clearTimeout(timer)
      document.removeEventListener("mousedown", handler)
      // Restore modal scroll
      if (modalContent) {
        modalContent.style.overflow = ''
      }
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen || !triggerRef.current) return

    const rect = triggerRef.current.getBoundingClientRect()
    const spaceBelow = window.innerHeight - rect.bottom
    setMenuPos(spaceBelow < 220 ? "top" : "bottom")
  }, [isOpen])

  const handleItemMouseDown = useCallback(
    (e: React.MouseEvent, deviceId: string) => {
      e.preventDefault()
      onSelect(deviceId)
      setIsOpen(false)
    },
    [onSelect],
  )

  return (
    <div className="dd" ref={ref}>
      <div className="dd__label">
        <span className="dd__label-icon">{icon}</span>
        {label}
      </div>

      <button
        ref={triggerRef}
        className={cn("dd__trigger", { "dd__trigger--open": isOpen })}
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="dd__value">{selected?.label || placeholder || "Default"}</span>
        {isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>

      {isOpen &&
        createPortal(
          <div
            className={cn("dd__menu", { "dd__menu--top": menuPos === "top" })}
            style={{
              position: "fixed",
              left: triggerRef.current?.getBoundingClientRect().left ?? 0,
              top:
                menuPos === "top"
                  ? (triggerRef.current?.getBoundingClientRect().top ?? 0) - 4
                  : (triggerRef.current?.getBoundingClientRect().bottom ?? 0) + 4,
              width: triggerRef.current?.getBoundingClientRect().width ?? 200,
            }}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className={cn("dd__item", { "dd__item--active": !selectedId })}
              onMouseDown={(e) => handleItemMouseDown(e, "")}
            >
              <span>{placeholder || "Default"}</span>
              {!selectedId && <Check size={12} />}
            </button>

            {devices.map((d) => (
              <button
                key={d.deviceId}
                className={cn("dd__item", { "dd__item--active": d.deviceId === selectedId })}
                onMouseDown={(e) => handleItemMouseDown(e, d.deviceId)}
              >
                <span className="dd__item-label">{d.label || `Device ${d.deviceId.slice(0, 8)}`}</span>
                {d.deviceId === selectedId && <Check size={12} />}
              </button>
            ))}
          </div>,
          document.body,
        )}
    </div>
  )
}

// ─── Volume Slider ──────────────────────────────────────────────────────

const VolumeSlider: React.FC<{
  value: number
  onChange: (v: number) => void
  icon: React.ReactNode
  label: string
}> = ({ value, onChange, icon, label }) => {
  return (
    <div className="vs">
      <div className="vs__header">
        <span className="vs__icon">{icon}</span>
        <span className="vs__label">{label}</span>
        <span className="vs__value">{value}%</span>
      </div>

      <div className="vs__track-wrap">
        <input
          type="range"
          min={0}
          max={100}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="vs__input"
        />

        <div className="vs__track">
          <div className="vs__fill" style={{ width: `${value}%` }} />
        </div>

        <div className="vs__thumb" style={{ left: `${value}%` }} />
      </div>
    </div>
  )
}

// ─── Keybind Button ────────────────────────────────────────────────────

const KeybindButton: React.FC<{
  label: string
  value: string
  onBind: (key: string) => void
  icon: React.ReactNode
}> = ({ label, value, onBind, icon }) => {
  const [isListening, setIsListening] = useState(false)

  useEffect(() => {
    if (!isListening) return

    const handler = (e: KeyboardEvent) => {
      e.preventDefault()
      e.stopPropagation()
      onBind(e.key === " " ? "Space" : e.key)
      setIsListening(false)
    }

    window.addEventListener("keydown", handler, { once: true })
    return () => window.removeEventListener("keydown", handler)
  }, [isListening, onBind])

  return (
    <div className="kb-row">
      <div className="kb-row__label">
        <span className="kb-row__icon">{icon}</span>
        {label}
      </div>

      <button
        className={cn("kb-row__btn", { "kb-row__btn--active": isListening })}
        onClick={() => setIsListening(!isListening)}
      >
        {isListening ? "..." : value || "None"}
      </button>
    </div>
  )
}

// ─── Main Component ─────────────────────────────────────────────────────

export const VoiceVideoSection: React.FC<VoiceVideoSectionProps> = (props) => {
  const {
    audioDevices,
    selectedMicId,
    selectedSpeakerId,
    selectedCameraId,
    onMicChange,
    onSpeakerChange,
    onCameraChange,
    inputVolume,
    outputVolume,
    onInputVolumeChange,
    onOutputVolumeChange,
    noiseSuppression,
    echoCancellation,
    autoGainControl,
    voiceActivityDetection,
    hardwareMute,
    autoAdjustMic,
    pushToTalk,
    onNoiseSuppressionChange,
    onEchoCancellationChange,
    onAutoGainControlChange,
    onVoiceActivityDetectionChange,
    onHardwareMuteChange,
    onAutoAdjustMicChange,
    onPushToTalkChange,
    videoQuality,
    videoFps,
    screenShareQuality,
    screenShareFps,
    hardwareAcceleration,
    onVideoQualityChange,
    onVideoFpsChange,
    onScreenShareQualityChange,
    onScreenShareFpsChange,
    onHardwareAccelerationChange,
    screenShareGpu,
    onScreenShareGpuChange,
    ax3dEnabled,
    onAx3dChange,
    pushToTalkKey,
    onPushToTalkKeyChange,
  } = props

  const { t } = useTranslation("settings")

  const [cameraPreviewStream, setCameraPreviewStream] = useState<MediaStream | null>(null)
  const [isDeviceTestOpen, setIsDeviceTestOpen] = useState(false)
  const cameraPreviewRef = useRef<HTMLVideoElement>(null)

  const micDevices = audioDevices.filter((d) => d.kind === "audioinput")
  const speakerDevices = audioDevices.filter((d) => d.kind === "audiooutput")
  const cameraDevices = audioDevices.filter((d) => d.kind === "videoinput")

  const startCameraPreview = useCallback(async () => {
    try {
      if (cameraPreviewStream) cameraPreviewStream.getTracks().forEach((t) => t.stop())

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          deviceId: selectedCameraId ? { exact: selectedCameraId } : undefined,
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      })

      setCameraPreviewStream(stream)
      if (cameraPreviewRef.current) cameraPreviewRef.current.srcObject = stream
    } catch (err) {
      console.error("Camera preview failed:", err)
    }
  }, [selectedCameraId, cameraPreviewStream])

  const stopCameraPreview = useCallback(() => {
    if (cameraPreviewStream) {
      cameraPreviewStream.getTracks().forEach((t) => t.stop())
      setCameraPreviewStream(null)
    }
    if (cameraPreviewRef.current) cameraPreviewRef.current.srcObject = null
  }, [cameraPreviewStream])

  useEffect(() => () => stopCameraPreview(), [stopCameraPreview])

  return (
    <div className="vv">
      {/* Input */}
      <div className="vv-card">
        <div className="vv-card__head">
          <div className="vv-card__icon">
            <Mic size={18} />
          </div>
          <div className="vv-card__text">
            <h3>{t("input_settings")}</h3>
            <p>{t("input_settings_desc")}</p>
          </div>
        </div>

        <div className="vv-card__body">
          <DeviceDropdown
            devices={micDevices}
            selectedId={selectedMicId}
            onSelect={onMicChange}
            label={t("input_device")}
            icon={<Mic size={14} />}
            placeholder="Default Mic"
          />

          <VolumeSlider
            value={inputVolume}
            onChange={onInputVolumeChange}
            icon={<Volume2 size={14} />}
            label={t("input_volume")}
          />

          <AudioLevelIndicator
            deviceId={selectedMicId}
            type="input"
            isActive={Boolean(selectedMicId)}
            barCount={24}
          />

          <div className="vv-sep" />

          <div className="vv-checks">
            <CheckboxField
              label={t("auto_adjust_mic")}
              checked={autoAdjustMic}
              onChange={(e) => onAutoAdjustMicChange(e.target.checked)}
            />

            <CheckboxField
              label={t("push_to_talk")}
              checked={pushToTalk}
              onChange={(e) => onPushToTalkChange(e.target.checked)}
            />
          </div>

          {pushToTalk && (
            <KeybindButton
              label={t("push_to_talk_key")}
              value={pushToTalkKey}
              onBind={onPushToTalkKeyChange}
              icon={<Keyboard size={14} />}
            />
          )}
        </div>
      </div>

      {/* Output */}
      <div className="vv-card">
        <div className="vv-card__head">
          <div className="vv-card__icon">
            <Headphones size={18} />
          </div>
          <div className="vv-card__text">
            <h3>{t("output_settings")}</h3>
            <p>{t("output_settings_desc")}</p>
          </div>
        </div>

        <div className="vv-card__body">
          <DeviceDropdown
            devices={speakerDevices}
            selectedId={selectedSpeakerId}
            onSelect={onSpeakerChange}
            label={t("output_device")}
            icon={<Headphones size={14} />}
            placeholder="Default Speaker"
          />

          <VolumeSlider
            value={outputVolume}
            onChange={onOutputVolumeChange}
            icon={<Volume2 size={14} />}
            label={t("output_volume")}
          />
        </div>
      </div>

      {/* Video */}
      <div className="vv-card">
        <div className="vv-card__head">
          <div className="vv-card__icon">
            <Camera size={18} />
          </div>
          <div className="vv-card__text">
            <h3>{t("video_settings")}</h3>
            <p>{t("video_settings_desc")}</p>
          </div>
        </div>

        <div className="vv-card__body">
          <div className="vv-video-grid">
            <div className="vv-preview">
              {cameraPreviewStream ? (
                <video ref={cameraPreviewRef} autoPlay playsInline muted className="vv-preview__stream" />
              ) : (
                <div className="vv-preview__empty">
                  <Video size={32} />
                  <span>{t("camera_off")}</span>
                </div>
              )}

              <div className="vv-preview__btn">
                <Button
                  theme={cameraPreviewStream ? "danger" : "primary"}
                  onClick={() => (cameraPreviewStream ? stopCameraPreview() : startCameraPreview())}
                >
                  <Camera size={13} />
                  {cameraPreviewStream ? t("stop_preview") : t("start_preview")}
                </Button>
              </div>
            </div>

            <div className="vv-video-settings">
              <DeviceDropdown
                devices={cameraDevices}
                selectedId={selectedCameraId}
                onSelect={onCameraChange}
                label={t("camera_device")}
                icon={<Camera size={14} />}
                placeholder="Default Camera"
              />

              <div className="vv-pills-row">
                <span className="vv-pills-label">{t("video_quality")}</span>
                <div className="vv-pills">
                  {["4k", "1080p", "720p", "480p"].map((q) => (
                    <button
                      key={q}
                      className={cn("vv-pill", { "vv-pill--active": videoQuality === q })}
                      onClick={() => onVideoQualityChange(q)}
                    >
                      {q === "4k" ? "4K" : q}
                    </button>
                  ))}
                </div>
              </div>

              <div className="vv-pills-row">
                <span className="vv-pills-label">{t("video_fps")}</span>
                <div className="vv-pills">
                  {["60", "30"].map((fps) => (
                    <button
                      key={fps}
                      className={cn("vv-pill", { "vv-pill--active": videoFps === fps })}
                      onClick={() => onVideoFpsChange(fps)}
                    >
                      {fps}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Screen Share */}
      <div className="vv-card">
        <div className="vv-card__head">
          <div className="vv-card__icon">
            <Monitor size={18} />
          </div>
          <div className="vv-card__text">
            <h3>{t("screen_share_settings")}</h3>
            <p>{t("screen_share_settings_desc")}</p>
          </div>
        </div>

        <div className="vv-card__body">
          <div className="vv-pills-row">
            <span className="vv-pills-label">{t("screen_share_quality")}</span>
            <div className="vv-pills">
              {["4k", "1080p", "720p"].map((q) => (
                <button
                  key={q}
                  className={cn("vv-pill", { "vv-pill--active": screenShareQuality === q })}
                  onClick={() => onScreenShareQualityChange(q)}
                >
                  {q === "4k" ? "4K" : q}
                </button>
              ))}
            </div>
          </div>

          <div className="vv-pills-row">
            <span className="vv-pills-label">{t("screen_share_fps")}</span>
            <div className="vv-pills">
              {["60", "30"].map((fps) => (
                <button
                  key={fps}
                  className={cn("vv-pill", { "vv-pill--active": screenShareFps === fps })}
                  onClick={() => onScreenShareFpsChange(fps)}
                >
                  {fps}
                </button>
              ))}
            </div>
          </div>

          <div className="vv-pills-row">
            <span className="vv-pills-label">{t("screen_share_gpu")}</span>
            <div className="vv-pills">
              {["NVENC", "AMF", "QSV", "Software"].map((gpu) => (
                <button
                  key={gpu}
                  className={cn("vv-pill", { "vv-pill--active": screenShareGpu === gpu })}
                  onClick={() => onScreenShareGpuChange(gpu)}
                >
                  {gpu}
                </button>
              ))}
            </div>
          </div>

          <div className="vv-sep" />

          <div className="vv-checks">
            <CheckboxField
              label={t("hardware_acceleration")}
              checked={hardwareAcceleration}
              onChange={(e) => onHardwareAccelerationChange(e.target.checked)}
            />

            <CheckboxField
              label={t("x3d_support")}
              checked={ax3dEnabled}
              onChange={(e) => onAx3dChange(e.target.checked)}
            />

            <span className="vv-note">{t("x3d_support_desc")}</span>
          </div>
        </div>
      </div>

      {/* Voice Processing */}
      <div className="vv-card">
        <div className="vv-card__head">
          <div className="vv-card__icon vv-card__icon">
            <Zap size={18} />
          </div>
          <div className="vv-card__text">
            <h3>{t("voice_processing")}</h3>
            <p>{t("voice_processing_desc")}</p>
          </div>
        </div>

        <div className="vv-card__body">
          <div className="vv-checks">
            <CheckboxField
              label={t("noise_suppression")}
              checked={noiseSuppression}
              onChange={(e) => onNoiseSuppressionChange(e.target.checked)}
            />

            <CheckboxField
              label={t("echo_cancellation")}
              checked={echoCancellation}
              onChange={(e) => onEchoCancellationChange(e.target.checked)}
            />

            <CheckboxField
              label={t("auto_gain_control")}
              checked={autoGainControl}
              onChange={(e) => onAutoGainControlChange(e.target.checked)}
            />

            <CheckboxField
              label={t("voice_activity_detection")}
              checked={voiceActivityDetection}
              onChange={(e) => onVoiceActivityDetectionChange(e.target.checked)}
            />

            <CheckboxField
              label={t("hardware_mute")}
              checked={hardwareMute}
              onChange={(e) => onHardwareMuteChange(e.target.checked)}
            />
          </div>
        </div>
      </div>

      <DeviceTestModal
        visible={isDeviceTestOpen}
        micId={selectedMicId}
        speakerId={selectedSpeakerId}
        cameraId={selectedCameraId}
        onClose={() => setIsDeviceTestOpen(false)}
      />
    </div>
  )
}
