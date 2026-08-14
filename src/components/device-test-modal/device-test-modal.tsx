"use client"

import type React from "react"
import { useCallback, useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { CheckCircle, Mic, Play, Volume2, X } from "lucide-react"
import cn from "classnames"
import { Backdrop } from "../ui/backdrop/backdrop"
import { Button } from "../ui/button/button"
import "./device-test-modal.scss"

interface DeviceTestModalProps {
  visible: boolean
  onClose: () => void
  micId?: string
  speakerId?: string
  cameraId?: string
  onSave?: () => void
}

type Step = "speaker" | "microphone" | "complete"

const createBeep = async (speakerId?: string) => {
  const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!AudioContextClass) throw new Error("AudioContext is not supported")

  const context = new AudioContextClass()
  const oscillator = context.createOscillator()
  const gain = context.createGain()
  const destination = context.createMediaStreamDestination()
  const audio = new Audio()

  oscillator.type = "sine"
  oscillator.frequency.value = 880
  gain.gain.value = 0.18
  oscillator.connect(gain)
  gain.connect(destination)
  audio.srcObject = destination.stream

  if (speakerId && "setSinkId" in audio) {
    await (audio as HTMLAudioElement & { setSinkId: (sinkId: string) => Promise<void> }).setSinkId(speakerId)
  }

  oscillator.start()
  await audio.play()

  window.setTimeout(() => {
    oscillator.stop()
    void audio.pause()
    destination.stream.getTracks().forEach((track) => track.stop())
    void context.close()
  }, 900)
}

export const DeviceTestModal: React.FC<DeviceTestModalProps> = ({ visible, onClose, micId, speakerId, onSave }) => {
  const [isClosing, setIsClosing] = useState(false)
  const [step, setStep] = useState<Step>("speaker")
  const [heardSpeaker, setHeardSpeaker] = useState<boolean | null>(null)
  const [recordingState, setRecordingState] = useState<"idle" | "recording" | "ready" | "error">("idle")
  const [recordingUrl, setRecordingUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const cleanup = useCallback(() => {
    recorderRef.current?.stream.getTracks().forEach((track) => track.stop())
    recorderRef.current = null
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
  }, [])

  useEffect(() => {
    if (!visible) return
    setStep("speaker")
    setHeardSpeaker(null)
    setRecordingState("idle")
    setError(null)
    return cleanup
  }, [cleanup, visible])

  useEffect(() => () => {
    cleanup()
    if (recordingUrl) URL.revokeObjectURL(recordingUrl)
  }, [cleanup, recordingUrl])

  const handleClose = useCallback(() => {
    setIsClosing(true)
    window.setTimeout(() => {
      cleanup()
      onClose()
      setIsClosing(false)
    }, 180)
  }, [cleanup, onClose])

  const playTestSound = useCallback(async () => {
    setError(null)
    try {
      await createBeep(speakerId)
    } catch (unknownError) {
      setError(unknownError instanceof Error ? unknownError.message : "Не удалось воспроизвести тестовый звук")
    }
  }, [speakerId])

  const recordMicrophone = useCallback(async () => {
    setError(null)
    setRecordingState("recording")
    if (recordingUrl) {
      URL.revokeObjectURL(recordingUrl)
      setRecordingUrl(null)
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: micId ? { deviceId: { exact: micId } } : true,
        video: false,
      })
      streamRef.current = stream
      const recorder = new MediaRecorder(stream)
      const chunks: Blob[] = []
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.push(event.data)
      }
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: recorder.mimeType || "audio/webm" })
        setRecordingUrl(URL.createObjectURL(blob))
        setRecordingState("ready")
        stream.getTracks().forEach((track) => track.stop())
      }
      recorderRef.current = recorder
      recorder.start()
      window.setTimeout(() => recorder.state !== "inactive" && recorder.stop(), 3_000)
    } catch (unknownError) {
      cleanup()
      setRecordingState("error")
      setError(unknownError instanceof Error ? unknownError.message : "Не удалось записать микрофон")
    }
  }, [cleanup, micId, recordingUrl])

  const handleSave = useCallback(() => {
    onSave?.()
    handleClose()
  }, [handleClose, onSave])

  if (!visible) return null

  return createPortal(
    <Backdrop isClosing={isClosing} onClick={handleClose}>
      <div className={cn("device-test-modal", { "device-test-modal--closing": isClosing })} role="dialog" onClick={(event) => event.stopPropagation()}>
        <div className="device-test-modal__header">
          <h3 className="device-test-modal__title">Проверить устройства</h3>
          <button type="button" className="device-test-modal__close" onClick={handleClose} aria-label="Закрыть">
            <X size={20} />
          </button>
        </div>

        <div className="device-test-modal__content">
          {step === "speaker" && (
            <section className="device-test-modal__section">
              <div className="device-test-modal__section-header">
                <Volume2 size={20} />
                <span className="device-test-modal__section-title">Тест динамиков</span>
              </div>
              <p>Воспроизведите тестовый звук и подтвердите, слышали ли вы его.</p>
              <Button theme="outline" onClick={playTestSound}><Play size={16} /> Воспроизвести тестовый звук</Button>
              <div className="device-test-modal__actions">
                <Button theme={heardSpeaker === true ? "primary" : "outline"} onClick={() => setHeardSpeaker(true)}>Слышали?</Button>
                <Button theme={heardSpeaker === false ? "danger" : "outline"} onClick={() => setHeardSpeaker(false)}>Не слышали</Button>
                <Button theme="primary" disabled={heardSpeaker === null} onClick={() => setStep("microphone")}>Далее</Button>
              </div>
            </section>
          )}

          {step === "microphone" && (
            <section className="device-test-modal__section">
              <div className="device-test-modal__section-header">
                <Mic size={20} />
                <span className="device-test-modal__section-title">Тест микрофона</span>
              </div>
              <p>Запишите 3 секунды с выбранного микрофона, затем прослушайте запись.</p>
              <Button theme="outline" disabled={recordingState === "recording"} onClick={recordMicrophone}>
                {recordingState === "recording" ? "Идёт запись…" : "Записать 3 секунды"}
              </Button>
              {recordingUrl && <audio controls src={recordingUrl} className="device-test-modal__recording" />}
              {recordingState === "ready" && <p className="device-test-modal__success"><CheckCircle size={16} /> Запись готова к воспроизведению.</p>}
              <div className="device-test-modal__actions">
                <Button theme="outline" onClick={() => setStep("speaker")}>Назад</Button>
                <Button theme="primary" disabled={!recordingUrl} onClick={() => setStep("complete")}>Далее</Button>
              </div>
            </section>
          )}

          {step === "complete" && (
            <section className="device-test-modal__section">
              <CheckCircle size={28} />
              <h4>Проверка завершена</h4>
              <p>Сохраните выбранные устройства для голосовых вызовов.</p>
            </section>
          )}

          {error && <p className="device-test-modal__error">{error}</p>}
        </div>

        <div className="device-test-modal__footer">
          <Button theme="outline" onClick={handleClose}>Отмена</Button>
          <Button theme="primary" disabled={step !== "complete"} onClick={handleSave}>Сохранить</Button>
        </div>
      </div>
    </Backdrop>,
    document.body,
  )
}

export default DeviceTestModal
