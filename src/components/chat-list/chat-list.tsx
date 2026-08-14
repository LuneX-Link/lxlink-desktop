"use client"

import type React from "react"
import { useMemo, useState, useCallback } from "react"
import { Search, Plus, MessageSquare } from "lucide-react"
import cn from "classnames"
import { Avatar } from "../avatar/avatar"
import type { Chat } from "../../types"
import { formatRelativeTime } from "../../lib/format-time"
import "./chat-list.scss"

type PresenceMap = Record<string, "online" | "dnd" | "inactive" | "offline">

const MESSAGE_PREVIEW_MAX_LENGTH = 48

interface ChatListProps {
  chats: Chat[]
  activeChatId?: string
  presence?: PresenceMap
  onChatSelect: (chatId: string) => void
  onNewChat: () => void
}

export const ChatList: React.FC<ChatListProps> = ({
  chats,
  activeChatId,
  presence,
  onChatSelect,
  onNewChat,
}) => {
  const [search, setSearch] = useState("")

  const filtered = useMemo(
    () =>
      chats.filter(
        (chat) =>
          !search ||
          chat.name.toLowerCase().includes(search.toLowerCase()) ||
          (chat.lastMessage ?? "").toLowerCase().includes(search.toLowerCase()),
      ),
    [chats, search],
  )

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault()
        const currentIndex = filtered.findIndex((c) => c.id === activeChatId)
        const nextIndex =
          e.key === "ArrowDown"
            ? Math.min(currentIndex + 1, filtered.length - 1)
            : Math.max(currentIndex - 1, 0)
        const nextChat = filtered[nextIndex]
        if (nextChat) onChatSelect(nextChat.id)
      }
    },
    [filtered, activeChatId, onChatSelect],
  )

  return (
    <div className="chat-list" tabIndex={0} onKeyDown={handleKeyDown}>
      <div className="chat-list__header">
        <h2 className="chat-list__title">Messages</h2>
        <button className="chat-list__new-btn" onClick={onNewChat} aria-label="New chat">
          <Plus size={18} />
        </button>
      </div>

      <div className="chat-list__search">
        <Search size={14} className="chat-list__search-icon" />
        <input
          className="chat-list__search-input"
          type="text"
          placeholder="Search messages..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="chat-list__items">
        {filtered.length === 0 ? (
          <div className="chat-list__empty">
            <MessageSquare size={32} />
            <p>No conversations</p>
            <p className="chat-list__empty-sub">Start chatting with someone</p>
          </div>
        ) : (
          filtered.map((chat) => (
            <button
              key={chat.id}
              className={cn("chat-list__item", { "chat-list__item--active": activeChatId === chat.id })}
              onClick={() => onChatSelect(chat.id)}
            >
              <div className="chat-list__item-avatar">
                <Avatar size={42} src={chat.avatar} alt={chat.name} rounded status={presence?.[chat.id]} />
                {chat.unreadCount && chat.unreadCount > 0 && (
                  <span className="chat-list__item-badge">{chat.unreadCount > 99 ? "99+" : chat.unreadCount}</span>
                )}
              </div>
              <div className="chat-list__item-info">
                <div className="chat-list__item-row">
                  <span className="chat-list__item-name">{chat.name}</span>
                  <span className="chat-list__item-time">
                    {chat.lastMessageAt ? formatRelativeTime(chat.lastMessageAt) : ""}
                  </span>
                </div>
                <div className="chat-list__item-row">
                  <span className="chat-list__item-preview">
                    {chat.lastMessage
                      ? chat.lastMessage.length > MESSAGE_PREVIEW_MAX_LENGTH
                        ? `${chat.lastMessage.slice(0, MESSAGE_PREVIEW_MAX_LENGTH)}...`
                        : chat.lastMessage
                      : chat.status ?? "No messages yet"}
                  </span>
                </div>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  )
}
