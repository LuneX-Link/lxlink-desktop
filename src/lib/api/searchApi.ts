import { supabase } from "../supabase"

export interface SearchResult {
  users: Array<{
    id: string
    username: string
    display_name: string | null
    avatar_url: string | null
    bio: string
    status: string
  }>
  messages: Array<{
    id: string
    content: string
    channel_id: string
    author_id: string
    created_at: string
    attachments?: Array<{
      id: string
      url: string
      filename: string
      mime_type: string | null
      size_bytes: number | null
    }>
    profiles: {
      username: string
      display_name: string | null
      avatar_url: string | null
    }
  }>
  channels: Array<{
    id: string
    name: string
    description: string
    type: string
    space_id: string | null
  }>
}

export const searchApi = {
  /** Full-text search via edge function */
  search: async (query: string, type: "all" | "users" | "messages" | "channels" = "all", limit = 20, channelId?: string): Promise<SearchResult> => {
    try {
      const { data, error } = await supabase.functions.invoke("search", {
        body: { query, type, limit, channel_id: channelId },
      })

      if (error) throw error
      return data as SearchResult
    } catch {
      // Fallback to direct Supabase queries if edge function is not available
      return searchApi.searchFallback(query, type, limit, channelId)
    }
  },

  /** Fallback search using direct Supabase queries */
  searchFallback: async (query: string, type: string, limit: number, channelId?: string): Promise<SearchResult> => {
    const results: SearchResult = { users: [], messages: [], channels: [] }

    if (type === "all" || type === "users") {
      const { data } = await supabase
        .from("profiles")
        .select("id, username, display_name, avatar_url, bio, status")
        .or(`username.ilike.%${query}%,display_name.ilike.%${query}%`)
        .limit(limit)
      results.users = data || []
    }

    if (type === "all" || type === "messages") {
      let q = supabase
        .from("messages")
        .select("id, content, channel_id, author_id, created_at")
        .ilike("content", `%${query}%`)
        .eq("is_deleted", false)
        .order("created_at", { ascending: false })
        .limit(limit)

      if (channelId) q = q.eq("channel_id", channelId)

      const { data, error } = await q
      if (!error && data) {
        const authorIds = [...new Set(data.map((message) => message.author_id))]
        const { data: profiles } = authorIds.length
          ? await supabase.from("profiles").select("id, username, display_name, avatar_url").in("id", authorIds)
          : { data: [] }
        const byAuthor = new Map((profiles || []).map((profile) => [profile.id, profile]))
        results.messages = data.map((message) => ({
          ...message,
          attachments: [],
          profiles: byAuthor.get(message.author_id) || {
            username: "user",
            display_name: null,
            avatar_url: null,
          },
        }))
      }
    }

    if (type === "all" || type === "channels") {
      const { data } = await supabase
        .from("channels")
        .select("id, name, description, type, space_id")
        .ilike("name", `%${query}%`)
        .limit(limit)
      results.channels = data || []
    }

    return results
  },
}
