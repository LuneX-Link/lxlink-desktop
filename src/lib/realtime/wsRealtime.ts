import { getRealtimeClient, type RealtimeConnectionState, type RealtimeEventMessage } from "../realtime-client"

export type RealtimeStatus = "connecting" | "connected" | "disconnected"
export type RealtimeEventType = string

export interface RealtimeEvent<T = unknown> {
  type: string
  payload: T
}

type Handler = (event: RealtimeEvent) => void
type StatusHandler = (status: RealtimeStatus) => void

const normalizeEventType = (eventType: string) => eventType.replace(/^realtime:\/\//, "")
const EVENT_ALIASES: Record<string, string[]> = {
  "message.new": ["message.new", "MESSAGE_CREATE"],
  MESSAGE_CREATE: ["MESSAGE_CREATE", "message.new"],
  "message.edited": ["message.edited", "MESSAGE_EDIT", "MESSAGE_UPDATE"],
  MESSAGE_EDIT: ["MESSAGE_EDIT", "message.edited", "MESSAGE_UPDATE"],
  MESSAGE_UPDATE: ["MESSAGE_UPDATE", "message.edited", "MESSAGE_EDIT"],
  "message.deleted": ["message.deleted", "MESSAGE_DELETE"],
  MESSAGE_DELETE: ["MESSAGE_DELETE", "message.deleted"],
  "space.member_joined": ["space.member_joined", "member.joined", "member_joined", "realtime://member.joined"],
  "member.joined": ["member.joined", "space.member_joined", "realtime://member.joined"],
  "space.member_left": ["space.member_left", "member.left", "member_left", "realtime://member.left"],
  "member.left": ["member.left", "space.member_left", "realtime://member.left"],
  "notification.new": ["notification.new", "realtime://notification.new"],
  "presence.changed": ["presence.changed", "user.presence_changed", "realtime://presence.changed"],
  "user.presence_changed": ["user.presence_changed", "presence.changed", "realtime://presence.changed"],
  "realtime://presence.changed": ["realtime://presence.changed", "presence.changed", "user.presence_changed"],
  TYPING_START: ["TYPING_START", "typing.start", "realtime://typing.start"],
  "typing.start": ["typing.start", "TYPING_START", "realtime://typing.start"],
}

const toRealtimeStatus = (state: RealtimeConnectionState): RealtimeStatus => {
  if (state === "connected") {
    return "connected"
  }

  if (state === "connecting" || state === "reconnecting") {
    return "connecting"
  }

  return "disconnected"
}

class WsRealtimeClient {
  private handlers = new Map<string, Set<Handler>>()
  private statusHandlers = new Set<StatusHandler>()
  private status: RealtimeStatus = "disconnected"
  private eventUnsubscribe: (() => void) | null = null
  private stateUnsubscribe: (() => void) | null = null

  async connect() {
    this.ensureSubscriptions()
    await getRealtimeClient().connect()
  }

  disconnect() {
    void getRealtimeClient().disconnect()
  }

  send(type: string, payload?: Record<string, unknown>) {
    void getRealtimeClient().dispatch(type, payload ?? {})
    return true
  }

  subscribe(eventType: string, handler: Handler) {
    this.ensureSubscriptions()

    const keys = new Set([eventType, normalizeEventType(eventType)])
    const unsubscribeFns = Array.from(keys).map((key) => {
      const set = this.handlers.get(key) ?? new Set<Handler>()
      set.add(handler)
      this.handlers.set(key, set)
      return () => {
        set.delete(handler)
        if (set.size === 0) {
          this.handlers.delete(key)
        }
      }
    })

    return () => unsubscribeFns.forEach((unsubscribe) => unsubscribe())
  }

  onStatus(handler: StatusHandler) {
    this.ensureSubscriptions()
    this.statusHandlers.add(handler)
    handler(this.status)
    return () => {
      this.statusHandlers.delete(handler)
    }
  }

  getStatus() {
    return this.status
  }

  private ensureSubscriptions() {
    if (!this.eventUnsubscribe) {
      this.eventUnsubscribe = getRealtimeClient().subscribe((event) => this.deliver(event))
    }

    if (!this.stateUnsubscribe) {
      this.stateUnsubscribe = getRealtimeClient().subscribeState((state) => {
        this.setStatus(toRealtimeStatus(state))
      })
    }
  }

  private deliver(event: RealtimeEventMessage) {
    const aliases = EVENT_ALIASES[event.event] ?? EVENT_ALIASES[normalizeEventType(event.event)] ?? [event.event, normalizeEventType(event.event)]
    const delivered = new Set<Handler>()

    for (const alias of aliases) {
      this.handlers.get(alias)?.forEach((handler) => {
        if (delivered.has(handler)) {
          return
        }

        delivered.add(handler)
        handler({ type: alias, payload: event.data })
      })
    }
  }

  private setStatus(status: RealtimeStatus) {
    this.status = status
    this.statusHandlers.forEach((handler) => handler(status))
  }
}

export const realtimeClient = new WsRealtimeClient()
