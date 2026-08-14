import { invoke as tauriInvoke } from '@tauri-apps/api/core'
import { listen as tauriListen, type UnlistenFn as TauriUnlistenFn } from '@tauri-apps/api/event'

const COMMAND_ALIASES: Record<string, string> = {
  "realtime.connect": "realtime_connect",
  "realtime.disconnect": "realtime_disconnect",
  "realtime.channel.join": "realtime_channel_join",
  "realtime.channel.leave": "realtime_channel_leave",
  "realtime.presence.update": "realtime_presence_update",
  "realtime.typing.start": "realtime_typing_start",
  "realtime.voice_state.update": "realtime_voice_state_update",
  "realtime.dispatch": "realtime_dispatch",
}

const DEV_USER = {
  id: "331395309798166528",
  email: "ankerin024@astrolune.ru",
  username: "ankerin",
  displayName: "Ankerin",
  avatar: null,
  subscription_tier: "free",
  is_verified: true,
  is_admin: false,
  created_at: "2026-07-03T11:26:38.883633Z",
}

const DEV_MESSAGES = [
  { id: "m-1", channelId: "ch-1", authorId: "331395309798166528", authorUsername: "ankerin", content: "Welcome to Astrolune!", createdAt: new Date().toISOString(), reactions: [] },
  { id: "m-2", channelId: "ch-1", authorId: "bot-1", authorUsername: "AstroBot", content: "Server is online and running.", createdAt: new Date().toISOString(), reactions: [] },
]

const MOCK_COMMANDS: Record<string, unknown> = {
  is_authenticated: true,
  get_current_user_id: "331395309798166528",
  get_refresh_token: "mock-refresh-token",
  get_profile: DEV_USER,
  get_me: DEV_USER,
  get_user: DEV_USER,
  get_messages: DEV_MESSAGES,
  get_notifications: [],
  get_notification_unread_count: 0,
  get_notification_prefs: { email: true, push: true },
  get_subscription: { tier: "free" },
  get_gpu_vendor: "Mock GPU",
  get_capture_status: { active: false },
  get_voice_state: { inVoice: false },
  // Auth commands
  login: { user: DEV_USER, token: "mock-token", refresh_token: "mock-refresh" },
  register: { user: DEV_USER, token: "mock-token", refresh_token: "mock-refresh" },
  logout: null,
  // Chat commands
  send_message: { id: "m-new", channelId: "ch-1", authorId: "331395309798166528", authorUsername: "ankerin", content: "", createdAt: new Date().toISOString(), reactions: [] },
  // Voice commands
  get_voice_token: { token: "mock-voice-token", url: "wss://mock.livekit.io" },
  join_voice: { success: true },
  leave_voice: { success: true },
  // Notification commands
  mark_notification_read: { success: true },
  mark_all_notifications_read: { success: true },
  // Settings commands
  get_settings: { theme: "dark", locale: "en-US", notificationsEnabled: true },
  update_settings: { success: true },
}

export async function invoke<T = unknown>(command: string, args?: Record<string, unknown>): Promise<T> {
  // Always use mock data when Tauri bridge is not available
  if (!isHostBridgeAvailable()) {
    if (command in MOCK_COMMANDS) {
      return MOCK_COMMANDS[command] as T
    }
    // Return empty array for list commands, null for others
    if (command.startsWith("get_") && command.endsWith("s")) {
      return [] as T
    }
    return undefined as T
  }

  // Try mock first for known commands
  if (command in MOCK_COMMANDS) {
    return MOCK_COMMANDS[command] as T
  }

  try {
    return await tauriInvoke<T>(COMMAND_ALIASES[command] ?? command, args)
  } catch {
    // fallback to mock for unknown commands
    return undefined as T
  }
}

export async function invokeStrict<T = unknown>(command: string, args?: Record<string, unknown>): Promise<T> {
  if (!isHostBridgeAvailable()) {
    throw new Error(`Tauri command ${command} is unavailable outside the desktop client`)
  }

  return await tauriInvoke<T>(COMMAND_ALIASES[command] ?? command, args)
}

export function isHostBridgeAvailable(): boolean {
  return typeof window !== 'undefined' && (
    '__TAURI_INTERNALS__' in window ||
    '__TAURI__' in window
  )
}

export async function listen<T = unknown>(event: string, handler: (data: T) => void): Promise<UnlistenFn> {
  // If Tauri is not available, return a no-op unlisten function
  if (!isHostBridgeAvailable()) {
    return () => {}
  }

  try {
    const unlisten = await tauriListen<T>(event, (evt) => handler(evt.payload))
    return unlisten
  } catch {
    // Return no-op if listen fails
    return () => {}
  }
}

export type UnlistenFn = TauriUnlistenFn
