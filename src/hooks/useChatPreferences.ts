import { useCallback, useEffect, useState } from "react"

// ── Chat preferences ────────────────────────────────────────────────────────
// The settings modal persists everything under `astrolune_settings`; chat only
// needs a couple of flags from it, so it reads the same blob and listens for
// the change event the modal dispatches after every save.

const SETTINGS_KEY = "astrolune_settings"
const REACTIONS_KEY = "astrolune_recent_reactions"

/** Dispatched by the settings modal whenever the local blob is rewritten. */
export const SETTINGS_CHANGED_EVENT = "astrolune:settings.changed"

/** Fallback palette used until the user has actually reacted to something. */
export const DEFAULT_REACTIONS = ["👍", "❤️", "😂", "🔥", "🎉", "😮", "😢", "👀"]

const MAX_RECENT_REACTIONS = 12

export interface ChatPreferences {
  /** Show the delivered/read ticks under own messages. */
  showReadReceipts: boolean
}

const DEFAULT_PREFERENCES: ChatPreferences = { showReadReceipts: true }

const readPreferences = (): ChatPreferences => {
  if (typeof window === "undefined") return DEFAULT_PREFERENCES
  try {
    const raw = window.localStorage.getItem(SETTINGS_KEY)
    if (!raw) return DEFAULT_PREFERENCES
    const parsed = JSON.parse(raw) as { privacy?: Record<string, boolean> }
    return { showReadReceipts: parsed.privacy?.readReceipts ?? DEFAULT_PREFERENCES.showReadReceipts }
  } catch {
    return DEFAULT_PREFERENCES
  }
}

export const useChatPreferences = (): ChatPreferences => {
  const [preferences, setPreferences] = useState<ChatPreferences>(readPreferences)

  useEffect(() => {
    const sync = () => setPreferences(readPreferences())
    window.addEventListener(SETTINGS_CHANGED_EVENT, sync)
    window.addEventListener("storage", sync)
    return () => {
      window.removeEventListener(SETTINGS_CHANGED_EVENT, sync)
      window.removeEventListener("storage", sync)
    }
  }, [])

  return preferences
}

const readRecentReactions = (): string[] => {
  if (typeof window === "undefined") return DEFAULT_REACTIONS
  try {
    const raw = window.localStorage.getItem(REACTIONS_KEY)
    const parsed = raw ? (JSON.parse(raw) as unknown) : null
    const stored = Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : []
    // Top up with defaults so the toolbar always has three emoji to show.
    return [...new Set([...stored, ...DEFAULT_REACTIONS])].slice(0, MAX_RECENT_REACTIONS)
  } catch {
    return DEFAULT_REACTIONS
  }
}

/** Most-recently-used emoji, newest first. Shared by the toolbar and menus. */
export const useRecentReactions = () => {
  const [recent, setRecent] = useState<string[]>(readRecentReactions)

  const remember = useCallback((emoji: string) => {
    setRecent((current) => {
      const next = [emoji, ...current.filter((item) => item !== emoji)].slice(0, MAX_RECENT_REACTIONS)
      try {
        window.localStorage.setItem(REACTIONS_KEY, JSON.stringify(next))
      } catch {
        // Storage is best-effort — the in-memory order still applies this session.
      }
      return next
    })
  }, [])

  return { recent, remember }
}
