import { invoke, isHostBridgeAvailable, listen, type UnlistenFn } from "./host/bridge"
import { supabase } from "./supabase"

export interface RealtimeEventMessage<TData = unknown> {
  event: string
  data: TData
  timestamp: number
  meta?: Record<string, unknown> | null
}

export type RealtimeEventHandler = (event: RealtimeEventMessage) => void
export type RealtimeConnectionState =
  | "idle"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "disconnected"

type StateHandler = (state: RealtimeConnectionState) => void

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value)

export class RealtimeClient {
  private handlers = new Set<RealtimeEventHandler>()
  private stateHandlers = new Set<StateHandler>()
  private state: RealtimeConnectionState = "idle"
  private joinedChannels = new Set<string>()
  private hostEventUnlisten: UnlistenFn | null = null
  private hostStateUnlisten: UnlistenFn | null = null

  async connect(): Promise<void> {
    if (!isHostBridgeAvailable()) {
      this.setState("disconnected")
      return
    }

    await this.ensureHostSubscriptions()

    if (this.state === "connected" || this.state === "connecting" || this.state === "reconnecting") {
      return
    }

    this.setState("connecting")
    try {
      const { data } = await supabase.auth.getSession()
      const token = data.session?.access_token
      if (!token) throw new Error("No auth token available")
      await invoke("realtime.connect", { token })
      this.setState("connected")

      for (const channelId of this.joinedChannels) {
        await invoke("realtime.channel.join", { channelId })
      }
    } catch (error) {
      this.setState("disconnected")
      throw error
    }
  }

  async disconnect(): Promise<void> {
    if (!isHostBridgeAvailable()) {
      this.setState("disconnected")
      return
    }

    try {
      await invoke("realtime.disconnect")
    } finally {
      this.setState("disconnected")
      this.clearHostSubscriptions()
    }
  }

  subscribe(handler: RealtimeEventHandler): () => void {
    this.handlers.add(handler)
    return () => {
      this.handlers.delete(handler)
    }
  }

  subscribeState(handler: StateHandler): () => void {
    this.stateHandlers.add(handler)
    handler(this.state)
    return () => {
      this.stateHandlers.delete(handler)
    }
  }

  async joinChannel(channelId: string): Promise<void> {
    if (!channelId.trim()) {
      return
    }

    this.joinedChannels.add(channelId)
    await this.connect()
    if (isHostBridgeAvailable()) {
      await invoke("realtime.channel.join", { channelId })
    }
  }

  async leaveChannel(channelId: string): Promise<void> {
    if (!channelId.trim()) {
      return
    }

    this.joinedChannels.delete(channelId)
    if (isHostBridgeAvailable()) {
      await invoke("realtime.channel.leave", { channelId })
    }
  }

  async updatePresence(status: string, activity?: string | null): Promise<void> {
    await this.connect()
    if (isHostBridgeAvailable()) {
      await invoke("realtime.presence.update", {
        status,
        activity: activity ?? null,
      })
    }
  }

  async startTyping(channelId: string): Promise<void> {
    await this.connect()
    if (isHostBridgeAvailable()) {
      await invoke("realtime.typing.start", { channelId })
    }
  }

  async updateVoiceState(payload: {
    guildId?: string | null
    channelId?: string | null
    muted: boolean
    deafened: boolean
  }): Promise<void> {
    await this.connect()
    if (isHostBridgeAvailable()) {
      await invoke("realtime.voice_state.update", { payload })
    }
  }

  async dispatch(type: string, data: Record<string, unknown>, channelId?: string): Promise<void> {
    await this.connect()
    if (isHostBridgeAvailable()) {
      await invoke("realtime.dispatch", { type, data, channelId })
    }
  }

  getConnectionState(): RealtimeConnectionState {
    return this.state
  }

  private async ensureHostSubscriptions(): Promise<void> {
    if (this.hostEventUnlisten && this.hostStateUnlisten) {
      return
    }

    if (!this.hostEventUnlisten) {
      this.hostEventUnlisten = await listen<unknown>("realtime.event", (payload) => {
        const event = this.normalizeHostEvent(payload)
        if (!event) {
          return
        }

        for (const handler of this.handlers) {
          handler(event)
        }
      })
    }

    if (!this.hostStateUnlisten) {
      this.hostStateUnlisten = await listen<Record<string, unknown>>("realtime.state", (payload) => {
        if (!payload || typeof payload !== "object") {
          return
        }

        const rawState =
          typeof payload.status === "string"
            ? payload.status
            : typeof payload.state === "string"
              ? payload.state
              : null

        if (rawState === "reconnecting") {
          this.setState("reconnecting")
          return
        }

        if (rawState === "connecting") {
          this.setState("connecting")
          return
        }

        if (rawState === "connected" || payload.connected === true) {
          this.setState("connected")
          return
        }

        if (rawState === "disconnected" || payload.connected === false) {
          this.setState("disconnected")
        }
      })
    }
  }

  private clearHostSubscriptions() {
    this.hostEventUnlisten?.()
    this.hostStateUnlisten?.()
    this.hostEventUnlisten = null
    this.hostStateUnlisten = null
  }

  private normalizeHostEvent(payload: unknown): RealtimeEventMessage | null {
    if (!isRecord(payload)) {
      return null
    }

    const eventName = typeof payload.event === "string" ? payload.event : typeof payload.type === "string" ? payload.type : ""
    if (!eventName) {
      return null
    }

    return {
      event: eventName,
      data: payload.payload ?? payload.data ?? null,
      timestamp: typeof payload.timestamp === "number" ? payload.timestamp : Date.now(),
      meta: isRecord(payload.meta) ? payload.meta : null,
    }
  }

  private setState(next: RealtimeConnectionState) {
    this.state = next
    for (const handler of this.stateHandlers) {
      handler(next)
    }
  }
}

let realtimeClientSingleton: RealtimeClient | null = null

export const getRealtimeClient = (): RealtimeClient => {
  if (!realtimeClientSingleton) {
    realtimeClientSingleton = new RealtimeClient()
  }
  return realtimeClientSingleton
}

export const disconnectRealtimeClient = async (): Promise<void> => {
  if (!realtimeClientSingleton) {
    return
  }

  await realtimeClientSingleton.disconnect()
  realtimeClientSingleton = null
}
