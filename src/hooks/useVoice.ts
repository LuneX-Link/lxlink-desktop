import { useState, useCallback, useMemo } from "react"

export interface VoiceState {
  isMuted: boolean
  isDeafened: boolean
  stream: MediaStream | null
  micId: string
  speakerId: string
}

interface JoinOptions {
  inputDeviceId?: string
  channelId?: string
}

export function useVoice() {
  const [state, setState] = useState<VoiceState>({
    isMuted: false,
    isDeafened: false,
    stream: null,
    micId: localStorage.getItem("astrolune_selected_mic") ?? "",
    speakerId: localStorage.getItem("astrolune_selected_speaker") ?? "",
  })
  const [active, setActive] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const toggleMute = useCallback(() => {
    setState((previous) => {
      if (previous.stream) {
        previous.stream.getAudioTracks().forEach((track) => {
          track.enabled = previous.isMuted
        })
      }
      return { ...previous, isMuted: !previous.isMuted }
    })
  }, [])

  const toggleDeafen = useCallback(() => {
    setState((previous) => ({ ...previous, isDeafened: !previous.isDeafened }))
  }, [])

  const setStream = useCallback((stream: MediaStream | null) => {
    setState((previous) => ({ ...previous, stream }))
  }, [])

  const setAudioDevices = useCallback(({ micId, speakerId }: { micId: string; speakerId: string }) => {
    localStorage.setItem("astrolune_selected_mic", micId)
    localStorage.setItem("astrolune_selected_speaker", speakerId)
    setState((previous) => ({ ...previous, micId, speakerId }))
  }, [])

  const join = useCallback(async (options?: JoinOptions) => {
    try {
      setError(null)
      if (options?.inputDeviceId) {
        localStorage.setItem("astrolune_selected_mic", options.inputDeviceId)
      }
      setState((previous) => ({
        ...previous,
        micId: options?.inputDeviceId ?? previous.micId,
      }))
      setActive(true)
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Failed to start voice"
      setError(message)
      throw caught
    }
  }, [])

  const leave = useCallback(async () => {
    setError(null)
    setActive(false)
    setStream(null)
  }, [setStream])

  return useMemo(
    () => ({
      isMuted: state.isMuted,
      isDeafened: state.isDeafened,
      stream: state.stream,
      micId: state.micId,
      speakerId: state.speakerId,
      toggleMute,
      toggleDeafen,
      setStream,
      setAudioDevices,
      active,
      error,
      join,
      leave,
    }),
    [active, error, setAudioDevices, setStream, state.isDeafened, state.isMuted, state.micId, state.speakerId, state.stream, toggleDeafen, toggleMute, join, leave],
  )
}
