"use client"

import type React from "react"
import { useRef, useEffect, useState, useCallback } from "react"
import { Avatar } from "../avatar/avatar"
import { Tooltip } from "../ui/tooltip/tooltip"
import { Menu, type MenuItem } from "../ui/menu/menu"
import {
  Plus,
  Search,
  Settings,
  X,
  Copy,
  BellOff,
  CheckCheck,
  Pin,
  Trash2,
  UserRound,
} from "lucide-react"
import { DeviceContextMenu, type AudioDevice } from "../device-context-menu/device-context-menu"
import { CommandMenu } from "../command-menu/command-menu"
import { SearchModal } from "../search-modal/search-modal"
import { NewChatModal } from "../chat-modal/chat-modal"
import { UserPopup } from "../user-popup/user-popup"
import { ProfileModal } from "../profile-modal/profile-modal"
import { useCall } from "../../contexts/call-context"
import { useConnectivity } from "../../contexts/connectivity-context"
import { channelsApi } from "../../lib/api/channelsApi"
import type { Chat, User as UserType, UserData } from "../../types"
import type { PresenceStatus } from "../../hooks/usePresence"
import { usePresence } from "../../hooks/usePresence"
import "./main-sidebar.scss"
import cn from "classnames"
import { useTranslation } from "react-i18next"
import { useNavigate, useParams } from "react-router-dom"
import { Button } from "../ui"

const SIDEBAR_MIN_WIDTH = 240
const SIDEBAR_INITIAL_WIDTH = 309
const SIDEBAR_MAX_WIDTH = 420

const getInitialSidebarWidth = (): number => {
  if (typeof window === "undefined") return SIDEBAR_INITIAL_WIDTH
  const stored = window.localStorage.getItem("sidebarWidth")
  return stored ? Number(stored) : SIDEBAR_INITIAL_WIDTH
}

// ─── Main Sidebar ────────────────────────────────────────────────────────────

interface MainSidebarProps {
  chats: Chat[]
  user: UserType
  profileUser: UserData
  isLoadingChats?: boolean
  onStatusChange?: (status: PresenceStatus) => void
  onOpenSettings?: () => void
  onOpenProfile?: () => void
  onSignOut?: () => Promise<void>
  onRemoveChat?: (chatId: string) => void
}

