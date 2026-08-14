import { supabase } from "../supabase"
import type { UserRole } from "../../types"

export interface Profile {
  id: string
  username: string
  display_name: string | null
  email: string | null
  avatar_url: string | null
  banner_url: string | null
  bio: string
  pronouns: string | null
  status: "online" | "idle" | "dnd" | "invisible" | "offline"
  custom_status: string | null
  last_seen_at: string
  is_verified: boolean
  is_admin: boolean
  role: UserRole | null
  created_at: string
  updated_at: string
}

export const profilesApi = {
  /** Get current user's profile */
  getMe: async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null

    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single()

    if (error) throw error
    return data as Profile
  },

  /** Get profile by ID */
  getById: async (userId: string) => {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single()

    if (error) throw error
    return data as Profile
  },

  /** Get multiple profiles by IDs */
  getByIds: async (userIds: string[]) => {
    if (userIds.length === 0) return []

    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .in("id", userIds)

    if (error) throw error
    return data as Profile[]
  },

  /** Search users by username or display name */
  search: async (query: string, limit = 20) => {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, username, display_name, avatar_url, bio, status, role, is_verified, is_admin")
      .or(`username.ilike.%${query}%,display_name.ilike.%${query}%`)
      .limit(limit)

    if (error) throw error
    return data
  },

  /** Update current user's profile */
  updateMe: async (payload: Partial<Pick<Profile, "display_name" | "avatar_url" | "banner_url" | "bio" | "pronouns" | "custom_status">>) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error("Not authenticated")

    const { data, error } = await supabase
      .from("profiles")
      .update(payload)
      .eq("id", user.id)
      .select()
      .single()

    if (error) throw error
    return data as Profile
  },

  /** Update user's online status */
  updateStatus: async (status: Profile["status"], customStatus?: string) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { error } = await supabase
      .from("presence")
      .upsert({
        user_id: user.id,
        status,
        custom_status: customStatus || null,
        last_seen_at: new Date().toISOString(),
      }, { onConflict: "user_id" })

    if (error) throw error
  },

  /** Get presence for multiple users */
  getPresence: async (userIds: string[]) => {
    if (userIds.length === 0) return []

    const { data, error } = await supabase
      .from("presence")
      .select("user_id, status, custom_status, last_seen_at")
      .in("user_id", userIds)

    if (error) throw error
    return data
  },
}
