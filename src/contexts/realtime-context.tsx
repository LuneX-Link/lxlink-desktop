import React, { createContext, useContext, useEffect, useMemo, useState } from "react"
import { useAuthSession } from "./auth-context"
import { realtimeClient, type RealtimeEvent, type RealtimeStatus } from "../lib/realtime/wsRealtime"

export interface RealtimeContextValue {
  status: RealtimeStatus
  subscribe: (eventType: string, handler: (event: RealtimeEvent) => void) => () => void
}

const RealtimeContext = createContext<RealtimeContextValue | null>(null)

export const RealtimeProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const { isAuthenticated } = useAuthSession()
  const [status, setStatus] = useState<RealtimeStatus>("disconnected")

  useEffect(() => realtimeClient.onStatus(setStatus), [])

  useEffect(() => {
    if (isAuthenticated) {
      void realtimeClient.connect()
      return
    }

    realtimeClient.disconnect()
  }, [isAuthenticated])

  const value = useMemo<RealtimeContextValue>(() => ({
    status,
    subscribe: (eventType, handler) => realtimeClient.subscribe(eventType, handler),
  }), [status])

  return <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>
}

export const useRealtimeContext = () => {
  const context = useContext(RealtimeContext)
  if (!context) throw new Error("useRealtimeContext must be used within RealtimeProvider")
  return context
}
