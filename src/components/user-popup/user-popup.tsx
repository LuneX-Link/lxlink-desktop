import { useEffect, useRef, useState, useCallback } from "react"
import { createPortal } from "react-dom"
import {
  User,
  Settings,
  LogOut,
  ChevronRight,
  Circle,
  Moon,
  MinusCircle,
  EyeOff,
} from "lucide-react"
import { Avatar } from "../avatar/avatar"
import { Tooltip } from "../ui/tooltip/tooltip"
import { useTranslation } from "react-i18next"
import type { UserData } from "../../types"
import type { PresenceStatus } from "../../hooks/usePresence"
import { getUserBadges } from "../../lib/roles"
import cn from "classnames"
import "./user-popup.scss"

interface UserPopupProps {
  visible: boolean
  anchorRef: React.RefObject<HTMLDivElement | null>
  profileUser: UserData
  userStatus: "online" | "dnd" | "inactive" | "offline" | "invisible"
  onClose: () => void
  onStatusChange?: (status: PresenceStatus) => void
  onOpenProfile?: () => void
  onOpenSettings?: () => void
  onSignOut?: () => Promise<void>
  sidebarWidth?: number
}

const STATUS_OPTIONS: { value: PresenceStatus; labelKey: string; icon: typeof Circle; color: string }[] = [
  { value: "online", labelKey: "statuses:online", icon: Circle, color: "#23a55a" },
  { value: "idle", labelKey: "statuses:idle", icon: Moon, color: "#f0b232" },
  { value: "dnd", labelKey: "statuses:dnd", icon: MinusCircle, color: "#f23f43" },
  { value: "invisible", labelKey: "statuses:invisible", icon: EyeOff, color: "#80848e" },
]

