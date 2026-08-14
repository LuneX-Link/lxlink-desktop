import { supabase } from "../supabase"

export interface Message {
  id: string
  channel_id: string
  author_id: string
  content: string
  is_deleted: boolean
  created_at: string
  updated_at: string
  type?: "default" | "system" | "welcome"
  is_edited?: boolean
  reply_to_id?: string | null
  profiles?: {
    username: string
    display_name: string | null
    avatar_url: string | null
  } | null
  attachments?: Attachment[]
  message_reactions?: Reaction[]
}

export interface Attachment {
  id: string
  message_id: string
  url: string
  filename: string
  mime_type: string | null
  size_bytes: number | null
  width: number | null
  height: number | null
}

export interface Reaction {
  id: string
  message_id: string
  user_id: string
  emoji: string
  created_at: string
}

const MESSAGE_PAGE_SIZE = 50

type BaseMessage = Pick<
  Message,
  "id" | "channel_id" | "author_id" | "content" | "is_deleted" | "created_at" | "updated_at"
>

const MESSAGE_COLUMNS = "id, channel_id, author_id, content, is_deleted, created_at, updated_at"

const getProfilesByAuthor = async (authorIds: string[]) => {
  if (authorIds.length === 0) return new Map<string, NonNullable<Message["profiles"]>>()

  const { data, error } = await supabase
    .from("profiles")
    .select("id, username, display_name, avatar_url")
    .in("id", authorIds)

  if (error) {
    console.debug("[Messages] Profiles are unavailable:", error.message)
    return new Map<string, NonNullable<Message["profiles"]>>()
  }

  return new Map((data || []).map((profile) => [profile.id, profile]))
}

const withProfiles = async (rows: BaseMessage[]): Promise<Message[]> => {
  const profiles = await getProfilesByAuthor([...new Set(rows.map((row) => row.author_id))])
  return rows.map((row) => ({
    ...row,
    reply_to_id: null,
    attachments: [],
    message_reactions: [],
    profiles: profiles.get(row.author_id) || null,
  }))
}

const getMessageById = async (messageId: string): Promise<Message | null> => {
  const { data, error } = await supabase
    .from("messages")
    .select(MESSAGE_COLUMNS)
    .eq("id", messageId)
    .maybeSingle()

  if (error || !data) return null
  return (await withProfiles([data as BaseMessage]))[0] || null
}

export const messagesApi = {
  /** Compatible with the minimal messages schema used by the running backend. */
  list: async (channelId: string, limit = MESSAGE_PAGE_SIZE, before?: string) => {
    let query = supabase
      .from("messages")
      .select(MESSAGE_COLUMNS)
      .eq("channel_id", channelId)
      .eq("is_deleted", false)
      .order("created_at", { ascending: false })
      .limit(limit)

    if (before) query = query.lt("created_at", before)

    const { data, error } = await query
    if (error) throw error

    return withProfiles((data || []) as BaseMessage[])
  },

  send: async (channelId: string, content: string, _replyToId?: string) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error("Not authenticated")

    const { data, error } = await supabase
      .from("messages")
      .insert({ channel_id: channelId, author_id: user.id, content })
      .select(MESSAGE_COLUMNS)
      .single()

    if (error) throw error

    const [message] = await withProfiles([data as BaseMessage])

    // Read markers are optional in older backend installations.
    void supabase.rpc("mark_channel_read", {
      p_channel_id: channelId,
      p_user_id: user.id,
    }).then(({ error: markError }) => {
      if (markError) console.debug("[Messages] Could not update read marker:", markError.message)
    })

    return message
  },

  /** The current database has no attachments table. Links are stored in message content instead. */
  addAttachments: async (
    _messageId: string,
    _attachments: Array<Pick<Attachment, "url" | "filename" | "mime_type" | "size_bytes">>,
  ) => [] as Attachment[],

  update: async (messageId: string, content: string) => {
    const { data, error } = await supabase
      .from("messages")
      .update({ content, updated_at: new Date().toISOString() })
      .eq("id", messageId)
      .select(MESSAGE_COLUMNS)
      .single()

    if (error) throw error
    return (await withProfiles([data as BaseMessage]))[0]
  },

  remove: async (messageId: string) => {
    const { error } = await supabase
      .from("messages")
      .update({ is_deleted: true, updated_at: new Date().toISOString() })
      .eq("id", messageId)

    if (error) throw error
  },

  /** Reactions require a migration not present in the running database. */
  addReaction: async (_messageId: string, _emoji: string) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error("Not authenticated")
    return user.id
  },

  removeReaction: async (_messageId: string, _emoji: string) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error("Not authenticated")
    return user.id
  },

  subscribeToChannel: (channelId: string, callback: (message: Message) => void) => {
    const channel = supabase
      .channel(`messages:${channelId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `channel_id=eq.${channelId}` },
        async (payload) => {
          const message = await getMessageById(String(payload.new.id))
          if (message) callback(message)
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "messages", filter: `channel_id=eq.${channelId}` },
        async (payload) => {
          if (payload.new.is_deleted) return
          const message = await getMessageById(String(payload.new.id))
          if (message) callback(message)
        },
      )
      .subscribe()

    return () => { void supabase.removeChannel(channel) }
  },
}
