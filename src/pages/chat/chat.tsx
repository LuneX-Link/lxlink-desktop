import type React from "react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import EmojiPicker, { EmojiStyle, SkinTones, Theme, type EmojiClickData } from "emoji-picker-react"
import {
  Bell,
  BellOff,
  Copy,
  File,
  FileImage,
  Files,
  Hash,
  LoaderCircle,
  Maximize2,
  MessageSquare,
  Mic,
  MicOff,
  MoreHorizontal,
  Paperclip,
  Phone,
  PhoneOff,
  Pin,
  Reply,
  Search,
  Send,
  Share2,
  Smile,
  Video,
  VideoOff,
  Volume2,
  VolumeX,
  X,
} from "lucide-react"
import { useParams } from "react-router-dom"
import { Avatar, type AvatarStatus } from "../../components/avatar/avatar"
import { ProfileModal } from "../../components/profile-modal/profile-modal"
import { Menu, type MenuItem } from "../../components/ui/menu/menu"
import { Popover } from "../../components/ui/popover/popover"
import { Tooltip } from "../../components/ui/tooltip/tooltip"
import { useAuthSession } from "../../contexts/auth-context"
import { useCall } from "../../contexts/call-context"
import { useChatMessages, type Message } from "../../hooks/useChatMessages"
import { useChatPreferences, useRecentReactions } from "../../hooks/useChatPreferences"
import { usePresence } from "../../hooks/usePresence"
import { useRealtimeEvent } from "../../hooks/useRealtimeEvent"
import { useToast } from "../../hooks/useToast"
import { channelsApi, type Channel } from "../../lib/api/channelsApi"
import { profilesApi, type Profile } from "../../lib/api/profilesApi"
import { searchApi, type SearchResult } from "../../lib/api/searchApi"
import { storageApi } from "../../lib/api/storageApi"
import { formatFileSize } from "../../lib/attachments"
import { formatDayLabel } from "../../lib/format-time"
import type { UserData } from "../../types"
import { MessageItem } from "./message-item"
import {
  ChatSearchPanel,
  type SearchDateFilter,
  type SearchFileFilter,
  type SearchResultRow,
} from "./chat-search-panel"
import "./chat.scss"

type CachedProfile = Pick<
  Profile,
  "id" | "username" | "display_name" | "avatar_url" | "banner_url" | "bio" | "pronouns" | "status" | "custom_status" | "role" | "is_verified" | "is_admin" | "created_at"
>
type SearchMessage = SearchResult["messages"][number]

const TYPING_TTL_MS = 3500
const MAX_FILE_SIZE = 25 * 1024 * 1024
const profileCache = new Map<string, CachedProfile>()

const isSameDay = (left: string, right: string) =>
  new Date(left).toDateString() === new Date(right).toDateString()

