"use client"

import type React from "react"
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react"
import {
  Room,
  RoomEvent,
  Track,
  type LocalParticipant,
  type RemoteParticipant,
} from "livekit-client"

import { IncomingCallModal } from "../components/call/incoming-call-modal"
import { callsApi } from "../lib/api/callsApi"
import { channelsApi } from "../lib/api/channelsApi"
import { isHostBridgeAvailable } from "../lib/host/bridge"
import {
  connectNativeMedia,
  disconnectNativeMedia,
  getScreenShareStatusNative,
  listMediaDevicesNative,
  setMicrophoneDeviceNative,
  setMicrophoneMutedNative,
  startScreenShareNative,
  stopScreenShareNative,
  type MediaDevice,
  type NativeScreenShareStatus,
} from "../lib/media"
import { supabase } from "../lib/supabase"
import type { Call, IncomingCall } from "../types/calls"
import { useAuthSession } from "./auth-context"

type ParticipantVideoTrack =
  | MediaStreamTrack
  | {
      mediaStreamTrack?: MediaStreamTrack
      attach?: (element?: HTMLMediaElement) => HTMLMediaElement | HTMLMediaElement[]
      detach?: (element?: HTMLMediaElement) => HTMLMediaElement[]
    }
  | null

type TrackPublicationLike = {
  source?: Track.Source
  isMuted?: boolean
  kind?: Track.Kind
  track?: {
    mediaStreamTrack?: MediaStreamTrack
    attach?: (element?: HTMLMediaElement) => HTMLMediaElement | HTMLMediaElement[]
    detach?: (element?: HTMLMediaElement) => HTMLMediaElement[]
  } | null
}

export interface ParticipantInfo {
  id: string
  name: string
  identity: string
  isSpeaking: boolean
  isMuted: boolean
  isCameraOn: boolean
  isScreenSharing: boolean
  connectionQuality: string
  audioLevel: number
  videoTrack?: ParticipantVideoTrack | null
  audioTrack?: TrackPublicationLike | null
  previewThumbnail?: string | null
  isLocal: boolean
}

export type ConnectionState = "disconnected" | "connecting" | "connected" | "reconnecting"

export type ScreenShareQuality = "720p" | "1080p" | "1440p" | "4k"
export type ScreenShareFps = "15" | "30" | "60"

export interface ScreenShareSettingsInput {
  quality: ScreenShareQuality
  fps: ScreenShareFps
  audio: boolean
}

export type ScreenShareLivekitQuality = "excellent" | "good" | "fair" | "poor" | "unknown"

export interface ScreenShareLivekitStats {
  fpsActual: number | null
  targetFps: number
  bitrateKbps: number | null
  expectedBitrateKbps: number
  currentResolution: [number, number] | null
  targetResolution: [number, number]
  packetLossPercent: number | null
  packetsLost: number | null
  jitterMs: number | null
  codec: string | null
  quality: ScreenShareLivekitQuality
  updatedAt: number
}

interface CallContextValue {
  connectionState: ConnectionState
  isConnected: boolean
  isConnecting: boolean
  error: string | null
  currentCall: Call | null
  incomingCall: IncomingCall | null

  localParticipant: ParticipantInfo | null
  isMuted: boolean
  isCameraOn: boolean
  isScreenSharing: boolean
  screenShareAvailable: boolean
  screenShareUnavailableReason: string | null
  isDeafened: boolean

  participants: ParticipantInfo[]
  participantCount: number

  roomName: string
  screenShareStats: ScreenShareLivekitStats | null

  connect: (channelId: string, userId: string, userName: string) => Promise<void>
  disconnect: () => Promise<void>
  endForAll: () => Promise<void>
  acceptIncoming: () => Promise<void>
  declineIncoming: () => Promise<void>
  toggleMicrophone: () => Promise<void>
  toggleCamera: () => Promise<void>
  toggleScreenShare: (
    sourceId?: string,
    settings?: ScreenShareSettingsInput,
    previewThumbnail?: string,
  ) => Promise<void>
  toggleDeafen: () => void

  setAudioDevice: (deviceId: string) => Promise<void>
  setVideoDevice: (deviceId: string) => Promise<void>
  setAudioOutputDevice: (deviceId: string) => Promise<void>

