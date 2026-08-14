"use client"

import type React from "react"
import { Camera, Trash2, Calendar } from "lucide-react"
import { Avatar } from "../avatar/avatar"
import { Tooltip } from "../ui/tooltip/tooltip"
import { useTranslation } from "react-i18next"
import type { UserData } from "../../types"
import { getUserBadges } from "../../lib/roles"
import "./profile-card.scss"

interface ProfileCardProps {
  user: UserData
  displayName: string
  pronouns: string
  bio?: string
  createdAt?: string
  onAvatarClick?: () => void
  onBannerClick?: () => void
  onRemoveAvatar?: () => void
  editable?: boolean
}

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr)
    return d.toLocaleDateString("ru-RU", { day: "numeric", month: "short", year: "numeric" })
  } catch {
    return dateStr
  }
}

export const ProfileCard: React.FC<ProfileCardProps> = ({
  user,
  displayName,
  pronouns,
  bio,
  createdAt,
  onAvatarClick,
  onBannerClick,
  onRemoveAvatar,
  editable = false,
}) => {
  const { t } = useTranslation("settings")
  const badges = getUserBadges(user)

  const bannerStyle = user.banner
    ? { backgroundImage: `url(${user.banner})`, backgroundSize: "cover", backgroundPosition: "center" }
    : undefined

  return (
    <div className="profile-preview__card">
      <div
        className="profile-preview__banner"
        style={bannerStyle}
        onClick={editable ? onBannerClick : undefined}
      >
        {!user.banner && <div className="profile-preview__banner-pattern" />}
        {editable && (
          <div className="profile-preview__banner-overlay">
            <Camera size={14} />
            <span>{t("change_banner")}</span>
          </div>
        )}
      </div>

      <div className="profile-preview__body">
        <div className="profile-preview__avatar-row">
          <div
            className="profile-preview__avatar-clickable"
            onClick={editable ? onAvatarClick : undefined}
          >
            <Avatar size={64} src={user.avatar.src} alt={user.nickname} />
            {editable && (
              <div className="profile-preview__avatar-overlay">
                <Camera size={16} />
              </div>
            )}
            {editable && user.avatar.src && (
              <button
                className="profile-preview__avatar-remove"
                onClick={(e) => {
                  e.stopPropagation()
                  onRemoveAvatar?.()
                }}
                title={t("remove_avatar")}
              >
                <Trash2 size={12} />
              </button>
            )}
          </div>

          <div className="profile-preview__badges">
            {badges.map((badge) => {
              const Icon = badge.icon
              return (
                <Tooltip key={badge.id} content={badge.label} placement="top">
                  <span
                    className="profile-preview__badge profile-preview__badge--animated"
                    style={{ "--badge-color": badge.color } as React.CSSProperties}
                  >
                    <Icon size={13} />
                  </span>
                </Tooltip>
              )
            })}
          </div>
        </div>

        <div className="profile-preview__info">
          <div className="profile-preview__name">{displayName || user.nickname}</div>
          <div className="profile-preview__username">
            @{user.username}
            {pronouns && <span className="profile-preview__pronouns">{pronouns}</span>}
          </div>
        </div>

        {bio && (
          <div className="profile-preview__bio">{bio}</div>
        )}

        {createdAt && (
          <div className="profile-preview__meta">
            <Calendar size={12} />
            <span>{t("member_since")} {formatDate(createdAt)}</span>
          </div>
        )}
      </div>
    </div>
  )
}
