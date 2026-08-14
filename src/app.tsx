"use client"

import { useState, useRef, useCallback, useEffect, useMemo } from "react"
import { Outlet, useNavigate, useParams } from "react-router-dom"
import { useAuthSession } from "./contexts/auth-context"
import { supabase } from "./lib/supabase"
import { MainSidebar } from "./components/main-sidebar/main-sidebar"
import { SettingsModal } from "./components/settings/settings-modal"
import { ProfileModal } from "./components/profile-modal/profile-modal"
import { EmptyState } from "./components/empty-state/empty-state"
import { toSidebarUser, toUserData } from "./lib/auth/user-data"
import { channelsApi } from "./lib/api/channelsApi"
import { mapChannelsToChats } from "./lib/chat/map-channels"
import { usePresence } from "./hooks/usePresence"
import { useCachedProfile } from "./hooks/useCachedProfile"
import type { Chat, UserData } from "./types"

import "./scss/app.scss"
import "./components/main-sidebar/main-sidebar.scss"

function App() {

  const { user: authUser } = useAuthSession()
  const authUserId = authUser?.id
  const navigate = useNavigate()
  const contentRef = useRef<HTMLDivElement>(null)
  const { chatId } = useParams<{ chatId?: string }>()

  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [isProfileOpen, setIsProfileOpen] = useState(false)
  const [chats, setChats] = useState<Chat[]>([])
  const [isLoadingChats, setIsLoadingChats] = useState(true)
  const [profileSnapshot, setProfileSnapshot] = useState<{
    avatar_url?: string | null
    banner_url?: string | null
    bio?: string
    pronouns?: string | null
  } | null>(null)

  const handleOpenSettings = useCallback(() => setIsSettingsOpen(true), [])
  const handleCloseSettings = useCallback(() => setIsSettingsOpen(false), [])
  const handleOpenProfile = useCallback(() => setIsProfileOpen(true), [])
  const handleCloseProfile = useCallback(() => setIsProfileOpen(false), [])

  // Listen for open-profile event from search modal
  useEffect(() => {
    const handleOpenProfileEvent = () => {
      setIsProfileOpen(true)
    }
    window.addEventListener('open-profile', handleOpenProfileEvent)
    return () => window.removeEventListener('open-profile', handleOpenProfileEvent)
  }, [])

  // Sign out handler
  const handleSignOut = useCallback(async () => {
    try {
      await supabase.auth.signOut()
      window.location.hash = "#/login"
    } catch (err) {
      console.error("[App] Sign out failed:", err)
    }
  }, [])

  const currentUser = useMemo(() => toUserData(authUser, profileSnapshot), [authUser, profileSnapshot])
  const [profileData, setProfileData] = useState<Partial<UserData>>({})
  const { presence, updateMyPresence } = usePresence()
  const myPresence = authUserId ? presence.get(authUserId) : undefined
  const currentStatus = myPresence?.status ?? "offline"

  // Use cached profile with offline support
  const { profile: cachedProfile } = useCachedProfile()

  // Update local state when cached profile changes
  useEffect(() => {
    if (cachedProfile) {
      setProfileSnapshot({
        avatar_url: cachedProfile.avatar_url,
        banner_url: cachedProfile.banner_url,
        bio: cachedProfile.bio,
        pronouns: cachedProfile.pronouns,
      })
      setProfileData({
        avatar: { src: cachedProfile.avatar_url, alt: cachedProfile.display_name || cachedProfile.username },
        banner: cachedProfile.banner_url,
        bio: cachedProfile.bio,
        pronouns: cachedProfile.pronouns || undefined,
        role: cachedProfile.role,
        is_verified: cachedProfile.is_verified,
        is_admin: cachedProfile.is_admin,
      })
    }
  }, [cachedProfile])

  // Merge profile data with presence status
  const mergedUser = useMemo(() => ({
    ...currentUser,
    ...profileData,
    status: currentStatus as UserData["status"],
  }), [currentUser, profileData, currentStatus])

  const sidebarUser = useMemo(() => toSidebarUser(mergedUser), [mergedUser])

  // Realtime subscription for own profile changes (avatar, banner, name, etc.)
  useEffect(() => {
    if (!authUserId) return

    const channel = supabase
      .channel("own-profile-changes")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "profiles",
          filter: `id=eq.${authUserId}`,
        },
        (payload) => {
          const p = payload.new as {
            avatar_url: string | null
            banner_url: string | null
            display_name: string | null
            username: string
            bio: string
            pronouns: string | null
            role: string | null
            is_verified: boolean
            is_admin: boolean
          }
          setProfileData({
            avatar: { src: p.avatar_url, alt: p.display_name || p.username },
            nickname: p.display_name || p.username,
            banner: p.banner_url,
            bio: p.bio,
            pronouns: p.pronouns || undefined,
            role: p.role as UserData["role"],
            is_verified: p.is_verified,
            is_admin: p.is_admin,
          })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [authUserId])

  // Load channels from Supabase on mount
  useEffect(() => {
    if (!authUserId) return

    const loadChannels = async () => {
      setIsLoadingChats(true)
      try {
        const channels = await channelsApi.getUserChannels()
        setChats(await mapChannelsToChats(channels, authUserId))
      } catch (err) {
        console.debug("[App] Failed to load channels:", err)
      } finally {
        setIsLoadingChats(false)
      }
    }

    loadChannels()
  }, [authUserId])

  // Subscribe to Supabase Realtime for all user channels
  const channelIdsKey = chats.map((chat) => chat.id).join(",")

  useEffect(() => {
    if (!authUserId || !channelIdsKey) return

    const channelIds = channelIdsKey.split(",")
    const channel = supabase
      .channel("app-messages")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
        },
        (payload) => {
          const newMsg = payload.new as { channel_id: string; content: string; author_id: string }
          // Only process messages for our channels
          if (!channelIds.includes(newMsg.channel_id)) return
          if (newMsg.author_id === authUserId) return // Skip own messages

          setChats((prev) => {
            const idx = prev.findIndex((c) => c.id === newMsg.channel_id)
            if (idx < 0) return prev

            const updated: Chat = {
              ...prev[idx],
              status: newMsg.content.slice(0, 48) || prev[idx].status,
              lastMessage: newMsg.content,
              lastMessageAt: new Date().toISOString(),
              unreadCount: (prev[idx].unreadCount || 0) + (chatId === newMsg.channel_id ? 0 : 1),
            }

            const next = [...prev]
            next.splice(idx, 1)
            next.unshift(updated)
            return next
          })
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "messages",
        },
        (payload) => {
          const updatedMsg = payload.new as { channel_id: string; content: string; is_deleted: boolean }
          if (!channelIds.includes(updatedMsg.channel_id)) return

          setChats((prev) => {
            const idx = prev.findIndex((c) => c.id === updatedMsg.channel_id)
            if (idx < 0) return prev

            const updated: Chat = {
              ...prev[idx],
              status: updatedMsg.is_deleted ? "Message deleted" : updatedMsg.content.slice(0, 48),
              lastMessage: updatedMsg.is_deleted ? undefined : updatedMsg.content,
            }

            const next = [...prev]
            next[idx] = updated
            return next
          })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [authUserId, channelIdsKey, chatId])

  // Subscribe to new channel_members (detect new DM channels in realtime)
  useEffect(() => {
    if (!authUserId) return

    const channel = supabase
      .channel("app-new-channels")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "channel_members",
          filter: `user_id=eq.${authUserId}`,
        },
        async () => {
          // Reload channels to pick up the new one
          try {
            const channels = await channelsApi.getUserChannels()
            setChats(await mapChannelsToChats(channels, authUserId))
          } catch (err) {
            console.debug("[App] Failed to reload channels:", err)
          }
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [authUserId])

  // Mark channel as read when viewing it
  useEffect(() => {
    if (!chatId) return

    channelsApi.markRead(chatId).catch(() => {})

    setChats((prev) =>
      prev.map((c) => (c.id === chatId ? { ...c, unreadCount: 0 } : c))
    )
  }, [chatId])

  /** Leave a conversation: drop it from the list, then leave server-side. */
  const handleRemoveChat = useCallback(async (id: string) => {
    setChats((prev) => prev.filter((chat) => chat.id !== id))
    if (chatId === id) navigate("/")

    try {
      await channelsApi.leave(id)
    } catch (err) {
      console.debug("[App] Failed to leave channel:", err)
    }
  }, [chatId, navigate])

  return (
    <>
      <main>
        <MainSidebar
          chats={chats}
          user={sidebarUser}
          profileUser={mergedUser}
          isLoadingChats={isLoadingChats}
          onStatusChange={updateMyPresence}
          onOpenSettings={handleOpenSettings}
          onOpenProfile={handleOpenProfile}
          onSignOut={handleSignOut}
          onRemoveChat={handleRemoveChat}
        />

        <div className="container">
          <section ref={contentRef} className="container__content">
            {chatId ? <Outlet /> : <EmptyState />}
          </section>
        </div>
      </main>

      <SettingsModal visible={isSettingsOpen} onClose={handleCloseSettings} user={mergedUser} />
      <ProfileModal
        visible={isProfileOpen}
        onClose={handleCloseProfile}
        user={mergedUser}
        currentUserId={authUserId}
        onOpenSettings={handleOpenSettings}
      />
    </>
  )
}

export default App;
