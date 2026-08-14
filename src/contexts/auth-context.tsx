import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react"
import type { AuthError, Session, User } from "@supabase/supabase-js"

import type { AuthUser } from "../types/domain"
import type { AuthStatus, DesktopAuthFlow } from "../types/auth"
import { supabase } from "../lib/supabase"
import { desktopAuthApi } from "../lib/api/desktopAuthApi"
import { useConnectivity } from "./connectivity-context"

interface AuthContextValue {
  status: AuthStatus
  user: AuthUser | null
  error: string | null
  isLoading: boolean
  isAuthenticated: boolean
  isAwaitingAuth: boolean
  beginSignIn: () => Promise<string>
  cancelSignIn: () => void
  signOut: () => Promise<void>
  reloadUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

const toAuthUser = (user: User): AuthUser => ({
  id: user.id,
  email: user.email || null,
  username: user.user_metadata?.username || user.email?.split("@")[0] || "user",
  displayName: user.user_metadata?.nickname || user.user_metadata?.username || null,
  avatar: user.user_metadata?.avatar_url || null,
})

const isNetworkError = (error: unknown) => {
  if (!error) return false
  const candidate = error as Partial<AuthError> & { name?: string; status?: number }
  const text = `${candidate.name ?? ""} ${candidate.message ?? ""}`.toLowerCase()
  return candidate.status === 0 || text.includes("fetch") || text.includes("network") || text.includes("timeout")
}

export const AuthProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const { isConnected } = useConnectivity()
  const [status, setStatus] = useState<AuthStatus>("loading")
  const [user, setUser] = useState<AuthUser | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [authFlow, setAuthFlow] = useState<DesktopAuthFlow | null>(() => desktopAuthApi.load())
  const validatingRef = useRef<Promise<void> | null>(null)

  const applySession = useCallback((session: Session) => {
    setUser(toAuthUser(session.user))
    setStatus("authenticated")
    setError(null)
  }, [])

  const validateStoredSession = useCallback(async () => {
    if (validatingRef.current) return validatingRef.current

    const pending = (async () => {
      const { data: sessionData } = await supabase.auth.getSession()
      const session = sessionData.session
      if (!session) {
        setUser(null)
        setStatus("unauthenticated")
        return
      }

      setUser(toAuthUser(session.user))
      setStatus("recovering")

      try {
        const { data, error: userError } = await supabase.auth.getUser()
        if (!userError && data.user) {
          setUser(toAuthUser(data.user))
          setStatus("authenticated")
          setError(null)
          return
        }

        if (isNetworkError(userError)) {
          setStatus("offline")
          return
        }

        const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession()
        if (refreshed.session && !refreshError) {
          applySession(refreshed.session)
          return
        }
        if (isNetworkError(refreshError)) {
          setStatus("offline")
          return
        }

        await supabase.auth.signOut({ scope: "local" })
        setUser(null)
        setStatus("unauthenticated")
      } catch (validationError) {
        if (isNetworkError(validationError)) {
          setStatus("offline")
        } else {
          setError(validationError instanceof Error ? validationError.message : "Session validation failed")
          setStatus("recovering")
        }
      }
    })()

    validatingRef.current = pending
    try {
      await pending
    } finally {
      validatingRef.current = null
    }
  }, [applySession])

  useEffect(() => {
    let active = true
    void supabase.auth.getSession().then(({ data }) => {
      if (!active) return
      if (data.session) applySession(data.session)
      else setStatus("unauthenticated")
    }).catch((sessionError) => {
      if (!active) return
      setError(sessionError instanceof Error ? sessionError.message : "Unable to restore session")
      setStatus("recovering")
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        applySession(session)
        return
      }
      if (event === "SIGNED_OUT") {
        setUser(null)
        setStatus("unauthenticated")
      }
    })

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [applySession])

  useEffect(() => {
    if (!isConnected) {
      if (user) setStatus("offline")
      return
    }
    if (user || status === "offline" || status === "recovering") {
      void validateStoredSession()
    }
  }, [isConnected, status, user, validateStoredSession])

  useEffect(() => {
    if (!authFlow || user) return
    let active = true
    let checking = false

    const claim = async () => {
      if (checking || !active) return
      if (new Date(authFlow.expiresAt).getTime() <= Date.now()) {
        desktopAuthApi.clear()
        setAuthFlow(null)
        setError("Время ожидания авторизации истекло. Откройте страницу входа ещё раз.")
        return
      }

      checking = true
      try {
        const session = await desktopAuthApi.claim(authFlow)
        if (!session || !active) return
        const { data, error: sessionError } = await supabase.auth.setSession({
          access_token: session.access_token,
          refresh_token: session.refresh_token,
        })
        if (sessionError || !data.session) throw sessionError ?? new Error("Authorization session is invalid")
        desktopAuthApi.clear()
        setAuthFlow(null)
        applySession(data.session)
      } catch (claimError) {
        if (!isNetworkError(claimError)) {
          setError(claimError instanceof Error ? claimError.message : "Authorization failed")
        }
      } finally {
        checking = false
      }
    }

    void claim()
    const interval = window.setInterval(() => void claim(), 1_500)
    return () => {
      active = false
      window.clearInterval(interval)
    }
  }, [applySession, authFlow, user])

  const beginSignIn = useCallback(async () => {
    setError(null)
    const { flow, url } = await desktopAuthApi.start()
    setAuthFlow(flow)
    return url
  }, [])

  const cancelSignIn = useCallback(() => {
    desktopAuthApi.clear()
    setAuthFlow(null)
  }, [])

  const signOut = useCallback(async () => {
    cancelSignIn()
    const { error: signOutError } = await supabase.auth.signOut({ scope: "local" })
    if (signOutError) setError(signOutError.message)
    setUser(null)
    setStatus("unauthenticated")
  }, [cancelSignIn])

  const value = useMemo<AuthContextValue>(() => ({
    status,
    user,
    error,
    isLoading: status === "loading" || (status === "recovering" && !user),
    isAuthenticated: Boolean(user) && ["authenticated", "offline", "recovering"].includes(status),
    isAwaitingAuth: Boolean(authFlow),
    beginSignIn,
    cancelSignIn,
    signOut,
    reloadUser: validateStoredSession,
  }), [authFlow, beginSignIn, cancelSignIn, error, signOut, status, user, validateStoredSession])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuthSession = () => {
  const context = useContext(AuthContext)
  if (!context) throw new Error("useAuthSession must be used within AuthProvider")
  return context
}
