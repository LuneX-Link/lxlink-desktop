"use client"

import type React from "react"
import { useState } from "react"
import { Bell, Phone, Video, User } from "lucide-react"
import { Avatar } from "../avatar/avatar"
import { HeaderTextField } from "./header-text-field"
import Notifications from "./notifications"
import "./header.scss"
import { useTranslation } from "react-i18next"

interface ChatHeaderProps {
  user: {
    avatar: string | null
    name: string
  }
  onAudioCall?: () => void
  onVideoCall?: () => void
  onOpenProfile?: () => void
  onSearch?: (query: string) => void
}

export const HeaderChat: React.FC<ChatHeaderProps> = ({ user, onAudioCall, onVideoCall, onOpenProfile, onSearch }) => {
  const [showNotifications, setShowNotifications] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const { t } = useTranslation("header")

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setSearchQuery(value)
    onSearch?.(value)
  }

  return (
    <header className="header">
      <div className="header__left">
        <div className="header__user-info">
          <Avatar src={user.avatar} alt={user.name} size={34} />
          <span className="header__username">{user.name}</span>
        </div>
      </div>

      <div className="header__right">
        <button className="header__icon-button" onClick={onAudioCall}>
          <Phone />
        </button>

        <button className="header__icon-button" onClick={onVideoCall}>
          <Video />
        </button>

        <button className="header__icon-button" onClick={onOpenProfile}>
          <User />
        </button>

        <div className="header__search">
          <HeaderTextField value={searchQuery} onChange={handleSearchChange} placeholder={t("search_messages")} />
        </div>

        <button
          className="header__icon-button header__icon-button--notifications"
          onClick={() => setShowNotifications(!showNotifications)}
        >
          <Bell />
        </button>

        {showNotifications && <Notifications onClose={() => setShowNotifications(false)} />}
      </div>
    </header>
  )
}
