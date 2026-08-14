import { useCallback, useEffect, useMemo, useState } from "react"
import { invoke } from "@tauri-apps/api/core"

export type CaptureMode = "Auto" | "Nvidia" | "Amd" | "Intel" | "Cpu"
export type EncoderKind = "Nvenc" | "Amf" | "QuickSync" | "Cpu"

export interface CaptureConfig {
  mode: CaptureMode
  fps: number
  width: number
  height: number
  bitrateKbps?: number
  bitratKbps?: number
}

export interface DetectionResult {
  gpuVendor: string
  encoder: EncoderKind
}

export interface CaptureStatus {
  isCapturing: boolean
  config: CaptureConfig | null
  detected: DetectionResult
  error: string | null
}

interface BackendDetectionResult {
  gpuVendor?: string
  gpu_vendor?: string
  vendor?: string
  encoder: EncoderKind
}

interface BackendCaptureStatus {
  isCapturing?: boolean
  is_capturing?: boolean
  config: (CaptureConfig & { bitrate_kbps?: number }) | null
  detected: BackendDetectionResult
  error: string | null
}

const toBackendConfig = (config: CaptureConfig) => ({
  mode: config.mode,
  fps: config.fps,
  width: config.width,
  height: config.height,
  bitrateKbps: config.bitrateKbps ?? config.bitratKbps ?? 8_000,
})

const normalizeStatus = (status: BackendCaptureStatus): CaptureStatus => ({
  isCapturing: status.isCapturing ?? status.is_capturing ?? false,
  config: status.config
    ? {
        mode: status.config.mode,
        fps: status.config.fps,
        width: status.config.width,
        height: status.config.height,
        bitrateKbps: status.config.bitrateKbps ?? status.config.bitratKbps ?? status.config.bitrate_kbps,
      }
    : null,
  detected: {
    gpuVendor: status.detected.gpuVendor ?? status.detected.gpu_vendor ?? status.detected.vendor ?? "CPU",
    encoder: status.detected.encoder,
  },
  error: status.error,
})

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : typeof error === "string" ? error : "Screen capture failed"

export const useScreenCapture = () => {
  const [isCapturing, setIsCapturing] = useState(false)
  const [gpuVendor, setGpuVendor] = useState("CPU")
  const [error, setError] = useState<string | null>(null)
  const [captureStatus, setCaptureStatus] = useState<CaptureStatus | null>(null)

  const getGpuVendor = useCallback(async (): Promise<string> => {
    const vendor = await invoke<string>("get_gpu_vendor")
    setGpuVendor(vendor)
    return vendor
  }, [])

  const getCaptureStatus = useCallback(async (): Promise<CaptureStatus> => {
    const status = normalizeStatus(await invoke<BackendCaptureStatus>("get_capture_status"))
    setCaptureStatus(status)
    setIsCapturing(status.isCapturing)
    setGpuVendor(status.detected.gpuVendor)
    setError(status.error)
    return status
  }, [])

  const startCapture = useCallback(
    async (config: CaptureConfig): Promise<void> => {
      setError(null)
      try {
        await invoke("start_capture", { config: toBackendConfig(config) })
        await getCaptureStatus()
      } catch (caught) {
        const message = getErrorMessage(caught)
        setError(message)
        throw caught
      }
    },
    [getCaptureStatus],
  )

  const stopCapture = useCallback(async (): Promise<void> => {
    setError(null)
    try {
      await invoke("stop_capture")
      await getCaptureStatus()
    } catch (caught) {
      const message = getErrorMessage(caught)
      setError(message)
      throw caught
    }
  }, [getCaptureStatus])

  useEffect(() => {
    void getGpuVendor().catch((caught) => setError(getErrorMessage(caught)))
    void getCaptureStatus().catch((caught) => setError(getErrorMessage(caught)))
  }, [getCaptureStatus, getGpuVendor])

  return useMemo(
    () => ({
      isCapturing,
      gpuVendor,
      error,
      captureStatus,
      startCapture,
      stopCapture,
      start: startCapture,
      stop: stopCapture,
      getGpuVendor,
      getCaptureStatus,
    }),
    [captureStatus, error, getCaptureStatus, getGpuVendor, gpuVendor, isCapturing, startCapture, stopCapture],
  )
}
