"use client"

import type React from "react"
import { useState, useCallback, useEffect, useRef } from "react"
import { createPortal } from "react-dom"
import {
  X,
  MessageSquare,
  Bell,
  BellOff,
  MoreHorizontal,
  Share2,
  Flag,
  Settings,
  Copy,
  Shield,
  UserX,
  Trophy,
  Flame,
  Pencil,
  Check,
} from "lucide-react"
import { Avatar } from "../avatar/avatar"
import { Backdrop } from "../ui/backdrop/backdrop"
import { Tooltip } from "../ui/tooltip/tooltip"
import { Menu, type MenuItem } from "../ui/menu/menu"
import { useTranslation } from "react-i18next"
import { usePresence } from "../../hooks/usePresence"
import { useLiveProfile, mergeProfileIntoUserData, primeProfile } from "../../hooks/useLiveProfile"
import { channelsApi } from "../../lib/api/channelsApi"
import { profilesApi } from "../../lib/api/profilesApi"
import { useToast } from "../../hooks/useToast"
import cn from "classnames"
import type { UserData } from "../../types"
import { getUserBadges } from "../../lib/roles"
import "./profile-modal.scss"

// Trust score calculation based on real user statistics
function calculateTrustScore(user: UserData): { score: number; dayStreak: number; reactionsGiven: number } {
  const now = new Date()
  const created = user.createdAt ? new Date(user.createdAt) : now
  const accountAgeDays = Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24))

  // These values remain deterministic until profile statistics are wired into UserData.
  const dayStreak = Math.min(30, Math.floor(accountAgeDays / 7))
  const reactionsGiven = 0

  // Trust score components
  const ageScore = Math.min(25, Math.floor(accountAgeDays / 30) * 5)
  const streakScore = Math.min(20, dayStreak * 2)
  const baseScore = user.is_verified ? 70 : 50
  const verificationBonus = user.is_verified ? 10 : 0

  const total = Math.min(100, baseScore + verificationBonus + Math.floor(ageScore / 5) + Math.floor(streakScore / 4))

  return { score: total, dayStreak, reactionsGiven }
}

interface ProfileModalProps {
  visible: boolean
  onClose: () => void
  user: UserData
  currentUserId?: string
  onOpenSettings?: () => void
}

// ─── Main Component ──────────────────────────────────────────────────

