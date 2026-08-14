import { supabase } from "../supabase"

export interface Channel {
  id: string
  space_id: string | null
  name: string
  description: string
  type: "text" | "voice" | "dm" | "group_dm"
  topic: string
  is_nsfw: boolean
  position: number
  created_at: string
  updated_at: string
}

export interface ChannelWithLastMessage extends Channel {
  last_message: string | null
  last_message_at: string | null
  unread_count: number
}

export const channelsApi = {
  /** Get channels for current user (uses RPC function) */
  getUserChannels: async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return []

    const { data, error } = await supabase
      .rpc("get_user_channels", { p_user_id: user.id })

    if (error) throw error
    return data as ChannelWithLastMessage[]
  },

  /** Get channels in a space */
  getBySpace: async (spaceId: string) => {
    const { data, error } = await supabase
      .from("channels")
      .select("*")
      .eq("space_id", spaceId)
      .order("position")

    if (error) throw error
    return data as Channel[]
  },

  /** Get single channel */
  getById: async (channelId: string) => {
    const { data, error } = await supabase
      .from("channels")
      .select("*")
      .eq("id", channelId)
      .single()

    if (error) throw error
    return data as Channel
  },

  /** Create a channel */
  create: async (payload: { name: string; type?: Channel["type"]; space_id?: string; description?: string }) => {
    const { data, error } = await supabase
      .from("channels")
      .insert({
        name: payload.name,
        type: payload.type || "text",
        space_id: payload.space_id || null,
        description: payload.description || "",
      })
      .select()
      .single()

    if (error) throw error
    return data as Channel
  },

  /** Get or create DM channel between two users */
  getOrCreateDM: async (otherUserId: string) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error("Not authenticated")

    // Use RPC function to get or create DM channel atomically
    const { data: channelId, error } = await supabase
      .rpc("get_or_create_dm_channel", {
        user1_id: user.id,
        user2_id: otherUserId,
      })

    if (error) {
      console.error("Failed to get or create DM channel:", error)
      throw error
    }

    return channelId
  },

  /** Mark channel as read */
  markRead: async (channelId: string) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { error } = await supabase
      .rpc("mark_channel_read", {
        p_channel_id: channelId,
        p_user_id: user.id,
      })

    if (error) throw error
  },

  /** Update channel */
  update: async (channelId: string, payload: Partial<Pick<Channel, "name" | "description" | "topic" | "position">>) => {
    const { data, error } = await supabase
      .from("channels")
      .update(payload)
      .eq("id", channelId)
      .select()
      .single()

    if (error) throw error
    return data as Channel
  },

  /** Delete channel */
  delete: async (channelId: string) => {
    const { error } = await supabase
      .from("channels")
      .delete()
      .eq("id", channelId)

    if (error) throw error
  },

  /** Subscribe to channel (DM) */
  subscribe: async (channelId: string) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error("Not authenticated")

    const { error } = await supabase
      .from("channel_members")
      .insert({ channel_id: channelId, user_id: user.id })

    if (error) throw error
  },

  /** Leave a channel — removes the current user's membership, keeping the channel intact. */
  leave: async (channelId: string) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error("Not authenticated")

    const { error } = await supabase
      .from("channel_members")
      .delete()
      .eq("channel_id", channelId)
      .eq("user_id", user.id)

    if (error) throw error
  },
}
