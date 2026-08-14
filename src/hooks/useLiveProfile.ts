import { useEffect, useState } from "react"
import { profilesApi, type Profile } from "../lib/api/profilesApi"
import { supabase } from "../lib/supabase"
import type { UserData, UserStatus } from "../types"

// ── Shared profile cache ──────────────────────────────────────────────
// One entry per user, kept fresh by a single realtime subscription so every
// consumer (profile modal, chat header, sidebar) sees edits immediately.
const cache = new Map<string, Profile>()
const listeners = new Map<string, Set<(profile: Profile) => void>>()
const inflight = new Map<string, Promise<Profile | null>>()
let realtimeReady = false

const emit = (profile: Profile) => {
  cache.set(profile.id, profile)
  listeners.get(profile.id)?.forEach((listener) => listener(profile))
}

/** Push a profile row coming from elsewhere (e.g. a list fetch) into the cache. */
export const primeProfile = (profile: Profile) => emit(profile)

export const getCachedProfile = (userId: string) => cache.get(userId)

const ensureRealtime = () => {
  if (realtimeReady) return
  realtimeReady = true

  supabase
    .channel("profiles-live")
    .on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "profiles" },
      (payload) => {
        const row = payload.new as Profile
        if (!row?.id) return
        // Only track users somebody is actually watching.
        if (!cache.has(row.id) && !listeners.has(row.id)) return
        emit({ ...(cache.get(row.id) ?? ({} as Profile)), ...row })
      },
    )
    .subscribe()
}

const fetchProfile = (userId: string) => {
  const existing = inflight.get(userId)
  if (existing) return existing

  const request = profilesApi
    .getById(userId)
    .then((profile) => {
      if (profile) emit(profile)
      return profile
    })
    .catch((error) => {
      console.debug("[useLiveProfile] Failed to load profile:", error)
      return null
    })
    .finally(() => {
      inflight.delete(userId)
    })

  inflight.set(userId, request)
  return request
}

/**
 * Live profile row for `userId`. Serves the cache instantly when warm, fetches
 * once otherwise, and re-renders on any realtime `profiles` UPDATE.
 */
export const useLiveProfile = (userId: string | null | undefined, enabled = true) => {
  const [profile, setProfile] = useState<Profile | null>(() => (userId ? cache.get(userId) ?? null : null))
  const [isLoading, setIsLoading] = useState(() => Boolean(userId && enabled && !cache.get(userId)))

  useEffect(() => {
    if (!userId || !enabled) {
      setProfile(null)
      setIsLoading(false)
      return
    }

    ensureRealtime()

    const cached = cache.get(userId)
    setProfile(cached ?? null)
    setIsLoading(!cached)

    const listener = (next: Profile) => setProfile(next)
    const bucket = listeners.get(userId) ?? new Set()
    bucket.add(listener)
    listeners.set(userId, bucket)

    let cancelled = false
    // Always refetch: the cache may hold a partial row from a list query.
    void fetchProfile(userId).then(() => {
      if (!cancelled) setIsLoading(false)
    })

    return () => {
      cancelled = true
      bucket.delete(listener)
      if (bucket.size === 0) listeners.delete(userId)
    }
  }, [enabled, userId])

  return { profile, isLoading }
}

/** Merge a fetched profile row over the UserData shape the UI components take. */
export const mergeProfileIntoUserData = (base: UserData, profile: Profile | null): UserData => {
  if (!profile) return base

  const nickname = profile.display_name?.trim() || profile.username || base.nickname

  return {
    ...base,
    id: profile.id || base.id,
    username: profile.username || base.username,
    nickname,
    bio: profile.bio ?? base.bio,
    pronouns: profile.pronouns ?? base.pronouns,
    avatar: { src: profile.avatar_url ?? base.avatar?.src ?? null, alt: nickname },
    banner: profile.banner_url ?? base.banner ?? null,
    status: (profile.status as UserStatus) ?? base.status,
    role: profile.role ?? base.role,
    is_verified: profile.is_verified ?? base.is_verified,
    is_admin: profile.is_admin ?? base.is_admin,
    createdAt: profile.created_at ?? base.createdAt,
  }
}
