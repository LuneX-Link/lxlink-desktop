import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { messagesApi, type Attachment, type Message as SupabaseMessage } from "../lib/api/messagesApi"
import { useToast } from "./useToast"

const PAGE_SIZE = 50

export type ChatMessageStatus = "pending" | "sent" | "delivered" | "read"

export type Message = {
  id: string
  messageId: string
  channelId: string
  authorId: string
  content: string
  replyToId: string | null
  attachments: string[]
  attachmentDetails: Attachment[]
  createdAt: string
  editedAt: string | null
  isDeleted: boolean
  reactions: Record<string, string[]>
  status?: ChatMessageStatus
  // Profile data from Supabase join
  author?: {
    username: string
    display_name: string | null
    avatar_url: string | null
  }
}

type ChatMessagesState = {
  messages: Message[]
  isLoading: boolean
  hasMore: boolean
  error: string | null
}

/** Convert Supabase message to our internal Message type */
const fromSupabase = (msg: SupabaseMessage): Message => {
  // Reactions: convert from array of {emoji, user_id} to Record<string, string[]>
  const reactions: Record<string, string[]> = {}
  if (msg.message_reactions) {
    for (const r of msg.message_reactions) {
      if (!reactions[r.emoji]) reactions[r.emoji] = []
      reactions[r.emoji].push(r.user_id)
    }
  }

  // Attachments: extract URLs
  const attachmentDetails = msg.attachments || []
  const attachments = attachmentDetails.map((a) => a.url)

  return {
    id: msg.id,
    messageId: msg.id,
    channelId: msg.channel_id,
    authorId: msg.author_id,
    content: msg.content,
    replyToId: msg.reply_to_id ?? null,
    attachments,
    attachmentDetails,
    createdAt: msg.created_at,
    editedAt: msg.updated_at && msg.updated_at !== msg.created_at ? msg.updated_at : null,
    isDeleted: msg.is_deleted,
    reactions,
    author: msg.profiles ? {
      username: msg.profiles.username,
      display_name: msg.profiles.display_name,
      avatar_url: msg.profiles.avatar_url,
    } : undefined,
  }
}