  setInitialMicState: (muted: boolean) => void
  setInitialCameraState: (enabled: boolean) => void

  audioInputDevices: MediaDevice[]
  audioOutputDevices: MediaDevice[]
  videoInputDevices: MediaDevice[]
  selectedAudioInput: string
  selectedAudioOutput: string
  selectedVideoInput: string
  refreshDevices: () => Promise<void>
}

const CallContext = createContext<CallContextValue | null>(null)

export const useCall = () => {
  const context = useContext(CallContext)
  if (!context) throw new Error("useCall must be used within a CallProvider")
  return context
}

const QUALITY_TO_RESOLUTION: Record<ScreenShareQuality, [number, number]> = {
  "720p": [1280, 720],
  "1080p": [1920, 1080],
  "1440p": [2560, 1440],
  "4k": [3840, 2160],
}

const DEFAULT_SHARE_SETTINGS: ScreenShareSettingsInput = {
  quality: "4k",
  fps: "60",
  audio: false,
}

const screenShareBitrate = (width: number, height: number, fps: number) => {
  if (width >= 3840 && height >= 2160) return fps >= 60 ? 45_000 : 28_000
  if (width >= 2560 && height >= 1440) return fps >= 60 ? 24_000 : 16_000
  if (width >= 1920 && height >= 1080) return fps >= 60 ? 12_000 : 8_000
  return fps >= 60 ? 7_000 : 4_500
}

const toScreenShareStats = (
  status: NativeScreenShareStatus,
  expectedBitrateKbps: number,
): ScreenShareLivekitStats => {
  const fpsRatio = status.targetFps > 0 ? status.actualFps / status.targetFps : 0
  const quality: ScreenShareLivekitQuality = status.capturedFrames === 0
    ? "unknown"
    : fpsRatio >= 0.9
      ? "excellent"
      : fpsRatio >= 0.75
        ? "good"
        : fpsRatio >= 0.5
          ? "fair"
          : "poor"

  return {
    fpsActual: status.actualFps || null,
    targetFps: status.targetFps,
    bitrateKbps: null,
    expectedBitrateKbps,
    currentResolution: status.actualWidth && status.actualHeight
      ? [status.actualWidth, status.actualHeight]
      : null,
    targetResolution: [status.targetWidth, status.targetHeight],
    packetLossPercent: null,
    packetsLost: null,
    jitterMs: null,
    codec: `H.264 / ${status.encoder}`,
    quality,
    updatedAt: Date.now(),
  }
}

const toParticipantInfo = (
  participant: LocalParticipant | RemoteParticipant,
  isLocal: boolean,
): ParticipantInfo => {
  const screenPublication = participant.getTrackPublication(Track.Source.ScreenShare)
  const cameraPublication = participant.getTrackPublication(Track.Source.Camera)
  const microphonePublication = participant.getTrackPublication(Track.Source.Microphone)
  const screenTrack = screenPublication?.track ?? null
  const cameraTrack = cameraPublication?.track ?? null

  return {
    id: participant.sid || participant.identity,
    identity: participant.identity,
    name: participant.name || participant.identity,
    isSpeaking: participant.isSpeaking,
    isMuted: !microphonePublication || microphonePublication.isMuted,
    isCameraOn: Boolean(cameraTrack && !cameraPublication?.isMuted),
    isScreenSharing: Boolean(screenTrack && !screenPublication?.isMuted),
    connectionQuality: String(participant.connectionQuality ?? "unknown").toLowerCase(),
    audioLevel: participant.audioLevel ?? 0,
    videoTrack: (screenTrack ?? cameraTrack) as ParticipantVideoTrack,
    audioTrack: microphonePublication as TrackPublicationLike | null,
    previewThumbnail: null,
    isLocal,
  }
}

const errorMessage = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback

