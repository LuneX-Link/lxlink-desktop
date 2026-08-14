import { supabase } from "../supabase"

export interface UserSettings {
  id: string
  user_id: string
  theme: string
  locale: string
  notifications_enabled: boolean
  sound_notifications: boolean
  message_notifications: boolean
  mention_notifications: boolean
  created_at: string
  updated_at: string
}

export const settingsApi = {
  /** Get current user's settings */
  get: async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null

    const { data, error } = await supabase
      .from("user_settings")
      .select("*")
      .eq("user_id", user.id)
      .single()

    if (error && error.code !== "PGRST116") throw error
    return data as UserSettings | null
  },

  /** Update current user's settings */
  update: async (payload: Partial<Pick<UserSettings, "theme" | "locale" | "notifications_enabled" | "sound_notifications" | "message_notifications" | "mention_notifications">>) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error("Not authenticated")

    const { data, error } = await supabase
      .from("user_settings")
      .upsert({
        user_id: user.id,
        ...payload,
      }, { onConflict: "user_id" })
      .select()
      .single()

    if (error) throw error
    return data as UserSettings
  },

  /** Subscribe to settings changes */
  subscribe: (callback: (settings: UserSettings) => void) => {
    const channel = supabase
      .channel("user-settings")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "user_settings",
        },
        (payload) => {
          callback(payload.new as UserSettings)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  },
}