export const UserPopup: React.FC<UserPopupProps> = ({
  visible,
  anchorRef,
  profileUser,
  userStatus,
  onClose,
  onStatusChange,
  onOpenProfile,
  onOpenSettings,
  onSignOut,
  sidebarWidth = 309,
}) => {
  const { t } = useTranslation(["user_card", "statuses"])
  const popupRef = useRef<HTMLDivElement>(null)
  const badges = getUserBadges(profileUser)
  const [showStatusMenu, setShowStatusMenu] = useState(false)
  const [pos, setPos] = useState({ top: 0, left: 0 })
  const [isClosing, setIsClosing] = useState(false)
  const [popupWidth, setPopupWidth] = useState(sidebarWidth)
  const mouseDownTarget = useRef<EventTarget | null>(null)

  // Popup width = sidebar width - some padding so it fits nicely
  useEffect(() => {
    setPopupWidth(Math.max(260, sidebarWidth - 16))
  }, [sidebarWidth])

  const calculatePosition = useCallback(() => {
    if (!anchorRef.current) return
    const rect = anchorRef.current.getBoundingClientRect()
    const gap = 8
    const popupHeight = Math.min(400, window.innerHeight * 0.6)

    // Position: above the anchor button, left-aligned with sidebar
    let top = rect.top - gap - popupHeight
    let left = rect.left

    // Ensure popup stays within viewport bounds
    const maxTop = window.innerHeight - popupHeight - 12
    const minTop = 12

    // If goes above viewport, position below the anchor
    if (top < minTop) {
      top = rect.bottom + gap
      // If still doesn't fit, align to top of viewport
      if (top + popupHeight > window.innerHeight - 12) {
        top = maxTop
      }
    }

    // Clamp to viewport
    top = Math.max(minTop, Math.min(top, maxTop))

    // Keep horizontal within viewport - IMPORTANT: don't let it go off-screen right
    if (left + popupWidth > window.innerWidth - 12) {
      left = window.innerWidth - popupWidth - 12
    }
    if (left < 12) left = 12

    setPos({ top, left })
  }, [anchorRef, popupWidth])

  useEffect(() => {
    if (visible) {
      setIsClosing(false)
      calculatePosition()
    }
  }, [visible, calculatePosition])

  useEffect(() => {
    if (!visible) return

    const handleResize = () => calculatePosition()
    const handleScroll = () => calculatePosition()

    window.addEventListener("resize", handleResize)
    window.addEventListener("scroll", handleScroll, true)

    return () => {
      window.removeEventListener("resize", handleResize)
      window.removeEventListener("scroll", handleScroll, true)
    }
  }, [visible, calculatePosition])

  const handleClose = useCallback(() => {
    setIsClosing(true)
    setTimeout(() => {
      onClose()
      setIsClosing(false)
    }, 150)
  }, [onClose])

  useEffect(() => {
    if (!visible) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose()
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [visible, handleClose])

  const handleBackdropMouseDown = (e: React.MouseEvent) => {
    mouseDownTarget.current = e.target
  }

  const handleBackdropMouseUp = (e: React.MouseEvent) => {
    if (
      mouseDownTarget.current === e.target &&
      popupRef.current &&
      !popupRef.current.contains(e.target as Node) &&
      anchorRef.current &&
      !anchorRef.current.contains(e.target as Node)
    ) {
      handleClose()
    }
    mouseDownTarget.current = null
  }

  if (!visible) return null

  return createPortal(
    <div
      className="user-popup-backdrop"
      onMouseDown={handleBackdropMouseDown}
      onMouseUp={handleBackdropMouseUp}
    >
      <div
        ref={popupRef}
        className={`user-popup ${isClosing ? "user-popup--closing" : ""}`}
        style={{ top: pos.top, left: pos.left, width: popupWidth }}
      >
        {/* Banner */}
        <div
          className="user-popup__banner"
          style={profileUser.banner ? { backgroundImage: `url(${profileUser.banner})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}
        >
          {!profileUser.banner && <div className="user-popup__banner-shimmer" />}
        </div>

        {/* Avatar */}
        <div className="user-popup__avatar-section">
          <Avatar
            size={68}
            src={profileUser.avatar.src}
            alt={profileUser.nickname}
            status={userStatus}
          />
        </div>

        {/* User Info */}
        <div className="user-popup__info">
          <div className="user-popup__name-row">
            <span className="user-popup__name">{profileUser.nickname}</span>
            <div className="user-popup__status-dot" data-status={userStatus} />
          </div>
          <div className="user-popup__username">@{profileUser.username}</div>
        </div>

        {/* Badges */}
        <div className="user-popup__badges">
          {badges.map((badge) => {
            const Icon = badge.icon
            return (
              <Tooltip key={badge.id} content={badge.label} placement="top">
                <span
                  className="user-popup__badge user-popup__badge--animated"
                  style={{ "--badge-color": badge.color } as React.CSSProperties}
                >
                  <Icon size={13} />
                </span>
              </Tooltip>
            )
          })}
        </div>

        {/* Bio */}
        {profileUser.bio && (
          <div className="user-popup__bio">{profileUser.bio}</div>
        )}

        {/* Divider */}
        <div className="user-popup__divider" />

        {/* Actions */}
        <div className="user-popup__actions">
          {/* Set Status */}
          <div className="user-popup__status-section">
            <button
              className="user-popup__action"
              onClick={() => setShowStatusMenu((v) => !v)}
            >
              <div className="user-popup__action-icon">
                <div className={cn("user-popup__status-indicator", `user-popup__status-indicator--${userStatus}`)} />
              </div>
              <span>{t("user_card:set_status")}</span>
              <ChevronRight size={12} className={cn("user-popup__action-arrow", { "user-popup__action-arrow--open": showStatusMenu })} />
            </button>
            {showStatusMenu && (
              <div className="user-popup__status-menu">
                {STATUS_OPTIONS.map((opt) => {
                  const Icon = opt.icon
                  return (
                    <button
                      key={opt.value}
                      className={cn("user-popup__status-option", { "user-popup__status-option--active": userStatus === opt.value })}
                      onClick={() => {
                        onStatusChange?.(opt.value)
                        setShowStatusMenu(false)
                      }}
                    >
                      <Icon size={14} style={{ color: opt.color }} />
                      <span>{t(opt.labelKey)}</span>
                      {userStatus === opt.value && (
                        <div className="user-popup__status-check" style={{ background: opt.color }} />
                      )}
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          <button
            className="user-popup__action"
            onClick={() => { handleClose(); onOpenProfile?.() }}
          >
            <div className="user-popup__action-icon">
              <User size={14} />
            </div>
            <span>{t("my_profile")}</span>
            <ChevronRight size={12} className="user-popup__action-arrow" />
          </button>
          <button
            className="user-popup__action"
            onClick={() => { handleClose(); onOpenSettings?.() }}
          >
            <div className="user-popup__action-icon">
              <Settings size={14} />
            </div>
            <span>{t("settings")}</span>
            <ChevronRight size={12} className="user-popup__action-arrow" />
          </button>
          <button
            className="user-popup__action user-popup__action--danger"
            onClick={async () => { await onSignOut?.(); handleClose() }}
          >
            <div className="user-popup__action-icon user-popup__action-icon--danger">
              <LogOut size={14} />
            </div>
            <span>{t("sign_out")}</span>
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