export const useChatMessages = (channelId: string) => {
  const { showErrorToast } = useToast()
  const [state, setState] = useState<ChatMessagesState>({
    messages: [],
    isLoading: false,
    hasMore: true,
    error: null,
  })
  const cursorRef = useRef<string | undefined>(undefined)

  // Load initial messages
  const loadInitial = useCallback(async () => {
    cursorRef.current = undefined
    if (!channelId) {
      setState({ messages: [], isLoading: false, hasMore: false, error: null })
      return
    }

    setState({ messages: [], isLoading: true, hasMore: true, error: null })

    try {
      const items = await messagesApi.list(channelId, PAGE_SIZE)
      const normalized = items.map(fromSupabase)

      setState({
        messages: normalized,
        hasMore: normalized.length === PAGE_SIZE,
        isLoading: false,
        error: null,
      })

      cursorRef.current = normalized.at(-1)?.createdAt
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Failed to load messages"
      showErrorToast("Messages", message)
      setState((prev) => ({ ...prev, error: message, isLoading: false }))
    }
  }, [channelId, showErrorToast])

  // Load more (older) messages
  const loadMore = useCallback(async () => {
    if (state.isLoading || !state.hasMore || !channelId) return

    setState((prev) => ({ ...prev, isLoading: true }))
    try {
      const items = await messagesApi.list(channelId, PAGE_SIZE, cursorRef.current)
      const normalized = items.map(fromSupabase)

      setState((prev) => ({
        ...prev,
        messages: [...prev.messages, ...normalized.filter((item) => !prev.messages.some((message) => message.id === item.id))],
        hasMore: normalized.length === PAGE_SIZE,
        isLoading: false,
      }))

      cursorRef.current = normalized.at(-1)?.createdAt
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Failed to load messages"
      showErrorToast("Messages", message)
      setState((prev) => ({ ...prev, error: message, isLoading: false }))
    }
  }, [channelId, showErrorToast, state.hasMore, state.isLoading])

  const reload = useCallback(() => {
    void loadInitial()
  }, [loadInitial])

  // Send message
  const sendMessage = useCallback(async (content: string, replyToId?: string) => {
    const created = await messagesApi.send(channelId, content, replyToId)
    const message = fromSupabase(created)

    setState((prev) => ({
      ...prev,
      messages: [message, ...prev.messages.filter((m) => m.id !== message.id)],
    }))

    return message
  }, [channelId])

  const addAttachments = useCallback(async (
    messageId: string,
    attachments: Array<Pick<Attachment, "url" | "filename" | "mime_type" | "size_bytes">>,
  ) => {
    const created = await messagesApi.addAttachments(messageId, attachments)
    setState((prev) => ({
      ...prev,
      messages: prev.messages.map((message) =>
        message.id === messageId
          ? {
              ...message,
              attachments: [...message.attachments, ...created.map((attachment) => attachment.url)],
              attachmentDetails: [...message.attachmentDetails, ...created],
            }
          : message,
      ),
    }))
    return created
  }, [])

  // Edit message
  const editMessage = useCallback(async (messageId: string, content: string) => {
    const updated = await messagesApi.update(messageId, content)
    const message = fromSupabase(updated)

    setState((prev) => ({
      ...prev,
      messages: prev.messages.map((m) => (m.id === message.id ? message : m)),
    }))

    return message
  }, [])

  // Delete message
  const deleteMessage = useCallback(async (messageId: string) => {
    await messagesApi.remove(messageId)
    setState((prev) => ({
      ...prev,
      messages: prev.messages.filter((m) => m.id !== messageId),
    }))
  }, [])

  // Reactions
  const addReaction = useCallback(async (messageId: string, emoji: string) => {
    const userId = await messagesApi.addReaction(messageId, emoji)
    setState((prev) => ({
      ...prev,
      messages: prev.messages.map((message) =>
        message.id === messageId
          ? { ...message, reactions: { ...message.reactions, [emoji]: [...new Set([...(message.reactions[emoji] || []), userId])] } }
          : message,
      ),
    }))
  }, [])

  const removeReaction = useCallback(async (messageId: string, emoji: string) => {
    const userId = await messagesApi.removeReaction(messageId, emoji)
    setState((prev) => ({
      ...prev,
      messages: prev.messages.map((message) =>
        message.id === messageId
          ? { ...message, reactions: { ...message.reactions, [emoji]: (message.reactions[emoji] || []).filter((reactionUserId) => reactionUserId !== userId) } }
          : message,
      ),
    }))
  }, [])

  // Subscribe to Supabase Realtime for this channel
  useEffect(() => {
    if (!channelId) return

    const unsubscribe = messagesApi.subscribeToChannel(channelId, (msg) => {
      const message = fromSupabase(msg)

      setState((prev) => {
        // Check if message already exists (for updates)
        const exists = prev.messages.find((m) => m.id === message.id)
        if (exists) {
          return {
            ...prev,
            messages: prev.messages.map((m) => (m.id === message.id ? message : m)),
          }
        }
        // New message — add to top
        return {
          ...prev,
          messages: [message, ...prev.messages.filter((m) => m.id !== message.id)],
        }
      })
    })

    return () => {
      unsubscribe()
    }
  }, [channelId])

  // Load initial messages on channel change
  useEffect(() => {
    void loadInitial()
  }, [loadInitial])

  return useMemo(
    () => ({
      ...state,
      loadInitial,
      loadMore,
      reload,
      sendMessage,
      addAttachments,
      editMessage,
      deleteMessage,
      addReaction,
      removeReaction,
    }),
    [addAttachments, addReaction, deleteMessage, editMessage, loadInitial, loadMore, reload, removeReaction, sendMessage, state],
  )
}