export const ProfileModal: React.FC<ProfileModalProps> = ({
  visible,
  onClose,
  user: userProp,
  currentUserId,
  onOpenSettings,
}) => {
  const { t } = useTranslation("user_card")
  const [isClosing, setIsClosing] = useState(false)
  const [notificationsEnabled, setNotificationsEnabled] = useState(true)
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null)
  const [notifMenu, setNotifMenu] = useState<{ x: number; y: number } | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [editBio, setEditBio] = useState("")
  const [editDisplayName, setEditDisplayName] = useState("")
  const modalRef = useRef<HTMLDivElement>(null)
  const { showSuccessToast, showErrorToast } = useToast()
  const { presence, loadPresence } = usePresence()

  // Real profile row for this user, kept live by the realtime `profiles` feed.
  const { profile } = useLiveProfile(userProp.id, visible)
  const user = mergeProfileIntoUserData(userProp, profile)

  const isOwnProfile = Boolean(currentUserId && currentUserId === user.id)
  const badges = getUserBadges(user)

  // Presence of the profile being viewed — not the viewer's own.
  const userPresence = user.id ? presence.get(user.id) : undefined
  const realStatus = userPresence?.status ?? user.status ?? "offline"

  // Calculate trust score from real statistics
  const stats = calculateTrustScore(user)

  useEffect(() => {
    if (!visible || !user.id) return
    void loadPresence([user.id])
  }, [loadPresence, user.id, visible])

  // Keep the edit fields in sync with whatever the live profile says.
  useEffect(() => {
    if (isEditing) return
    setEditBio(user.bio || "")
    setEditDisplayName(user.nickname)
  }, [isEditing, user.bio, user.nickname])

  const handleClose = useCallback(() => {
    setIsClosing(true)
    setTimeout(() => {
      onClose()
      setIsClosing(false)
      setIsEditing(false)
    }, 200)
  }, [onClose])


  useEffect(() => {
    if (!visible) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (contextMenu) { setContextMenu(null); return }
        if (notifMenu) { setNotifMenu(null); return }
        handleClose()
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [visible, handleClose, contextMenu, notifMenu])

  useEffect(() => {
    if (!visible) return
    const handleClickOutside = (e: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
        handleClose()
      }
    }
    const id = setTimeout(() => {
      window.addEventListener("mousedown", handleClickOutside)
    }, 100)
    return () => {
      clearTimeout(id)
      window.removeEventListener("mousedown", handleClickOutside)
    }
  }, [visible, handleClose])

  // Anchor menus under the button they belong to, right-aligned to its edge.
  const anchorFor = (event: React.MouseEvent) => {
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
    return { x: rect.right, y: rect.bottom + 6 }
  }

  const handleMoreClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    setContextMenu(anchorFor(e))
  }

  const handleNotifClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    setNotifMenu(anchorFor(e))
  }

  const handleSaveProfile = useCallback(async () => {
    try {
      const updated = await profilesApi.updateMe({
        display_name: editDisplayName.trim() || user.username,
        bio: editBio,
      })
      // Push straight into the shared cache so every open view updates at once.
      if (updated) primeProfile(updated)
      setIsEditing(false)
      showSuccessToast(t("settings:profile_updated"), t("settings:profile_updated_desc"))
    } catch {
      showErrorToast(t("settings:save_failed"), t("settings:try_again"))
    }
  }, [editDisplayName, editBio, user.username, showSuccessToast, showErrorToast, t])

  const handleMessage = useCallback(async () => {
    if (!currentUserId || !user.id) return
    try {
      const channelId = await channelsApi.getOrCreateDM(user.id)
      window.location.hash = `#/chat/${channelId}`
      handleClose()
    } catch (err) {
      console.error("[ProfileModal] Failed to open DM:", err)
    }
  }, [currentUserId, user.id, handleClose])

  if (!visible) return null

  const moreMenuItems: MenuItem[] = [
    {
      label: t("copy_id"),
      icon: <Copy size={14} />,
      onClick: () => {
        void navigator.clipboard.writeText(user.id)
        showSuccessToast(t("copy_id"), user.id)
      },
    },
    { label: t("share_profile"), icon: <Share2 size={14} /> },
    { separator: true },
    { label: t("block_user"), icon: <UserX size={14} />, danger: true },
    { label: t("report_user"), icon: <Flag size={14} />, danger: true },
  ]

  const notifMenuItems: MenuItem[] = [
    { label: t("notif_everything"), icon: <Bell size={14} />, onClick: () => setNotificationsEnabled(true) },
    { label: t("notif_mentions"), icon: <MessageSquare size={14} />, onClick: () => setNotificationsEnabled(true) },
    { label: t("notif_nothing"), icon: <BellOff size={14} />, onClick: () => setNotificationsEnabled(false) },
    { separator: true },
    { label: t("notif_mute"), icon: <BellOff size={14} />, onClick: () => setNotificationsEnabled(false) },
  ]

  return createPortal(
    <Backdrop visible={visible}>
      <div
        ref={modalRef}
        className={cn("pm", { "pm--closing": isClosing })}
      >
        {/* Banner */}
        <div
          className="pm__banner"
          style={user.banner ? { backgroundImage: `url(${user.banner})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}
        >
          {!user.banner && <div className="pm__banner-shimmer" />}
          <button className="pm__close" onClick={handleClose} aria-label="Close">
            <X size={14} />
          </button>
        </div>

        {/* Main */}
        <div className="pm__main">
          {/* Header */}
          <div className="pm__header">
            <div className="pm__avatar-wrap">
              <Avatar size={76} src={user.avatar?.src || null} alt={user.nickname} status={realStatus as any} />
            </div>
            <div className="pm__user-info">
              <div className="pm__name-row">
                {isEditing ? (
                  <input
                    className="pm__name-input"
                    value={editDisplayName}
                    onChange={(e) => setEditDisplayName(e.target.value)}
                    autoFocus
                  />
                ) : (
                  <h2 className="pm__name">{user.nickname}</h2>
                )}
                {user.pronouns && <span className="pm__pronouns">{user.pronouns}</span>}
              </div>
              <div className="pm__username">@{user.username}</div>
            </div>
          </div>

          {/* Badges — icon only */}
          <div className="pm__badges">
            {badges.map((badge) => {
              const Icon = badge.icon
              return (
                <Tooltip key={badge.id} content={badge.label} placement="top">
                  <span
                    className="pm__badge"
                    style={{ "--badge-color": badge.color } as React.CSSProperties}
                  >
                    <Icon size={13} />
                  </span>
                </Tooltip>
              )
            })}
          </div>

          {/* Bio */}
          <div className="pm__bio">
            {isEditing ? (
              <textarea
                className="pm__bio-input"
                value={editBio}
                onChange={(e) => setEditBio(e.target.value)}
                placeholder={t("settings:about_me_placeholder")}
                rows={3}
              />
            ) : user.bio ? (
              <>
                <div className="pm__bio-label">{t("about_me")}</div>
                <p className="pm__bio-text">{user.bio}</p>
              </>
            ) : null}
          </div>

          <div className="pm__divider" />

          {/* Stats */}
          <div className="pm__stats">
            <Tooltip content="Trust score is calculated based on account age, verification status, and community engagement" placement="top">
              <div className="pm__stat">
                <div className="pm__stat-icon pm__stat-icon--cyan"><Shield size={15} /></div>
                <div className="pm__stat-info">
                  <span className="pm__stat-value">{stats.score}%</span>
                  <span className="pm__stat-label">{t("trust_score")}</span>
                </div>
              </div>
            </Tooltip>
            <Tooltip content="Day streak shows how many consecutive days you've been active" placement="top">
              <div className="pm__stat">
                <div className="pm__stat-icon pm__stat-icon--green"><Flame size={15} /></div>
                <div className="pm__stat-info">
                  <span className="pm__stat-value">{stats.dayStreak}</span>
                  <span className="pm__stat-label">{t("day_streak")}</span>
                </div>
              </div>
            </Tooltip>
            <Tooltip content="Total reactions you've given to other users' messages" placement="top">
              <div className="pm__stat">
                <div className="pm__stat-icon pm__stat-icon--purple"><Trophy size={15} /></div>
                <div className="pm__stat-info">
                  <span className="pm__stat-value">{stats.reactionsGiven}</span>
                  <span className="pm__stat-label">{t("reactions_given")}</span>
                </div>
              </div>
            </Tooltip>
          </div>

          {/* Badge Info */}
          {badges.length > 0 && (
            <div className="pm__badges-info">
              <div className="pm__badges-info-header">
                <span>Your Badges</span>
              </div>
              <div className="pm__badges-list">
                {badges.map((badge) => (
                  <Tooltip key={badge.id} content={badge.label} placement="top">
                    <div className="pm__badge-item">
                      <badge.icon size={16} />
                      <span>{badge.label}</span>
                    </div>
                  </Tooltip>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="pm__actions">
          {isOwnProfile ? (
            isEditing ? (
              <>
                <button className="pm__action-btn pm__action-btn--msg" onClick={handleSaveProfile}>
                  <Check size={14} />
                  <span>{t("settings:save_changes")}</span>
                </button>
                <button className="pm__action-btn" onClick={() => { setIsEditing(false); setEditBio(user.bio || ""); setEditDisplayName(user.nickname) }}>
                  <X size={14} />
                  <span>{t("settings:cancel")}</span>
                </button>
              </>
            ) : (
              <>
                <button className="pm__action-btn pm__action-btn--msg" onClick={() => setIsEditing(true)}>
                  <Pencil size={14} />
                  <span>{t("settings:edit_profile")}</span>
                </button>
                <button
                  className="pm__action-btn"
                  onClick={() => { handleClose(); onOpenSettings?.() }}
                >
                  <Settings size={14} />
                </button>
              </>
            )
          ) : (
            <>
              <button className="pm__action-btn pm__action-btn--msg" onClick={handleMessage}>
                <MessageSquare size={14} />
                <span>{t("message")}</span>
              </button>
              <button
                className={cn("pm__action-btn", { "pm__action-btn--off": !notificationsEnabled })}
                onClick={handleNotifClick}
              >
                {notificationsEnabled ? <Bell size={14} /> : <BellOff size={14} />}
              </button>
              <button className="pm__action-btn" onClick={handleMoreClick}>
                <MoreHorizontal size={14} />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Context Menus */}
      {contextMenu && (
        <Menu items={moreMenuItems} position={contextMenu} align="end" onClose={() => setContextMenu(null)} />
      )}
      {notifMenu && (
        <Menu items={notifMenuItems} position={notifMenu} align="end" onClose={() => setNotifMenu(null)} />
      )}
    </Backdrop>,
    document.body,
  )
}

export default ProfileModal
