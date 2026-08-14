import { useEffect } from "react"
import { useRealtimeContext } from "../contexts/realtime-context"
import { getRealtimeClient } from "../lib/realtime-client"
import type { RealtimeEvent } from "../lib/realtime/wsRealtime"

export const normalizeRealtimeEventType = (eventType: string) => eventType.replace(/^realtime:\/\//, "")

export const useRealtimeEvent = (eventType: string, handler: (event: RealtimeEvent) => void) => {
  const { subscribe } = useRealtimeContext()

  useEffect(() => {
    const normalizedType = normalizeRealtimeEventType(eventType)
    const unsubscribeWs = subscribe(normalizedType, handler)
    const unsubscribeBridge = subscribe(eventType, handler)
    const unsubscribeRuntime = getRealtimeClient().subscribe((event) => {
      if (event.event !== eventType && event.event !== normalizedType) return
      handler({ type: event.event, payload: event.data })
    })

    return () => {
      unsubscribeWs()
      unsubscribeBridge()
      unsubscribeRuntime()
    }
  }, [eventType, handler, subscribe])
}