const getInitials = (name: string) =>
  name
    .split(/[\s-_]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "#"

const toAvatarStatus = (status?: string): AvatarStatus => {
  if (status === "online" || status === "dnd" || status === "offline" || status === "invisible") return status
  return status === "idle" ? "inactive" : "offline"
}

const statusLabel = (status: string) =>
  status === "online" ? "В сети" : status === "idle" ? "Не активен" : status === "dnd" ? "Не беспокоить" : "Не в сети"

/** Build the shape ProfileModal expects out of whatever profile row we hold. */
const toUserData = (profile: CachedProfile): UserData => ({
  id: profile.id,
  avatar: { src: profile.avatar_url, alt: profile.display_name || profile.username },
  banner: profile.banner_url ?? null,
  username: profile.username,
  nickname: profile.display_name || profile.username,
  bio: profile.bio ?? "",
  pronouns: profile.pronouns ?? undefined,
  status: toAvatarStatus(profile.status),
  role: profile.role ?? null,
  is_verified: profile.is_verified,
  is_admin: profile.is_admin,
  createdAt: profile.created_at,
})

export const ChatPage: React.FC = () => {
  const { chatId } = useParams<{ chatId?: string }>()
  const channelId = chatId ?? ""
  const { user } = useAuthSession()
  const call = useCall()
  const { presence, loadPresence } = usePresence()
  const { showErrorToast, showSuccessToast, showWarningToast } = useToast()
  const { showReadReceipts } = useChatPreferences()
  const { recent: recentReactions, remember: rememberReaction } = useRecentReactions()
  const {
    messages,
    isLoading,
    hasMore,
    error,
    loadMore,
    sendMessage,
    editMessage,
    deleteMessage,
    addReaction,
    removeReaction,
  } = useChatMessages(channelId)

  const [channel, setChannel] = useState<Channel | null>(null)
  const [peerProfile, setPeerProfile] = useState<CachedProfile | null>(null)
  const [draft, setDraft] = useState("")
  const [typingUsers, setTypingUsers] = useState<Record<string, number>>({})
  const [authorProfiles, setAuthorProfiles] = useState<Map<string, CachedProfile>>(new Map())
  const [queuedFiles, setQueuedFiles] = useState<File[]>([])
  const [isSending, setIsSending] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [emojiOpen, setEmojiOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<SearchMessage[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [authorFilter, setAuthorFilter] = useState("all")
  const [dateFilter, setDateFilter] = useState<SearchDateFilter>("all")
  const [customDate, setCustomDate] = useState<string | null>(null)
  const [fileFilter, setFileFilter] = useState<SearchFileFilter>("any")
  const [replyingTo, setReplyingTo] = useState<Message | null>(null)
  const [highlightedMessage, setHighlightedMessage] = useState<string | null>(null)
  const [notificationsMuted, setNotificationsMuted] = useState(false)
  const [notifMenu, setNotifMenu] = useState<{ x: number; y: number } | null>(null)
  const [moreMenu, setMoreMenu] = useState<{ x: number; y: number } | null>(null)
  const [pinnedAnchor, setPinnedAnchor] = useState<HTMLElement | null>(null)
  const [profileTarget, setProfileTarget] = useState<UserData | null>(null)
  const [callDuration, setCallDuration] = useState(0)

  const scrollRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const emojiRef = useRef<HTMLDivElement>(null)
  const previousScrollHeight = useRef(0)
  const initialScrollChannel = useRef<string | null>(null)
  const newestMessageRef = useRef<string | null>(null)
  const isNearBottomRef = useRef(true)

  useEffect(() => {
    if (!channelId) return
    initialScrollChannel.current = null
    newestMessageRef.current = null
    isNearBottomRef.current = true
    let cancelled = false
    setChannel(null)
    setPeerProfile(null)
    channelsApi
      .getById(channelId)
      .then(async (nextChannel) => {
        if (cancelled) return
        setChannel(nextChannel)
        if (nextChannel.type !== "dm" || !user?.id) return
        const peerId = nextChannel.name.split("_").find((part) => part !== "dm" && part !== user.id && part.length > 10)
        if (!peerId) return
        try {
          const profile = await profilesApi.getById(peerId)
          if (cancelled) return
          const compact = profile as CachedProfile
          profileCache.set(profile.id, compact)
          setPeerProfile(compact)
          void loadPresence([profile.id])
        } catch (loadError) {
          console.debug("[Chat] Failed to load DM peer", loadError)
        }
      })
      .catch(() => setChannel(null))
    return () => {
      cancelled = true
    }
  }, [channelId, loadPresence, user?.id])

  useEffect(() => {
    if (isLoading || messages.length === 0) return
    const newestId = messages.at(0)?.messageId ?? null
    const isFirstPositioning = initialScrollChannel.current !== channelId
    const hasNewMessage = newestMessageRef.current !== null && newestMessageRef.current !== newestId

    requestAnimationFrame(() => {
      const element = scrollRef.current
      if (!element) return
      if (isFirstPositioning) {
        element.scrollTop = element.scrollHeight
        initialScrollChannel.current = channelId
      } else if (hasNewMessage && isNearBottomRef.current) {
        element.scrollTo({ top: element.scrollHeight, behavior: "smooth" })
      }
      newestMessageRef.current = newestId
    })
  }, [channelId, isLoading, messages])

  useEffect(() => {
    if (!messages.length || !user) return
    const authorIds = [...new Set(messages.map((message) => message.authorId).filter((id) => id !== user.id && id !== "me"))]
    if (authorIds.length === 0) return
    void loadPresence(authorIds)
    const missing = authorIds.filter((id) => !profileCache.has(id))
    if (missing.length === 0) {
      setAuthorProfiles(new Map(authorIds.flatMap((id) => (profileCache.has(id) ? [[id, profileCache.get(id)!] as const] : []))))
      return
    }
    profilesApi
      .getByIds(missing)
      .then((profiles) => {
        profiles.forEach((profile) => profileCache.set(profile.id, profile as CachedProfile))
        setAuthorProfiles(new Map(authorIds.flatMap((id) => (profileCache.has(id) ? [[id, profileCache.get(id)!] as const] : []))))
      })
      .catch((loadError) => console.debug("[Chat] Failed to load message authors", loadError))
  }, [loadPresence, messages, user])

  useEffect(() => {
    const element = textareaRef.current
    if (!element) return
    element.style.height = "auto"
    element.style.height = `${Math.min(element.scrollHeight, 128)}px`
  }, [draft])

  useEffect(() => {
    const closeFloating = (event: MouseEvent) => {
      if (emojiRef.current && !emojiRef.current.contains(event.target as Node)) setEmojiOpen(false)
    }
    document.addEventListener("mousedown", closeFloating)
    return () => document.removeEventListener("mousedown", closeFloating)
  }, [])

  useEffect(() => {
    const timer = window.setInterval(() => {
      const now = Date.now()
      setTypingUsers((previous) => Object.fromEntries(Object.entries(previous).filter(([, expiresAt]) => expiresAt > now)))
    }, 1000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    if (!call.isConnected) {
      setCallDuration(0)
      return
    }
    const startedAt = Date.now()
    const timer = window.setInterval(() => setCallDuration(Math.floor((Date.now() - startedAt) / 1000)), 1000)
    return () => window.clearInterval(timer)
  }, [call.isConnected])

  useEffect(() => {
    if (!searchOpen) return
    const timer = window.setTimeout(async () => {
      if (!searchQuery.trim()) {
        setSearchResults([])
        return
      }
      setIsSearching(true)
      try {
        const result = await searchApi.search(searchQuery.trim(), "messages", 60, channelId)
        setSearchResults(result.messages)
      } catch {
        setSearchResults([])
      } finally {
        setIsSearching(false)
      }
    }, 280)
    return () => window.clearTimeout(timer)
  }, [channelId, searchOpen, searchQuery])

  const handleTyping = useCallback(
    ({ payload }: { payload: unknown }) => {
      const data = payload as { channelId?: string; channel_id?: string; userId?: string; user_id?: string; displayName?: string }
      const eventChannelId = data.channelId ?? data.channel_id
      const userId = data.userId ?? data.user_id
      if (eventChannelId !== channelId || !userId || userId === user?.id) return
      setTypingUsers((previous) => ({ ...previous, [data.displayName ?? userId]: Date.now() + TYPING_TTL_MS }))
    },
    [channelId, user?.id],
  )

  useRealtimeEvent("typing", handleTyping)
  useRealtimeEvent("realtime://typing", handleTyping)

  const orderedMessages = useMemo(() => [...messages].reverse(), [messages])
  const headerName = peerProfile?.display_name || peerProfile?.username || channel?.name || "Чат"
  const peerPresence = peerProfile ? presence.get(peerProfile.id) : undefined
  const headerStatus = peerPresence?.status || peerProfile?.status || "offline"
  const headerSubtitle = peerProfile
    ? peerPresence?.customStatus || statusLabel(headerStatus)
    : channel?.topic || channel?.description || "Сообщения и файлы"
  const typingLabel = Object.keys(typingUsers).join(", ")

  const searchAuthors = useMemo(() => {
    const authors = new Map<string, { id: string; name: string; avatar: string | null }>()
    messages.forEach((message) => {
      if (authors.has(message.authorId)) return
      const isOwn = message.authorId === user?.id || message.authorId === "me"
      const profile = authorProfiles.get(message.authorId) || profileCache.get(message.authorId)
      authors.set(message.authorId, {
        id: message.authorId,
        name: isOwn ? "Вы" : profile?.display_name || profile?.username || "Пользователь",
        avatar: isOwn ? null : profile?.avatar_url ?? null,
      })
    })
    return [...authors.values()]
  }, [authorProfiles, messages, user?.id])

  const searchRows = useMemo<SearchResultRow[]>(() => {
    const now = Date.now()
    const periods: Partial<Record<SearchDateFilter, number>> = {
      today: 86_400_000,
      yesterday: 172_800_000,
      week: 604_800_000,
      month: 2_592_000_000,
      quarter: 7_776_000_000,
      half_year: 15_552_000_000,
      year: 31_536_000_000,
    }
    const period = periods[dateFilter] ?? Infinity

    return searchResults
      .filter((result) => {
        if (authorFilter !== "all" && result.author_id !== authorFilter) return false
        const attachmentCount = result.attachments?.length ?? 0
        if (fileFilter === "with" && attachmentCount === 0) return false
        if (fileFilter === "without" && attachmentCount > 0) return false
        if (dateFilter === "custom" && customDate) {
          if (new Date(result.created_at).toDateString() !== new Date(`${customDate}T00:00:00`).toDateString()) return false
        } else if (period !== Infinity && now - new Date(result.created_at).getTime() > period) {
          return false
        }
        return true
      })
      .map((result) => ({
        id: result.id,
        content: result.content,
        createdAt: result.created_at,
        authorId: result.author_id,
        authorName: result.profiles?.display_name || result.profiles?.username || "Пользователь",
        authorAvatar: result.profiles?.avatar_url ?? null,
        attachmentCount: result.attachments?.length ?? 0,
      }))
  }, [authorFilter, customDate, dateFilter, fileFilter, searchResults])

  const addFiles = useCallback(
    (files: FileList | File[]) => {
      const accepted = Array.from(files).filter((file) => {
        if (file.size <= MAX_FILE_SIZE) return true
        showWarningToast("Файл слишком большой", `${file.name}: максимум 25 МБ`)
        return false
      })
      setQueuedFiles((current) => [...current, ...accepted].slice(0, 10))
    },
    [showWarningToast],
  )

  const handleDraftChange = useCallback((event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setDraft(event.target.value)
  }, [])

  const handleSubmit = useCallback(async () => {
    const content = draft.trim()
    if ((!content && queuedFiles.length === 0) || isSending) return
    setIsSending(true)
    try {
      const uploaded = await Promise.all(queuedFiles.map((file) => storageApi.uploadAttachment(file, channelId)))
      const attachmentText = uploaded.map((file) => `📎 ${file.filename}: ${file.url}`).join("\n")
      const messageContent = [content, attachmentText].filter(Boolean).join("\n\n")
      await sendMessage(messageContent, replyingTo?.messageId)
      setDraft("")
      setQueuedFiles([])
      setReplyingTo(null)
      setEmojiOpen(false)
      requestAnimationFrame(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }))
    } catch (sendError) {
      showErrorToast("Сообщение не отправлено", sendError instanceof Error ? sendError.message : "Попробуйте ещё раз")
    } finally {
      setIsSending(false)
    }
  }, [channelId, draft, isSending, queuedFiles, replyingTo?.messageId, sendMessage, showErrorToast])

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault()
        void handleSubmit()
      }
      if (event.key === "Escape") {
        setReplyingTo(null)
        setEmojiOpen(false)
      }
    },
    [handleSubmit],
  )

  const handleScroll = useCallback(() => {
    const element = scrollRef.current
    if (!element) return
    isNearBottomRef.current = element.scrollHeight - element.scrollTop - element.clientHeight < 120
    if (element.scrollTop > 140 || !hasMore || isLoading) return
    previousScrollHeight.current = element.scrollHeight
    void loadMore().then(() =>
      requestAnimationFrame(() => {
        if (scrollRef.current) scrollRef.current.scrollTop += scrollRef.current.scrollHeight - previousScrollHeight.current
      }),
    )
  }, [hasMore, isLoading, loadMore])

  const toggleReaction = useCallback(
    (message: Message, emoji: string) => {
      rememberReaction(emoji)
      const alreadyReacted = user?.id ? message.reactions?.[emoji]?.includes(user.id) : false
      void (alreadyReacted ? removeReaction(message.messageId, emoji) : addReaction(message.messageId, emoji))
    },
    [addReaction, rememberReaction, removeReaction, user?.id],
  )

  const insertEmoji = useCallback(
    (emojiData: EmojiClickData) => {
      const textarea = textareaRef.current
      const start = textarea?.selectionStart ?? draft.length
      const end = textarea?.selectionEnd ?? draft.length
      setDraft((current) => `${current.slice(0, start)}${emojiData.emoji}${current.slice(end)}`)
      requestAnimationFrame(() => {
        textarea?.focus()
        const caret = start + emojiData.emoji.length
        textarea?.setSelectionRange(caret, caret)
      })
    },
    [draft.length],
  )

  const jumpToMessage = useCallback(
    (messageId: string) => {
      const element = document.querySelector<HTMLElement>(`[data-message-id="${messageId}"]`)
      if (!element) {
        showWarningToast("Сообщение вне загруженной истории", "Прокрутите чат выше, чтобы догрузить старые сообщения")
        return
      }
      element.scrollIntoView({ behavior: "smooth", block: "center" })
      setHighlightedMessage(messageId)
      window.setTimeout(() => setHighlightedMessage(null), 1800)
    },
    [showWarningToast],
  )

  const openProfileFor = useCallback(
    (authorId: string, isOwn: boolean) => {
      if (isOwn) {
        if (!user?.id) return
        setProfileTarget({
          id: user.id,
          avatar: { src: null, alt: user.displayName || user.username },
          username: user.username,
          nickname: user.displayName || user.username,
          bio: "",
        })
        return
      }
      const profile = authorProfiles.get(authorId) || profileCache.get(authorId)
      if (!profile) return
      setProfileTarget(toUserData(profile))
    },
    [authorProfiles, user?.displayName, user?.id, user?.username],
  )

  const startCall = useCallback(
    async (withVideo = false) => {
      if (!user || call.isConnecting) return
      try {
        if (!call.isConnected) await call.connect(channelId, user.id, user.displayName || user.username)
        if (withVideo && !call.isCameraOn) await call.toggleCamera()
      } catch (callError) {
        showErrorToast("Не удалось начать звонок", callError instanceof Error ? callError.message : "Проверьте устройства")
      }
    },
    [call, channelId, showErrorToast, user],
  )

  const runCallAction = useCallback(
    (action: () => Promise<void>) => {
      void action().catch((callError) =>
        showErrorToast("Управление звонком", callError instanceof Error ? callError.message : "Операция не выполнена"),
      )
    },
    [showErrorToast],
  )

  const formatDuration = (seconds: number) =>
    `${Math.floor(seconds / 60).toString().padStart(2, "0")}:${(seconds % 60).toString().padStart(2, "0")}`

  // Anchor header menus under the button, right-aligned to its edge — same
  // geometry the profile modal uses.
  const anchorFor = (event: React.MouseEvent) => {
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
    return { x: rect.right, y: rect.bottom + 6 }
  }

  const notifMenuItems: MenuItem[] = [
    { label: "Все уведомления", icon: <Bell size={15} />, onClick: () => setNotificationsMuted(false) },
    { label: "Только упоминания", icon: <MessageSquare size={15} />, onClick: () => setNotificationsMuted(false) },
    { label: "Ничего", icon: <BellOff size={15} />, onClick: () => setNotificationsMuted(true) },
    { separator: true },
    { label: "Отключить уведомления чата", icon: <BellOff size={15} />, onClick: () => setNotificationsMuted(true) },
  ]

  const moreMenuItems: MenuItem[] = [
    {
      label: "Копировать ID",
      icon: <Copy size={15} />,
      onClick: () => {
        void navigator.clipboard.writeText(channelId)
        showSuccessToast("ID чата скопирован")
      },
    },
    { label: "Показать файлы", icon: <Files size={15} />, onClick: () => setSearchOpen(true) },
  ]

  const resetSearchFilters = useCallback(() => {
    setAuthorFilter("all")
    setDateFilter("all")
    setCustomDate(null)
    setFileFilter("any")
  }, [])

  if (!channelId) {
    return (
      <div className="chat-page chat-page--empty">
        <Hash size={30} />
        <h2>Выберите чат</h2>
      </div>
    )
  }

  return (
    <section
      className={`chat-page${searchOpen ? " chat-page--search-open" : ""}${isDragging ? " chat-page--dragging" : ""}`}
      onDragEnter={(event) => {
        event.preventDefault()
        setIsDragging(true)
      }}
      onDragOver={(event) => event.preventDefault()}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node)) setIsDragging(false)
      }}
      onDrop={(event) => {
        event.preventDefault()
        setIsDragging(false)
        addFiles(event.dataTransfer.files)
      }}
    >
      <div className="chat-page__main">
        <header className="chat-page__header">
          {/* Avatar + nickname act as one button that opens the profile modal. */}
          <button
            type="button"
            className="chat-page__identity"
            disabled={!peerProfile}
            onClick={() => peerProfile && setProfileTarget(toUserData(peerProfile))}
          >
            <Avatar
              size={30}
              src={peerProfile?.avatar_url ?? null}
              alt={headerName}
              status={peerProfile ? toAvatarStatus(headerStatus) : undefined}
            />
            <span className="chat-page__identity-copy">
              <span className="chat-page__title-row">
                <h1>{headerName}</h1>
                {channel?.type !== "dm" && <span className="chat-page__channel-tag">#{channel?.type || "chat"}</span>}
              </span>
              <span className="chat-page__identity-status">{headerSubtitle}</span>
            </span>
          </button>

          <div className="chat-page__header-actions">
            <Tooltip content="Видеозвонок" placement="bottom">
              <button type="button" onClick={() => void startCall(true)}>
                <Video size={16} />
              </button>
            </Tooltip>
            <Tooltip content="Аудиозвонок" placement="bottom">
              <button type="button" onClick={() => void startCall(false)}>
                <Phone size={16} />
              </button>
            </Tooltip>
            <Tooltip content="Уведомления" placement="bottom">
              <button
                type="button"
                className={notifMenu ? "is-active" : ""}
                onClick={(event) => setNotifMenu(anchorFor(event))}
              >
                {notificationsMuted ? <BellOff size={16} /> : <Bell size={16} />}
              </button>
            </Tooltip>
            <Tooltip content="Закреплённые" placement="bottom">
              <button
                type="button"
                className={pinnedAnchor ? "is-active" : ""}
                onClick={(event) => setPinnedAnchor(pinnedAnchor ? null : event.currentTarget)}
              >
                <Pin size={16} />
              </button>
            </Tooltip>
            <Tooltip content="Поиск по чату" placement="bottom">
              <button type="button" className={searchOpen ? "is-active" : ""} onClick={() => setSearchOpen((value) => !value)}>
                <Search size={16} />
              </button>
            </Tooltip>
            <Tooltip content="Ещё" placement="bottom">
              <button type="button" className={moreMenu ? "is-active" : ""} onClick={(event) => setMoreMenu(anchorFor(event))}>
                <MoreHorizontal size={17} />
              </button>
            </Tooltip>
          </div>
        </header>

        {call.isConnected && (
          <section className="chat-call-strip">
            <div className="chat-call-strip__topline">
              <div className="chat-call-strip__live">
                <span /> Звонок в эфире <strong>{formatDuration(callDuration)}</strong>
              </div>
              <button type="button" title="Развернуть звонок">
                <Maximize2 size={16} />
              </button>
            </div>
            <div className="chat-call-strip__content">
              <div className="chat-call-strip__participants">
                {call.participants.map((participant) => (
                  <div className={`chat-call-strip__participant${participant.isSpeaking ? " is-speaking" : ""}`} key={participant.id}>
                    <Avatar size={44} rounded alt={participant.name} src={<span className="chat-call-strip__initials">{getInitials(participant.name)}</span>} />
                    <div>
                      <strong>{participant.name}</strong>
                      <small>{participant.isSpeaking ? "говорит" : participant.isMuted ? "микрофон выключен" : "слушает"}</small>
                    </div>
                    {participant.isMuted && <MicOff size={13} />}
                  </div>
                ))}
              </div>
              <div className="chat-call-strip__controls">
                <Tooltip content={call.isMuted ? "Включить микрофон" : "Выключить микрофон"}>
                  <button type="button" className={call.isMuted ? "is-off" : ""} onClick={() => runCallAction(call.toggleMicrophone)}>
                    {call.isMuted ? <MicOff size={18} /> : <Mic size={18} />}
                  </button>
                </Tooltip>
                <Tooltip content={call.isDeafened ? "Включить звук" : "Выключить звук"}>
                  <button type="button" className={call.isDeafened ? "is-off" : ""} onClick={call.toggleDeafen}>
                    {call.isDeafened ? <VolumeX size={18} /> : <Volume2 size={18} />}
                  </button>
                </Tooltip>
                <Tooltip content={call.isCameraOn ? "Выключить камеру" : "Включить камеру"}>
                  <button type="button" className={call.isCameraOn ? "is-on" : ""} onClick={() => runCallAction(call.toggleCamera)}>
                    {call.isCameraOn ? <Video size={18} /> : <VideoOff size={18} />}
                  </button>
                </Tooltip>
                <Tooltip content={call.isScreenSharing ? "Остановить демонстрацию" : "Показать экран"}>
                  <button type="button" className={call.isScreenSharing ? "is-on" : ""} onClick={() => runCallAction(call.toggleScreenShare)}>
                    <Share2 size={18} />
                  </button>
                </Tooltip>
                <Tooltip content="Завершить звонок">
                  <button type="button" className="is-danger" onClick={() => runCallAction(call.disconnect)}>
                    <PhoneOff size={19} />
                  </button>
                </Tooltip>
              </div>
            </div>
          </section>
        )}

        <div className="chat-page__messages" ref={scrollRef} onScroll={handleScroll}>
          {hasMore && messages.length > 0 && <div className="chat-page__load-more">Прокрутите выше, чтобы загрузить ранние сообщения</div>}
          {isLoading && messages.length === 0 && (
            <div className="chat-page__skeleton">
              {[0, 1, 2, 3].map((item) => (
                <div className="chat-page__skeleton-message" key={item}>
                  <span />
                  <div>
                    <i />
                    <i />
                  </div>
                </div>
              ))}
            </div>
          )}
          {error && (
            <div className="chat-page__state chat-page__state--error">
              <span>Ошибка загрузки сообщений</span>
              <small>{error}</small>
            </div>
          )}
          {!isLoading && orderedMessages.length === 0 && (
            <div className="chat-empty-state">
              <div>
                <Hash size={26} />
              </div>
              <h2>Начало истории</h2>
              <p>Отправьте первое сообщение в этом чате.</p>
            </div>
          )}
          <div className="chat-page__message-list">
            {orderedMessages.map((message, index) => {
              const isOwn = message.authorId === user?.id || message.authorId === "me"
              const profile = authorProfiles.get(message.authorId) || profileCache.get(message.authorId)
              const displayName = isOwn
                ? user?.displayName ?? user?.username ?? "Вы"
                : profile?.display_name || profile?.username || `Пользователь ${message.authorId.slice(0, 6)}`
              const avatar = isOwn ? user?.avatar ?? null : profile?.avatar_url || null
              const previous = orderedMessages[index - 1]
              return (
                <div key={message.messageId}>
                  {(!previous || !isSameDay(previous.createdAt, message.createdAt)) && (
                    <div className="chat-page__date-divider">
                      <span>{formatDayLabel(message.createdAt)}</span>
                    </div>
                  )}
                  <MessageItem
                    message={message}
                    displayName={displayName}
                    avatar={avatar}
                    isOwn={isOwn}
                    highlighted={highlightedMessage === message.messageId}
                    showReadReceipts={showReadReceipts}
                    recentReactions={recentReactions}
                    currentUserId={user?.id}
                    onToggleReaction={(emoji) => toggleReaction(message, emoji)}
                    onReply={() => {
                      setReplyingTo(message)
                      textareaRef.current?.focus()
                    }}
                    onEdit={(content) => void editMessage(message.messageId, content)}
                    onDelete={() => void deleteMessage(message.messageId)}
                    onOpenProfile={() => openProfileFor(message.authorId, isOwn)}
                  />
                </div>
              )
            })}
          </div>
        </div>

        <footer className="chat-page__composer">
          <div className={`chat-page__typing${typingLabel ? " is-visible" : ""}`}>
            <span>
              <i />
              <i />
              <i />
            </span>
            {typingLabel ? `${typingLabel} печатает` : ""}
          </div>
          {(replyingTo || queuedFiles.length > 0) && (
            <div className="chat-page__composer-meta">
              {replyingTo && (
                <div className="chat-page__replying">
                  <Reply size={14} />
                  <span>
                    Ответ <strong>{replyingTo.content.slice(0, 70) || "на файл"}</strong>
                  </span>
                  <button type="button" onClick={() => setReplyingTo(null)}>
                    <X size={14} />
                  </button>
                </div>
              )}
              {queuedFiles.length > 0 && (
                <div className="chat-page__queued-files">
                  {queuedFiles.map((file, index) => (
                    <div key={`${file.name}-${index}`}>
                      <span>{file.type.startsWith("image/") ? <FileImage size={17} /> : <File size={17} />}</span>
                      <p>
                        <strong>{file.name}</strong>
                        <small>{formatFileSize(file.size)}</small>
                      </p>
                      <button type="button" onClick={() => setQueuedFiles((files) => files.filter((_, fileIndex) => fileIndex !== index))}>
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          <div className="chat-page__input-shell">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              hidden
              onChange={(event) => {
                if (event.target.files) addFiles(event.target.files)
                event.target.value = ""
              }}
            />
            <Tooltip content="Прикрепить файл" placement="top">
              <button className="chat-page__composer-button" type="button" onClick={() => fileInputRef.current?.click()}>
                <Paperclip size={20} />
              </button>
            </Tooltip>
            <textarea
              ref={textareaRef}
              value={draft}
              rows={1}
              placeholder={`Сообщение: ${headerName}`}
              onChange={handleDraftChange}
              onKeyDown={handleKeyDown}
            />
            <div className="chat-page__emoji-wrap" ref={emojiRef}>
              <Tooltip content="Эмодзи" placement="top">
                <button
                  className={`chat-page__composer-button${emojiOpen ? " is-active" : ""}`}
                  type="button"
                  onClick={() => setEmojiOpen((value) => !value)}
                >
                  <Smile size={20} />
                </button>
              </Tooltip>
              {emojiOpen && (
                <div className="chat-page__emoji-picker">
                  <EmojiPicker
                    width={352}
                    height={420}
                    theme={Theme.DARK}
                    emojiStyle={EmojiStyle.NATIVE}
                    defaultSkinTone={SkinTones.NEUTRAL}
                    lazyLoadEmojis
                    searchPlaceholder="Найти эмодзи"
                    previewConfig={{ showPreview: false }}
                    onEmojiClick={insertEmoji}
                  />
                </div>
              )}
            </div>
            <Tooltip content="Отправить" placement="top">
              <button
                className="chat-page__send"
                type="button"
                onClick={() => void handleSubmit()}
                disabled={(!draft.trim() && queuedFiles.length === 0) || isSending}
              >
                {isSending ? <LoaderCircle size={19} className="is-spinning" /> : <Send size={19} />}
              </button>
            </Tooltip>
          </div>
        </footer>

        {isDragging && (
          <div className="chat-page__dropzone">
            <div>
              <Paperclip size={28} />
              <strong>Перетащите файлы сюда</strong>
              <span>До 10 файлов, каждый не больше 25 МБ</span>
            </div>
          </div>
        )}
      </div>

      {searchOpen && (
        <ChatSearchPanel
          query={searchQuery}
          onQueryChange={setSearchQuery}
          isSearching={isSearching}
          results={searchRows}
          authors={searchAuthors}
          authorFilter={authorFilter}
          onAuthorFilterChange={setAuthorFilter}
          dateFilter={dateFilter}
          onDateFilterChange={setDateFilter}
          customDate={customDate}
          onCustomDateChange={setCustomDate}
          fileFilter={fileFilter}
          onFileFilterChange={setFileFilter}
          onResetFilters={resetSearchFilters}
          onSelectResult={jumpToMessage}
          onClose={() => setSearchOpen(false)}
        />
      )}

      {notifMenu && <Menu items={notifMenuItems} position={notifMenu} align="end" onClose={() => setNotifMenu(null)} />}
      {moreMenu && <Menu items={moreMenuItems} position={moreMenu} align="end" onClose={() => setMoreMenu(null)} />}

      {pinnedAnchor && (
        <Popover anchor={pinnedAnchor} align="end" width={300} onClose={() => setPinnedAnchor(null)} className="chat-pinned-pop">
          <div className="chat-pinned-pop__head">
            <Pin size={14} />
            <strong>Закреплённые сообщения</strong>
          </div>
          <div className="chat-pinned-pop__empty">
            <Pin size={22} />
            <strong>Пока ничего не закреплено</strong>
            <span>Закрепите сообщение через его контекстное меню, чтобы оно всегда было под рукой.</span>
          </div>
        </Popover>
      )}

      {profileTarget && (
        <ProfileModal
          visible
          user={profileTarget}
          currentUserId={user?.id}
          onClose={() => setProfileTarget(null)}
        />
      )}
    </section>
  )
}
