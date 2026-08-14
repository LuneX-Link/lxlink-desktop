import { supabase } from "../supabase"

export interface Notification {
  id: string
  user_id: string
  type: "message" | "mention" | "friend_request" | "system"
  title: string
  body: string
  link: string | null
  is_read: boolean
  metadata: Record<string, unknown>
  created_at: string
}

export const notificationsSupabaseApi = {
  /** Get user's notifications */
  list: async (limit = 50, offset = 0) => {
    const { data, error } = await supabase
      .from("notifications")
      .select("*")
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) throw error
    return data as Notification[]
  },

  /** Get unread count */
  unreadCount: async () => {
    const { count, error } = await supabase
      .from("notifications")
      .select("*", { count: "exact", head: true })
      .eq("is_read", false)

    if (error) throw error
    return count || 0
  },

  /** Mark notification as read */
  markRead: async (id: string) => {
    const { error } = await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("id", id)

    if (error) throw error
  },

  /** Mark all notifications as read */
  markAllRead: async () => {
    const { error } = await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("is_read", false)

    if (error) throw error
  },

  /** Get notification preferences for a channel */
  getPrefs: async (channelId: string) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null

    const { data, error } = await supabase
      .from("notification_prefs")
      .select("*")
      .eq("user_id", user.id)
      .eq("channel_id", channelId)
      .single()

    if (error && error.code !== "PGRST116") throw error // PGRST116 = not found
    return data
  },

  /** Update notification preferences for a channel */
  updatePrefs: async (channelId: string, payload: { muted?: boolean; mention_only?: boolean }) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error("Not authenticated")

    const { data, error } = await supabase
      .from("notification_prefs")
      .upsert({
        user_id: user.id,
        channel_id: channelId,
        ...payload,
      }, { onConflict: "user_id,channel_id" })
      .select()
      .single()

    if (error) throw error
    return data
  },

  /** Subscribe to real-time notifications */
  subscribe: (callback: (notification: Notification) => void) => {
    const channel = supabase
      .channel("notifications")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
        },
        (payload) => {
          callback(payload.new as Notification)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  },
}