export const CallProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const { user, isAuthenticated } = useAuthSession()
  const [connectionState, setConnectionState] = useState<ConnectionState>("disconnected")
  const [error, setError] = useState<string | null>(null)
  const [currentCall, setCurrentCall] = useState<Call | null>(null)
  const [incomingCall, setIncomingCall] = useState<IncomingCall | null>(null)
  const [incomingBusy, setIncomingBusy] = useState(false)
  const [participants, setParticipants] = useState<ParticipantInfo[]>([])
  const [localParticipant, setLocalParticipant] = useState<ParticipantInfo | null>(null)
  const [isMuted, setIsMuted] = useState(false)
  const [isCameraOn, setIsCameraOn] = useState(false)
  const [isScreenSharing, setIsScreenSharing] = useState(false)
  const [screenShareStats, setScreenShareStats] = useState<ScreenShareLivekitStats | null>(null)
  const [isDeafened, setIsDeafened] = useState(false)
  const [roomName, setRoomName] = useState("")
  const [audioInputDevices, setAudioInputDevices] = useState<MediaDevice[]>([])
  const [audioOutputDevices, setAudioOutputDevices] = useState<MediaDevice[]>([])
  const [videoInputDevices, setVideoInputDevices] = useState<MediaDevice[]>([])
  const [selectedAudioInput, setSelectedAudioInput] = useState("")
  const [selectedAudioOutput, setSelectedAudioOutput] = useState("")
  const [selectedVideoInput, setSelectedVideoInput] = useState("")

  const roomRef = useRef<Room | null>(null)
  const currentCallRef = useRef<Call | null>(null)
  const initialMicMutedRef = useRef(false)
  const initialCameraEnabledRef = useRef(false)
  const operationRef = useRef<Promise<void> | null>(null)
  const remoteAudioElementsRef = useRef(new Set<HTMLMediaElement>())
  const screenShareBitrateRef = useRef(0)

  useEffect(() => {
    currentCallRef.current = currentCall
  }, [currentCall])

  const refreshDevices = useCallback(async () => {
    if (!navigator.mediaDevices?.enumerateDevices) return
    try {
      const snapshot = await listMediaDevicesNative()
      setAudioInputDevices(snapshot.audioInputs ?? [])
      setAudioOutputDevices(snapshot.audioOutputs ?? [])
      setVideoInputDevices(snapshot.videoInputs ?? [])
      setSelectedAudioInput((value) => value || snapshot.audioInputs?.[0]?.id || "")
      setSelectedAudioOutput((value) => value || snapshot.audioOutputs?.[0]?.id || "")
      setSelectedVideoInput((value) => value || snapshot.videoInputs?.[0]?.id || "")
    } catch (deviceError) {
      setError(errorMessage(deviceError, "Не удалось получить список устройств"))
    }
  }, [])

  useEffect(() => {
    void refreshDevices()
    const mediaDevices = navigator.mediaDevices
    mediaDevices?.addEventListener?.("devicechange", refreshDevices)
    return () => mediaDevices?.removeEventListener?.("devicechange", refreshDevices)
  }, [refreshDevices])

  const syncParticipants = useCallback((room: Room) => {
    const local = toParticipantInfo(room.localParticipant, true)
    const visible = [local]
    const mediaParticipants: ParticipantInfo[] = []

    for (const participant of room.remoteParticipants.values()) {
      const info = toParticipantInfo(participant, false)
      if (info.identity.endsWith(":media")) mediaParticipants.push(info)
      else visible.push(info)
    }

    for (const media of mediaParticipants) {
      const ownerIdentity = media.identity.slice(0, -":media".length)
      const owner = visible.find((participant) => participant.identity === ownerIdentity)
      if (!owner) continue
      owner.isMuted = media.isMuted
      owner.audioTrack = media.audioTrack
      owner.isScreenSharing = media.isScreenSharing
      if (media.isScreenSharing) owner.videoTrack = media.videoTrack
    }

    const syncedLocal = visible[0]
    setLocalParticipant(syncedLocal)
    setParticipants(visible)
    setIsCameraOn(syncedLocal.isCameraOn)
  }, [])

  const detachRemoteAudio = useCallback(() => {
    for (const element of remoteAudioElementsRef.current) {
      element.pause()
      element.remove()
    }
    remoteAudioElementsRef.current.clear()
  }, [])

  const disconnectRoom = useCallback(async (clearCall = true) => {
    if (isHostBridgeAvailable()) {
      await disconnectNativeMedia().catch(() => undefined)
    }
    const room = roomRef.current
    roomRef.current = null
    if (room) {
      room.removeAllListeners()
      await room.disconnect().catch(() => undefined)
    }
    detachRemoteAudio()
    setParticipants([])
    setLocalParticipant(null)
    setRoomName("")
    setIsMuted(false)
    setIsCameraOn(false)
    setIsScreenSharing(false)
    setScreenShareStats(null)
    setConnectionState("disconnected")
    if (clearCall) setCurrentCall(null)
  }, [detachRemoteAudio])

  const connectToCall = useCallback(async (call: Call, displayName: string) => {
    await disconnectRoom(false)
    setError(null)
    setConnectionState("connecting")

    try {
      const [token, mediaToken] = await Promise.all([
        callsApi.getToken(call.id),
        isHostBridgeAvailable() ? callsApi.getToken(call.id, "media") : Promise.resolve(null),
      ])
      const room = new Room({ adaptiveStream: true, dynacast: true })
      const refresh = () => syncParticipants(room)

      room
        .on(RoomEvent.Connected, () => {
          setConnectionState("connected")
          refresh()
        })
        .on(RoomEvent.Reconnecting, () => setConnectionState("reconnecting"))
        .on(RoomEvent.Reconnected, () => {
          setConnectionState("connected")
          refresh()
        })
        .on(RoomEvent.Disconnected, () => {
          if (roomRef.current === room) {
            roomRef.current = null
            detachRemoteAudio()
            setConnectionState("disconnected")
            setError("Соединение с LiveKit потеряно. Повторите подключение к звонку.")
          }
        })
        .on(RoomEvent.ParticipantConnected, refresh)
        .on(RoomEvent.ParticipantDisconnected, refresh)
        .on(RoomEvent.TrackPublished, refresh)
        .on(RoomEvent.TrackUnpublished, refresh)
        .on(RoomEvent.TrackMuted, refresh)
        .on(RoomEvent.TrackUnmuted, refresh)
        .on(RoomEvent.TrackSubscribed, (track) => {
          if (track.kind === Track.Kind.Audio) {
            const attached = track.attach()
            const elements = Array.isArray(attached) ? attached : [attached]
            for (const element of elements) {
              element.autoplay = true
              element.muted = isDeafened
              element.style.display = "none"
              document.body.appendChild(element)
              remoteAudioElementsRef.current.add(element)
            }
          }
          refresh()
        })
        .on(RoomEvent.TrackUnsubscribed, (track) => {
          for (const element of track.detach()) {
            remoteAudioElementsRef.current.delete(element)
            element.remove()
          }
          refresh()
        })
        .on(RoomEvent.ActiveSpeakersChanged, refresh)
        .on(RoomEvent.ConnectionQualityChanged, refresh)
        .on(RoomEvent.LocalTrackPublished, refresh)
        .on(RoomEvent.LocalTrackUnpublished, refresh)
        .on(RoomEvent.MediaDevicesError, (mediaError) => {
          setError(errorMessage(mediaError, "LiveKit не получил доступ к устройству"))
        })

      await room.connect(token.url, token.token)
      roomRef.current = room
      if (mediaToken) {
        await connectNativeMedia({
          livekitUrl: mediaToken.url,
          token: mediaToken.token,
          microphoneEnabled: !initialMicMutedRef.current,
          microphoneDeviceId: selectedAudioInput || undefined,
        })
      }
      setCurrentCall(call)
      setRoomName(call.room_name)

      if (!mediaToken) {
        try {
          await room.localParticipant.setMicrophoneEnabled(!initialMicMutedRef.current, {
            deviceId: selectedAudioInput || undefined,
          })
        } catch (microphoneError) {
          initialMicMutedRef.current = true
          setError(errorMessage(microphoneError, "Нет доступа к микрофону"))
        }
      }
      setIsMuted(initialMicMutedRef.current)

      if (initialCameraEnabledRef.current || call.kind === "video") {
        try {
          await room.localParticipant.setCameraEnabled(true, {
            deviceId: selectedVideoInput || undefined,
          })
        } catch (cameraError) {
          setError(errorMessage(cameraError, "Нет доступа к камере"))
        }
      }

      room.localParticipant.setMetadata(JSON.stringify({ displayName })).catch(() => undefined)
      syncParticipants(room)
      setConnectionState("connected")
      await refreshDevices()
    } catch (connectError) {
      await disconnectRoom()
      const message = errorMessage(connectError, "Не удалось подключиться к звонку")
      setError(message)
      throw new Error(message)
    }
  }, [
    detachRemoteAudio,
    disconnectRoom,
    isDeafened,
    refreshDevices,
    selectedAudioInput,
    selectedVideoInput,
    syncParticipants,
  ])

  const runExclusive = useCallback(async (operation: () => Promise<void>) => {
    if (operationRef.current) return operationRef.current
    const pending = operation()
    operationRef.current = pending
    try {
      await pending
    } finally {
      operationRef.current = null
    }
  }, [])

  const connect = useCallback(async (channelId: string, _userId: string, userName: string) => {
    if (!user || !isAuthenticated) throw new Error("Требуется авторизация")
    await runExclusive(async () => {
      if (currentCallRef.current?.channel_id === channelId && roomRef.current) return
      if (currentCallRef.current) {
        const previous = currentCallRef.current
        try {
          if (previous.initiator_id === user.id) await callsApi.end(previous.id)
          else await callsApi.leave(previous.id)
        } finally {
          await disconnectRoom()
        }
      }
      const call = await callsApi.start(channelId, "audio")
      await connectToCall(call, userName)
    })
  }, [connectToCall, disconnectRoom, isAuthenticated, runExclusive, user])

  const disconnect = useCallback(async () => {
    await runExclusive(async () => {
      const call = currentCallRef.current
      try {
        if (call && user) {
          if (call.initiator_id === user.id) await callsApi.end(call.id)
          else await callsApi.leave(call.id)
        }
      } finally {
        await disconnectRoom()
      }
    })
  }, [disconnectRoom, runExclusive, user])

  const endForAll = useCallback(async () => {
    const call = currentCallRef.current
    if (!call || !user) return
    if (call.initiator_id !== user.id) throw new Error("Завершить звонок для всех может только инициатор")
    await runExclusive(async () => {
      try {
        await callsApi.end(call.id)
      } finally {
        await disconnectRoom()
      }
    })
  }, [disconnectRoom, runExclusive, user])

  const refreshIncoming = useCallback(async () => {
    if (!user || currentCallRef.current) {
      setIncomingCall(null)
      return
    }
    try {
      const call = await callsApi.getIncoming(user.id)
      if (!call || call.initiator_id === user.id) {
        setIncomingCall(null)
        return
      }
      const channel = await channelsApi.getById(call.channel_id).catch(() => null)
      setIncomingCall({ ...call, channel_name: channel?.name || "Чат" })
    } catch (incomingError) {
      console.debug("[Calls] Failed to refresh incoming calls:", incomingError)
    }
  }, [user])

  useEffect(() => {
    if (!user || !isAuthenticated) {
      setIncomingCall(null)
      return
    }
    void refreshIncoming()
    const channel = callsApi.subscribeForUser(user.id, () => void refreshIncoming())
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [isAuthenticated, refreshIncoming, user])

  useEffect(() => {
    if (!incomingCall) return
    const delay = Math.max(0, new Date(incomingCall.expires_at).getTime() - Date.now())
    const timeout = window.setTimeout(() => {
      void callsApi.miss(incomingCall.id).catch(() => undefined)
      setIncomingCall(null)
    }, delay)
    return () => window.clearTimeout(timeout)
  }, [incomingCall])

  const currentCallId = currentCall?.id ?? null

  useEffect(() => {
    if (!currentCallId) return
    const channel = callsApi.subscribeToCall(currentCallId, (payload) => {
      const next = payload.new as Call
      setCurrentCall(next)
      if (["ended", "missed", "declined"].includes(next.status)) {
        void disconnectRoom()
      }
    })
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [currentCallId, disconnectRoom])

  useEffect(() => {
    if (!currentCall || currentCall.status !== "ringing") return
    const delay = Math.max(0, new Date(currentCall.expires_at).getTime() - Date.now())
    const timeout = window.setTimeout(() => {
      void callsApi.miss(currentCall.id).catch(() => undefined)
    }, delay)
    return () => window.clearTimeout(timeout)
  }, [currentCall])

  const acceptIncoming = useCallback(async () => {
    if (!incomingCall || !user) return
    setIncomingBusy(true)
    try {
      const call = await callsApi.accept(incomingCall.id)
      setIncomingCall(null)
      await connectToCall(call, user.displayName || user.username)
    } catch (acceptError) {
      setError(errorMessage(acceptError, "Не удалось принять звонок"))
    } finally {
      setIncomingBusy(false)
    }
  }, [connectToCall, incomingCall, user])

  const declineIncoming = useCallback(async () => {
    if (!incomingCall) return
    setIncomingBusy(true)
    try {
      await callsApi.decline(incomingCall.id)
      setIncomingCall(null)
    } catch (declineError) {
      setError(errorMessage(declineError, "Не удалось отклонить звонок"))
    } finally {
      setIncomingBusy(false)
    }
  }, [incomingCall])

  const toggleMicrophone = useCallback(async () => {
    const room = roomRef.current
    if (!room) throw new Error("Звонок не подключен")
    try {
      if (isHostBridgeAvailable()) {
        const muted = !isMuted
        await setMicrophoneMutedNative(muted)
        setIsMuted(muted)
      } else {
        await room.localParticipant.setMicrophoneEnabled(isMuted, {
          deviceId: selectedAudioInput || undefined,
        })
        setIsMuted(!isMuted)
        syncParticipants(room)
      }
    } catch (microphoneError) {
      const message = errorMessage(microphoneError, "Не удалось переключить микрофон")
      setError(message)
      throw new Error(message)
    }
  }, [isMuted, selectedAudioInput, syncParticipants])

  const toggleCamera = useCallback(async () => {
    const room = roomRef.current
    if (!room) throw new Error("Звонок не подключен")
    try {
      await room.localParticipant.setCameraEnabled(!isCameraOn, {
        deviceId: selectedVideoInput || undefined,
      })
      syncParticipants(room)
    } catch (cameraError) {
      const message = errorMessage(cameraError, "Не удалось переключить камеру")
      setError(message)
      throw new Error(message)
    }
  }, [isCameraOn, selectedVideoInput, syncParticipants])

  const toggleScreenShare = useCallback(async (
    sourceId?: string,
    settings?: ScreenShareSettingsInput,
    _previewThumbnail?: string,
  ) => {
    if (!roomRef.current) throw new Error("Звонок не подключен")
    if (!isHostBridgeAvailable()) throw new Error("Нативный захват доступен только в desktop-клиенте")

    if (isScreenSharing) {
      try {
        await stopScreenShareNative()
        setIsScreenSharing(false)
        setScreenShareStats(null)
      } catch (shareError) {
        const message = errorMessage(shareError, "Не удалось остановить демонстрацию экрана")
        setError(message)
        throw new Error(message)
      }
      return
    }

    if (!sourceId) throw new Error("Выберите монитор или окно")
    const resolved = settings ?? DEFAULT_SHARE_SETTINGS
    const [width, height] = QUALITY_TO_RESOLUTION[resolved.quality]
    const fps = Number(resolved.fps)
    const bitrateKbps = screenShareBitrate(width, height, fps)
    try {
      await startScreenShareNative({
        sourceId,
        width,
        height,
        fps,
        bitrateKbps,
      })
      screenShareBitrateRef.current = bitrateKbps
      setIsScreenSharing(true)
      const status = await getScreenShareStatusNative()
      setScreenShareStats(toScreenShareStats(status, bitrateKbps))
    } catch (shareError) {
      await stopScreenShareNative().catch(() => undefined)
      setIsScreenSharing(false)
      setScreenShareStats(null)
      const message = errorMessage(shareError, "Не удалось начать демонстрацию экрана")
      setError(message)
      throw new Error(message)
    }
  }, [isScreenSharing])

  useEffect(() => {
    if (!isScreenSharing) return

    let cancelled = false
    const refreshStatus = async () => {
      try {
        const status = await getScreenShareStatusNative()
        if (cancelled) return
        setScreenShareStats(toScreenShareStats(status, screenShareBitrateRef.current))
        if (!status.active) {
          setIsScreenSharing(false)
          await stopScreenShareNative().catch(() => undefined)
          if (status.error) setError(status.error)
        }
      } catch (statusError) {
        if (!cancelled) setError(errorMessage(statusError, "Не удалось получить состояние захвата экрана"))
      }
    }

    void refreshStatus()
    const interval = window.setInterval(() => void refreshStatus(), 1_000)
    return () => {
      cancelled = true
      window.clearInterval(interval)
    }
  }, [isScreenSharing])

  const toggleDeafen = useCallback(() => {
    setIsDeafened((value) => {
      const next = !value
      for (const element of remoteAudioElementsRef.current) element.muted = next
      return next
    })
  }, [])

  const setAudioDevice = useCallback(async (deviceId: string) => {
    setSelectedAudioInput(deviceId)
    const room = roomRef.current
    if (!room) return
    if (isHostBridgeAvailable()) await setMicrophoneDeviceNative(deviceId)
    else await room.switchActiveDevice("audioinput", deviceId)
  }, [])

  const setVideoDevice = useCallback(async (deviceId: string) => {
    setSelectedVideoInput(deviceId)
    const room = roomRef.current
    if (room) await room.switchActiveDevice("videoinput", deviceId)
  }, [])

  const setAudioOutputDevice = useCallback(async (deviceId: string) => {
    setSelectedAudioOutput(deviceId)
    const room = roomRef.current
    if (room) await room.switchActiveDevice("audiooutput", deviceId)
  }, [])

  const setInitialMicState = useCallback((muted: boolean) => {
    initialMicMutedRef.current = muted
    setIsMuted(muted)
  }, [])

  const setInitialCameraState = useCallback((enabled: boolean) => {
    initialCameraEnabledRef.current = enabled
    setIsCameraOn(enabled)
  }, [])

  useEffect(() => () => {
    void disconnectRoom(false)
  }, [disconnectRoom])

  const screenShareAvailable = isHostBridgeAvailable() &&
    typeof navigator !== "undefined" && navigator.userAgent.includes("Windows")

  const value = useMemo<CallContextValue>(() => ({
    connectionState,
    isConnected: connectionState === "connected" || connectionState === "reconnecting",
    isConnecting: connectionState === "connecting",
    error,
    currentCall,
    incomingCall,
    localParticipant,
    isMuted,
    isCameraOn,
    isScreenSharing,
    screenShareAvailable,
    screenShareUnavailableReason: screenShareAvailable ? null : "Нативный захват экрана доступен только в Windows desktop-клиенте",
    isDeafened,
    participants,
    participantCount: participants.length,
    roomName,
    screenShareStats,
    connect,
    disconnect,
    endForAll,
    acceptIncoming,
    declineIncoming,
    toggleMicrophone,
    toggleCamera,
    toggleScreenShare,
    toggleDeafen,
    setAudioDevice,
    setVideoDevice,
    setAudioOutputDevice,
    setInitialMicState,
    setInitialCameraState,
    audioInputDevices,
    audioOutputDevices,
    videoInputDevices,
    selectedAudioInput,
    selectedAudioOutput,
    selectedVideoInput,
    refreshDevices,
  }), [
    acceptIncoming,
    audioInputDevices,
    audioOutputDevices,
    connect,
    connectionState,
    currentCall,
    declineIncoming,
    disconnect,
    endForAll,
    error,
    incomingCall,
    isCameraOn,
    isDeafened,
    isMuted,
    isScreenSharing,
    localParticipant,
    participants,
    refreshDevices,
    roomName,
    screenShareStats,
    screenShareAvailable,
    selectedAudioInput,
    selectedAudioOutput,
    selectedVideoInput,
    setAudioDevice,
    setAudioOutputDevice,
    setInitialCameraState,
    setInitialMicState,
    setVideoDevice,
    toggleCamera,
    toggleDeafen,
    toggleMicrophone,
    toggleScreenShare,
    videoInputDevices,
  ])

  return (
    <CallContext.Provider value={value}>
      {children}
      <IncomingCallModal
        call={incomingCall}
        busy={incomingBusy}
        onAccept={() => void acceptIncoming()}
        onDecline={() => void declineIncoming()}
      />
    </CallContext.Provider>
  )
}
