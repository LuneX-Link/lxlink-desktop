"use client"
import { useRef, useEffect, useState } from "react"
import { Avatar } from "../avatar/avatar"
import { ContextMenu } from "../context-menu/context-menu"
import { Tooltip } from "../ui/tooltip/tooltip"
import {
  X,
  MessageCircle,
  UserPlus,
  MoreHorizontal,
  Bell,
  Shield,
  Zap,
  Clock,
  Star,
  TrendingUp,
  Users,
  MessageSquare,
  Heart,
  Award,
  Activity,
} from "lucide-react"
import { useTranslation } from "react-i18next"
import type { UserData } from "../../types"
import "./user-modal.scss"

interface UserModalProps {
  isOpen: boolean
  onClose: () => void
  user: UserData
  onMessage?: () => void
  onAddFriend?: () => void
}

export function UserModal({ isOpen, onClose, user, onMessage, onAddFriend }: UserModalProps) {
  const modalRef = useRef<HTMLDivElement>(null)
  const { t } = useTranslation("user_card")
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null)
  const [notifMenu, setNotifMenu] = useState<{ x: number; y: number } | null>(null)

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (contextMenu) { setContextMenu(null); return }
        if (notifMenu) { setNotifMenu(null); return }
        onClose()
      }
    }

    if (isOpen) {
      document.addEventListener("keydown", handleEscape)
      document.body.style.overflow = "hidden"
    }

    return () => {
      document.removeEventListener("keydown", handleEscape)
      document.body.style.overflow = "unset"
    }
  }, [isOpen, onClose, contextMenu, notifMenu])

  const handleMoreClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    setContextMenu({ x: e.clientX, y: e.clientY })
  }

  const handleNotifClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    setNotifMenu({ x: e.clientX, y: e.clientY })
  }

  if (!isOpen) return null

  const { banner, username, nickname, bio, pronouns } = user

  const moreMenuItems = [
    { label: t("copy_id"), icon: <Award size={14} />, onClick: () => navigator.clipboard.writeText(user.id) },
    { label: t("block_user"), icon: <Shield size={14} />, danger: true },
    { label: t("report_user"), icon: <Heart size={14} />, danger: true },
  ]

  const notifMenuItems = [
    { label: t("notif_everything"), icon: <Bell size={14} /> },
    { label: t("notif_mentions"), icon: <MessageSquare size={14} /> },
    { label: t("notif_nothing"), icon: <Bell size={14} /> },
    { separator: true, label: "" },
    { label: t("notif_mute"), icon: <Bell size={14} /> },
  ]

  return (
    <div className="user-modal-backdrop" onClick={onClose}>
      <div ref={modalRef} className="user-modal" onClick={(e) => e.stopPropagation()}>
        <button className="user-modal__close" onClick={onClose}>
          <X size={18} />
        </button>

        {/* Banner */}
        <div className="user-modal__banner">
          {banner && <img src={banner || "/placeholder.svg"} alt="" />}
          <div className="user-modal__banner-shimmer" />
        </div>

        {/* Avatar */}
        <div className="user-modal__avatar-section">
          <div className="user-modal__avatar-wrapper">
            <div className="user-modal__avatar-border">
              <Avatar size={88} src={user.avatar?.src} alt={user.avatar?.alt || user.username} status={user.status as any} />
            </div>
          </div>
        </div>

        {/* Header */}
        <div className="user-modal__content">
          <div className="user-modal__header">
            <div className="user-modal__name-row">
              <h2 className="user-modal__name">{nickname}</h2>
              {pronouns && <span className="user-modal__pronouns">{pronouns}</span>}
            </div>
            <div className="user-modal__username">{username}</div>
          </div>

          <div className="user-modal__divider" />

          {/* About */}
          {bio && (
            <div className="user-modal__section">
              <div className="user-modal__section-title">{t("about_me")}</div>
              <div className="user-modal__bio">{bio}</div>
            </div>
          )}

          {/* Trust Factor */}
          <div className="user-modal__section">
            <div className="user-modal__section-title">{t("trust_factor")}</div>
            <div className="user-modal__stats-grid">
              <div className="user-modal__stat">
                <div className="user-modal__stat-icon user-modal__stat-icon--green">
                  <Shield size={14} />
                </div>
                <div className="user-modal__stat-info">
                  <span className="user-modal__stat-value">92%</span>
                  <span className="user-modal__stat-label">{t("trust_score")}</span>
                </div>
              </div>
              <div className="user-modal__stat">
                <div className="user-modal__stat-icon user-modal__stat-icon--blue">
                  <Zap size={14} />
                </div>
                <div className="user-modal__stat-info">
                  <span className="user-modal__stat-value">1.2k</span>
                  <span className="user-modal__stat-label">{t("messages_sent")}</span>
                </div>
              </div>
              <div className="user-modal__stat">
                <div className="user-modal__stat-icon user-modal__stat-icon--yellow">
                  <Clock size={14} />
                </div>
                <div className="user-modal__stat-info">
                  <span className="user-modal__stat-value">45h</span>
                  <span className="user-modal__stat-label">{t("time_in_call")}</span>
                </div>
              </div>
              <div className="user-modal__stat">
                <div className="user-modal__stat-icon user-modal__stat-icon--purple">
                  <Star size={14} />
                </div>
                <div className="user-modal__stat-info">
                  <span className="user-modal__stat-value">128</span>
                  <span className="user-modal__stat-label">{t("reactions_given")}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Activity Stats */}
          <div className="user-modal__section">
            <div className="user-modal__section-title">{t("activity")}</div>
            <div className="user-modal__activity-bar">
              <div className="user-modal__activity-header">
                <span className="user-modal__activity-label">{t("weekly_activity")}</span>
                <span className="user-modal__activity-value">87%</span>
              </div>
              <div className="user-modal__progress-track">
                <div className="user-modal__progress-fill" style={{ width: "87%" }} />
              </div>
            </div>
            <div className="user-modal__activity-stats">
              <div className="user-modal__activity-stat">
                <TrendingUp size={12} />
                <span>{t("messages_week")}: 342</span>
              </div>
              <div className="user-modal__activity-stat">
                <Users size={12} />
                <span>{t("calls_joined")}: 12</span>
              </div>
              <div className="user-modal__activity-stat">
                <Activity size={12} />
                <span>{t("avg_daily")}: 48m</span>
              </div>
            </div>
          </div>

          <div className="user-modal__divider" />

          {/* Actions */}
          <div className="user-modal__actions">
            <button className="user-modal__action user-modal__action--primary" onClick={onMessage}>
              <div className="user-modal__action-icon">
                <MessageCircle size={14} />
              </div>
              <span>{t("message")}</span>
            </button>
            <button className="user-modal__action user-modal__action--secondary" onClick={onAddFriend}>
              <div className="user-modal__action-icon">
                <UserPlus size={14} />
              </div>
            </button>
            <Tooltip content={t("notifications")} placement="top">
              <button className="user-modal__action user-modal__action--secondary" onClick={handleNotifClick}>
                <div className="user-modal__action-icon">
                  <Bell size={14} />
                </div>
              </button>
            </Tooltip>
            <button className="user-modal__action user-modal__action--secondary" onClick={handleMoreClick}>
              <div className="user-modal__action-icon">
                <MoreHorizontal size={14} />
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* Context Menu - More */}
      {contextMenu && (
        <ContextMenu position={contextMenu} items={moreMenuItems} onClose={() => setContextMenu(null)} />
      )}

      {/* Context Menu - Notifications */}
      {notifMenu && (
        <ContextMenu position={notifMenu} items={notifMenuItems} onClose={() => setNotifMenu(null)} />
      )}
    </div>
  )
}

export default UserModal