export const MainSidebar: React.FC<MainSidebarProps> = ({
  chats,
  user,
  profileUser,
  isLoadingChats = false,
  onStatusChange,
  onOpenSettings,
  onOpenProfile,
  onSignOut,
  onRemoveChat,
}) => {
  const [isResizing, setIsResizing] = useState(false)
  const [sidebarWidth, setSidebarWidth] = useState(getInitialSidebarWidth)
  const [showCommandMenu, setShowCommandMenu] = useState(false)
  const [showSearchModal, setShowSearchModal] = useState(false)
  const [searchType, setSearchType] = useState<"all" | "users" | "messages">("all")
  const [showProfileCard, setShowProfileCard] = useState(false)
  const [showNewChatModal, setShowNewChatModal] = useState(false)

  const call = useCall()
  const { isConnected } = useConnectivity()

  const [micContextMenu, setMicContextMenu] = useState<{ x: number; y: number } | null>(null)
  const [speakerContextMenu, setSpeakerContextMenu] = useState<{ x: number; y: number } | null>(null)
  const [micVolume, setMicVolume] = useState(100)
  const [speakerVolume, setSpeakerVolume] = useState(100)

  const sidebarRef = useRef<HTMLElement>(null)
  const userSectionRef = useRef<HTMLDivElement>(null)
  const cursorPos = useRef({ x: 0 })
  const sidebarInitialWidth = useRef(0)

  const { t } = useTranslation(["sidebar", "call", "settings"])
  const navigate = useNavigate()
  const { chatId } = useParams<{ chatId?: string }>()
  const { presence, loadPresence } = usePresence()

  const handleMouseDown: React.MouseEventHandler<HTMLButtonElement> = useCallback((event) => {
    setIsResizing(true)
    cursorPos.current.x = event.clientX
    sidebarInitialWidth.current = sidebarRef.current?.clientWidth || SIDEBAR_INITIAL_WIDTH
  }, [])

  const handleChatClick = useCallback((chatId: string) => {
    navigate(`/chat/${chatId}`)
  }, [navigate])

  const [selectedUserForProfile, setSelectedUserForProfile] = useState<UserData | null>(null)
  const [chatMenu, setChatMenu] = useState<{ chat: Chat; x: number; y: number } | null>(null)
  const [mutedChats, setMutedChats] = useState<Set<string>>(new Set())

  const handleChatContextMenu = useCallback((event: React.MouseEvent, chat: Chat) => {
    event.preventDefault()
    event.stopPropagation()
    setChatMenu({ chat, x: event.clientX, y: event.clientY })
  }, [])

  // The modal fetches the full profile itself; this is just the seed data.
  const handleOpenPeerProfile = useCallback((chat: Chat) => {
    if (!chat.peerId) return
    setSelectedUserForProfile({
      id: chat.peerId,
      avatar: { src: chat.avatar, alt: chat.name },
      banner: null,
      username: chat.name,
      nickname: chat.name,
      bio: "",
    })
  }, [])

  const chatMenuItems = useCallback((chat: Chat): MenuItem[] => {
    const isMuted = mutedChats.has(chat.id)

    return [
      ...(chat.peerId
        ? [{
            label: t("sidebar:view_profile", "Профиль"),
            icon: <UserRound size={14} />,
            onClick: () => handleOpenPeerProfile(chat),
          }]
        : []),
      {
        label: t("sidebar:mark_as_read", "Прочитать всё"),
        icon: <CheckCheck size={14} />,
        onClick: () => { void channelsApi.markRead(chat.id).catch(() => {}) },
      },
      {
        label: isMuted ? t("sidebar:unmute", "Включить уведомления") : t("sidebar:mute", "Отключить уведомления"),
        icon: <BellOff size={14} />,
        onClick: () => setMutedChats((prev) => {
          const next = new Set(prev)
          if (isMuted) next.delete(chat.id)
          else next.add(chat.id)
          return next
        }),
      },
      { label: t("sidebar:pin_chat", "Закрепить чат"), icon: <Pin size={14} /> },
      { separator: true },
      {
        label: t("sidebar:copy_id", "Копировать ID"),
        icon: <Copy size={14} />,
        onClick: () => { void navigator.clipboard.writeText(chat.id) },
      },
      { separator: true },
      {
        label: t("sidebar:delete_chat", "Удалить чат"),
        icon: <Trash2 size={14} />,
        danger: true,
        onClick: () => onRemoveChat?.(chat.id),
      },
    ]
  }, [handleOpenPeerProfile, mutedChats, onRemoveChat, t])

  const handleUserSelect = useCallback((user: UserType | any) => {
    // Convert user/profile to UserData format
    const userData: UserData = {
      id: user.id || "",
      avatar: {
        src: user.avatar_url || (typeof user.avatar === 'string' ? user.avatar : (user.avatar?.src || null)),
        alt: user.avatar?.alt || user.display_name || user.username || undefined,
      },
      banner: user.banner_url || user.banner || null,
      username: user.username || user.name || "",
      nickname: user.nickname || user.display_name || user.name || "",
      bio: user.bio || "",
      pronouns: user.pronouns,
      status: user.status,
      is_verified: user.is_verified || false,
      createdAt: user.created_at || undefined,
    }

    // Don't allow viewing own profile through search
    if (userData.id === profileUser?.id) {
      return
    }

    // Open user profile modal instead of creating DM directly
    setSelectedUserForProfile(userData)
    setShowSearchModal(false)
  }, [profileUser?.id])

  const handleCloseProfileModal = useCallback(() => {
    setSelectedUserForProfile(null)
  }, [])

  const handleSearchOpen = useCallback((type?: "all" | "users" | "messages") => {
    if (type) setSearchType(type)
    setShowSearchModal(true)
  }, [])

  const handleMicSelect = useCallback((deviceId: string) => {
    void call.setAudioDevice(deviceId)
  }, [call])

  const handleSpeakerSelect = useCallback((deviceId: string) => {
    void call.setAudioOutputDevice(deviceId)
  }, [call])

  useEffect(() => {
    if (!isResizing) return
    const handleMouseMove = (event: MouseEvent) => {
      const cursorXDelta = event.clientX - cursorPos.current.x
      const newWidth = Math.max(
        SIDEBAR_MIN_WIDTH,
        Math.min(sidebarInitialWidth.current + cursorXDelta, SIDEBAR_MAX_WIDTH),
      )
      setSidebarWidth(newWidth)
      window.localStorage.setItem("sidebarWidth", String(newWidth))
    }
    const handleMouseUp = () => setIsResizing(false)
    window.addEventListener("mousemove", handleMouseMove)
    window.addEventListener("mouseup", handleMouseUp)
    return () => {
      window.removeEventListener("mousemove", handleMouseMove)
      window.removeEventListener("mouseup", handleMouseUp)
    }
  }, [isResizing])

  // Keep presence dots on the chat list fresh for every DM peer.
  useEffect(() => {
    const peerIds = chats.map((chat) => chat.peerId).filter((id): id is string => Boolean(id))
    if (peerIds.length > 0) void loadPresence(peerIds)
  }, [chats, loadPresence])

  const micDevices: AudioDevice[] = call.audioInputDevices.map((d) => ({ deviceId: d.id, label: d.name, kind: "audioinput" as const }))
  const speakerDevices: AudioDevice[] = call.audioOutputDevices.map((d) => ({ deviceId: d.id, label: d.name, kind: "audiooutput" as const }))

  const statusLabel = call.isConnected ? `${t("call:speaking")} – ${call.roomName}` : user.status
  const userStatus = (profileUser.status ?? "online") as "online" | "dnd" | "inactive" | "offline" | "invisible"

  return (
    <aside
      ref={sidebarRef}
      className={cn("sidebar", { "sidebar--resizing": isResizing })}
      style={{ width: sidebarWidth, minWidth: sidebarWidth, maxWidth: sidebarWidth }}
    >
      <div className="sidebar__container">

        {/* ── Search ── */}
        <div className="top-buttons">
          <button
            className="search-button"
            onClick={() => handleSearchOpen("all")}
            disabled={!isConnected}
            title={t("sidebar:search")}
          >
            <Search size={16} />
            <span className="search-button-text">{t("sidebar:search")}</span>
          </button>
        </div>

        {/* ── Chats section ── */}
        <section className="section">
          <div className="chat-header">
            <small className="section-title">{t("sidebar:chats")}</small>
            <Tooltip content={isConnected ? "New message or group" : "No connection"} placement="top">
              <button
                className="top-button"
                onClick={() => setShowNewChatModal(true)}
                disabled={!isConnected}
              >
                <Plus size={14} />
              </button>
            </Tooltip>
          </div>

          <div className="chats">
            {isLoadingChats ? (
              <div className="chats-skeleton">
                <div className="chat-skeleton-item">
                  <div className="chat-skeleton-avatar"></div>
                  <div className="chat-skeleton-content">
                    <div className="chat-skeleton-name"></div>
                    <div className="chat-skeleton-message"></div>
                  </div>
                </div>
                <div className="chat-skeleton-item">
                  <div className="chat-skeleton-avatar"></div>
                  <div className="chat-skeleton-content">
                    <div className="chat-skeleton-name"></div>
                    <div className="chat-skeleton-message"></div>
                  </div>
                </div>
                <div className="chat-skeleton-item">
                  <div className="chat-skeleton-avatar"></div>
                  <div className="chat-skeleton-content">
                    <div className="chat-skeleton-name"></div>
                    <div className="chat-skeleton-message"></div>
                  </div>
                </div>
              </div>
            ) : chats.length === 0 ? (
              <div className="chats-empty">
                <h3 className="chats-empty__title">{t("sidebar:no_conversations")}</h3>
                <p className="chats-empty__description">{t("sidebar:no_conversations_desc")}</p>
                <div className="chats-empty__actions">
                  <Button
                    className="chats-empty__cta"
                    onClick={() => setShowNewChatModal(true)}
                    disabled={!isConnected}
                  >
                    <Plus size={16} />
                    <span>{t("sidebar:new_message")}</span>
                  </Button>
                </div>
                {!isConnected && (
                  <p className="chats-empty__offline-hint">{t("sidebar:connect_to_start")}</p>
                )}
              </div>
            ) : (
              chats.map((chat) => (
                <div
                  key={chat.id}
                  className={cn("chat-item", {
                    "chat-item--disabled": !isConnected,
                    "chat-item--active": chatId === chat.id,
                    "chat-item--menu-open": chatMenu?.chat.id === chat.id,
                  })}
                  role="button"
                  tabIndex={isConnected ? 0 : -1}
                  onClick={() => { if (isConnected) handleChatClick(chat.id) }}
                  onKeyDown={(event) => {
                    if (!isConnected) return
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault()
                      handleChatClick(chat.id)
                    }
                  }}
                  onContextMenu={(event) => handleChatContextMenu(event, chat)}
                >
                  <Avatar
                    size={36}
                    src={chat.avatar}
                    alt={chat.name}
                    status={chat.peerId ? ((presence.get(chat.peerId)?.status ?? "offline") as never) : undefined}
                  />
                  <div className="chat-info">
                    <div className="chat-name">{chat.name}</div>
                    <div className="chat-status">
                      {chat.lastMessage || chat.status || t("sidebar:no_messages_yet", "Нет сообщений")}
                    </div>
                  </div>
                  {(chat.unreadCount ?? 0) > 0 && (
                    <span className="chat-unread">{chat.unreadCount! > 99 ? "99+" : chat.unreadCount}</span>
                  )}
                  <Tooltip content={t("sidebar:delete_chat", "Удалить чат")} placement="top">
                    <button
                      type="button"
                      className="chat-close-button"
                      aria-label={t("sidebar:delete_chat", "Удалить чат")}
                      onClick={(event) => {
                        event.stopPropagation()
                        onRemoveChat?.(chat.id)
                      }}
                    >
                      <X size={14} />
                    </button>
                  </Tooltip>
                </div>
              ))
            )}
          </div>
        </section>

        {/* ── User section ── */}
        <div ref={userSectionRef} className="user-section">
          <button
            className={cn("user-section__btn", {
              "user-section__btn--active": showProfileCard,
              "user-section__btn--disabled": !isConnected,
            })}
            onClick={() => !isConnected ? undefined : setShowProfileCard((v) => !v)}
            disabled={!isConnected}
          >
            <Avatar size={30} src={user.avatar} alt={user.name} status={userStatus} />
            <div className="user-details">
              <div className="user-name">{user.name}</div>
              <div className={cn("user-status", { "user-status--in-call": call.isConnected })}>
                {statusLabel}
              </div>
            </div>
            <div
              className="user-section__settings-btn"
              onClick={(e) => { e.stopPropagation(); onOpenSettings?.() }}
              role="button"
              tabIndex={0}
              aria-label="Settings"
            >
              <Settings size={14} />
            </div>
          </button>
        </div>
      </div>

      <button type="button" className="sidebar__handle" onMouseDown={handleMouseDown} />

      {/* ── User Popup Portal ── */}
      <UserPopup
        visible={showProfileCard}
        anchorRef={userSectionRef}
        profileUser={profileUser}
        userStatus={userStatus}
        onClose={() => setShowProfileCard(false)}
        onStatusChange={onStatusChange}
        onOpenProfile={onOpenProfile}
        onOpenSettings={onOpenSettings}
        onSignOut={onSignOut}
        sidebarWidth={sidebarWidth}
      />

      <CommandMenu isOpen={showCommandMenu} onClose={() => setShowCommandMenu(false)} />

      <SearchModal
        visible={showSearchModal}
        onClose={() => setShowSearchModal(false)}
        initialSearchType={searchType}
        onUserSelect={handleUserSelect}
      />

      <NewChatModal
        visible={showNewChatModal}
        onClose={() => setShowNewChatModal(false)}
        chats={chats}
        onSelectChat={handleChatClick}
      />

      {selectedUserForProfile && (
        <ProfileModal
          visible={true}
          onClose={handleCloseProfileModal}
          user={selectedUserForProfile}
          currentUserId={profileUser?.id}
        />
      )}

      {chatMenu && (
        <Menu
          items={chatMenuItems(chatMenu.chat)}
          position={{ x: chatMenu.x, y: chatMenu.y }}
          onClose={() => setChatMenu(null)}
        />
      )}

      <DeviceContextMenu
        isOpen={!!micContextMenu}
        position={micContextMenu || { x: 0, y: 0 }}
        onClose={() => setMicContextMenu(null)}
        type="microphone"
        inputDevices={micDevices}
        outputDevices={speakerDevices}
        selectedInputDeviceId={call.selectedAudioInput}
        selectedOutputDeviceId={call.selectedAudioOutput}
        volume={micVolume}
        onInputDeviceSelect={handleMicSelect}
        onOutputDeviceSelect={handleSpeakerSelect}
        onVolumeChange={setMicVolume}
        onOpenSettings={() => { setMicContextMenu(null); onOpenSettings?.() }}
      />

      <DeviceContextMenu
        isOpen={!!speakerContextMenu}
        position={speakerContextMenu || { x: 0, y: 0 }}
        onClose={() => setSpeakerContextMenu(null)}
        type="speaker"
        inputDevices={micDevices}
        outputDevices={speakerDevices}
        selectedInputDeviceId={call.selectedAudioInput}
        selectedOutputDeviceId={call.selectedAudioOutput}
        volume={speakerVolume}
        onInputDeviceSelect={handleMicSelect}
        onOutputDeviceSelect={handleSpeakerSelect}
        onVolumeChange={setSpeakerVolume}
        onOpenSettings={() => { setSpeakerContextMenu(null); onOpenSettings?.() }}
      />
    </aside>
  )
}

export default MainSidebar
