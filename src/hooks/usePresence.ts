import { useCallback, useEffect, useMemo, useState } from "react"
import { profilesApi } from "../lib/api/profilesApi"
import { supabase } from "../lib/supabase"

export type PresenceStatus = "online" | "offline" | "idle" | "dnd" | "invisible"

export interface PresenceState {
  status: PresenceStatus
  customStatus?: string
  lastSeenAt?: string
}

export type PresenceMap = Map<string, PresenceState>

const normalizeStatus = (status: unknown): PresenceStatus => {
  if (status === "online" || status === "idle" || status === "dnd" || status === "invisible" || status === "offline") {
    return status as PresenceStatus
  }
  return "offline"
}

// ── Singleton presence store ──────────────────────────────────────────
// Shared across all usePresence() consumers. One channel subscription, one state.
let globalPresence: PresenceMap = new Map()
let listeners: Set<() => void> = new Set()
let channelSubscribed = false
let myUserId: string | null = null
let debounceTimer: ReturnType<typeof setTimeout> | null = null

function notifyListeners() {
  for (const fn of listeners) fn()
}

function setPresenceEntry(userId: string, state: PresenceState) {
  const next = new Map(globalPresence)
  next.set(userId, state)
  globalPresence = next
  notifyListeners()
}

function mergePresenceEntries(entries: { user_id: string; status: string; custom_status: string | null; last_seen_at: string }[]) {
  const next = new Map(globalPresence)
  for (const row of entries) {
    next.set(row.user_id, {
      status: normalizeStatus(row.status),
      customStatus: row.custom_status || undefined,
      lastSeenAt: row.last_seen_at,
    })
  }
  globalPresence = next
  notifyListeners()
}

// Subscribe once to presence changes
function ensurePresenceSubscription() {
  if (channelSubscribed) return
  channelSubscribed = true

  supabase
    .channel("presence-changes")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "presence" },
      (payload) => {
        const row = payload.new as { user_id: string; status: string; custom_status: string | null; last_seen_at: string }
        if (!row.user_id) return
        setPresenceEntry(row.user_id, {
          status: normalizeStatus(row.status),
          customStatus: row.custom_status || undefined,
          lastSeenAt: row.last_seen_at,
        })
      },
    )
    .subscribe()

  // Get current user ID
  supabase.auth.getUser().then(({ data: { user } }) => {
    myUserId = user?.id ?? null
  })

  // Auto online/idle
  const handleFocus = () => updatePresence("online")
  const handleBlur = () => updatePresence("idle")
  const handleBeforeUnload = () => {
    if (debounceTimer) clearTimeout(debounceTimer)
    void profilesApi.updateStatus("offline").catch(() => {})
  }

  window.addEventListener("focus", handleFocus)
  window.addEventListener("blur", handleBlur)
  window.addEventListener("beforeunload", handleBeforeUnload)

  // Set initial status
  updatePresence(document.hasFocus() ? "online" : "idle")
}

function updatePresence(status: PresenceStatus, customStatus?: string) {
  // Optimistic local update
  if (myUserId) {
    setPresenceEntry(myUserId, {
      status,
      customStatus: customStatus ?? globalPresence.get(myUserId)?.customStatus,
      lastSeenAt: new Date().toISOString(),
    })
  }

  // Debounced API call
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    debounceTimer = null
    void profilesApi.updateStatus(status, customStatus).catch(() => {})
  }, 500)
}

// ── React hook ───────────────────────────────────────────────────────

export const usePresence = () => {
  const [presence, setPresence] = useState<PresenceMap>(globalPresence)

  useEffect(() => {
    ensurePresenceSubscription()

    const listener = () => {
      setPresence(globalPresence)
    }
    listeners.add(listener)
    return () => { listeners.delete(listener) }
  }, [])

  const updateMyPresence = useCallback((status: PresenceStatus, customStatus?: string) => {
    updatePresence(status, customStatus)
  }, [])

  const loadPresence = useCallback(async (userIds: string[]) => {
    if (userIds.length === 0) return
    try {
      const data = await profilesApi.getPresence(userIds)
      mergePresenceEntries(data)
    } catch (err) {
      console.warn("[Presence] Failed to load:", err)
    }
  }, [])

  return useMemo(() => ({ presence, updateMyPresence, loadPresence }), [presence, updateMyPresence, loadPresence])
}

export const useUserPresence = (userId: string) => {
  const { presence } = usePresence()
  const state = presence.get(userId)

  return useMemo(() => ({
    isOnline: state?.status === "online",
    status: state?.status ?? "offline",
    customStatus: state?.customStatus,
    lastSeenAt: state?.lastSeenAt,
  }), [state])
}
