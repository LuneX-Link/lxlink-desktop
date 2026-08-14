import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react"
import { checkBackendHealth } from "../lib/backend-health"

interface ConnectivityContextValue {
  isConnected: boolean
  isChecking: boolean
  lastChecked: Date | null
  checkConnection: () => Promise<boolean>
}

const ConnectivityContext = createContext<ConnectivityContextValue | null>(null)
const CHECK_INTERVAL_MS = 10_000

export const ConnectivityProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [isConnected, setIsConnected] = useState(false)
  const [isChecking, setIsChecking] = useState(true)
  const [lastChecked, setLastChecked] = useState<Date | null>(null)
  const mountedRef = useRef(true)
  const checkingRef = useRef<Promise<boolean> | null>(null)

  const checkConnection = useCallback(async (): Promise<boolean> => {
    if (checkingRef.current) return checkingRef.current

    const pending = (async () => {
      if (mountedRef.current) setIsChecking(true)
      const connected = await checkBackendHealth()
      if (mountedRef.current) {
        setIsConnected(connected)
        setLastChecked(new Date())
        setIsChecking(false)
      }
      return connected
    })()

    checkingRef.current = pending
    try {
      return await pending
    } finally {
      checkingRef.current = null
    }
  }, [])

  useEffect(() => {
    mountedRef.current = true
    void checkConnection()

    const interval = window.setInterval(() => void checkConnection(), CHECK_INTERVAL_MS)
    const onOnline = () => void checkConnection()
    const onOffline = () => {
      setIsConnected(false)
      setLastChecked(new Date())
    }
    window.addEventListener("online", onOnline)
    window.addEventListener("offline", onOffline)

    return () => {
      mountedRef.current = false
      window.clearInterval(interval)
      window.removeEventListener("online", onOnline)
      window.removeEventListener("offline", onOffline)
    }
  }, [checkConnection])

  const value = useMemo(
    () => ({ isConnected, isChecking, lastChecked, checkConnection }),
    [checkConnection, isChecking, isConnected, lastChecked],
  )

  return <ConnectivityContext.Provider value={value}>{children}</ConnectivityContext.Provider>
}

export const useConnectivity = () => {
  const context = useContext(ConnectivityContext)
  if (!context) throw new Error("useConnectivity must be used within ConnectivityProvider")
  return context
}
