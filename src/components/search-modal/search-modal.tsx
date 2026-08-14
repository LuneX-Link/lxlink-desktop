import { useEffect, useState, useRef, useCallback } from "react"
import { createPortal } from "react-dom"
import {
  Search,
  Users,
  Hash,
  MessageSquare,
  Settings,
  User,
  ArrowRight,
  X,
  Sparkles,
} from "lucide-react"
import { Avatar } from "../avatar/avatar"
import { Tooltip } from "../ui/tooltip/tooltip"
import { useTranslation } from "react-i18next"
import { searchApi } from "../../lib/api/searchApi"
import type { Profile } from "../../lib/api/profilesApi"
import { useAuthSession } from "../../contexts/auth-context"
import "./search-modal.scss"

interface SearchResultMessage {
  id: string
  content: string
  channel_id: string
  created_at: string
  profiles: {
    username: string
    display_name: string | null
    avatar_url: string | null
  }
}

interface SearchResultChannel {
  id: string
  name: string
  description: string
  type: string
}

export interface SearchModalProps {
  visible: boolean
  onClose: () => void
  onUserSelect?: (user: Profile) => void
  onChannelSelect?: (channelId: string) => void
  initialSearchType?: "all" | "users" | "messages"
}

export function SearchModal({ visible, onClose, onUserSelect, onChannelSelect, initialSearchType = "all" }: SearchModalProps) {
  const { t } = useTranslation("search")
  const { user: authUser } = useAuthSession()
  const [query, setQuery] = useState("")
  const [activeTab, setActiveTab] = useState<"all" | "users" | "messages">(initialSearchType)
  const [isClosing, setIsClosing] = useState(false)
  const [isSearching, setIsSearching] = useState(false)
  const [users, setUsers] = useState<Profile[]>([])
  const [messages, setMessages] = useState<SearchResultMessage[]>([])
  const [channels, setChannels] = useState<SearchResultChannel[]>([])
  const inputRef = useRef<HTMLInputElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const mouseDownTarget = useRef<EventTarget | null>(null)
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout>>()

  const handleClose = useCallback(() => {
    setIsClosing(true)
    setTimeout(() => {
      onClose()
      setIsClosing(false)
    }, 200)
  }, [onClose])

  useEffect(() => {
    if (visible) {
      setQuery("")
      setActiveTab("all")
      setIsClosing(false)
      setUsers([])
      setMessages([])
      setChannels([])
      setTimeout(() => inputRef.current?.focus(), 150)
    }
  }, [visible, handleClose])

  useEffect(() => {
    if (!visible) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose()
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [visible, handleClose])

  const performSearch = useCallback(async (searchQuery: string, tab: string) => {
    if (!searchQuery.trim()) {
      setUsers([])
      setMessages([])
      setChannels([])
      setIsSearching(false)
      return
    }

    setIsSearching(true)
    try {
      const type = tab === "users" ? "users" : tab === "messages" ? "messages" : "all"
      const result = await searchApi.search(searchQuery, type, 20)

      // Filter out current user from results
      const filteredUsers = ((result.users as Profile[]) || []).filter(
        (profile) => profile.id !== authUser?.id
      )

      setUsers(filteredUsers)
      setMessages((result.messages as SearchResultMessage[]) || [])
      setChannels((result.channels as SearchResultChannel[]) || [])
    } catch {
      setUsers([])
      setMessages([])
      setChannels([])
    } finally {
      setIsSearching(false)
    }
  }, [authUser?.id])

  useEffect(() => {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current)
    searchTimeoutRef.current = setTimeout(() => {
      performSearch(query, activeTab)
    }, 300)
    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current)
    }
  }, [query, activeTab, performSearch])

  const handleBackdropMouseDown = (e: React.MouseEvent) => {
    mouseDownTarget.current = e.target
  }

  const handleBackdropMouseUp = (e: React.MouseEvent) => {
    if (
      mouseDownTarget.current === e.target &&
      panelRef.current &&
      !panelRef.current.contains(e.target as Node)
    ) {
      handleClose()
    }
    mouseDownTarget.current = null
  }

  const hasResults = users.length > 0 || messages.length > 0 || channels.length > 0
  const isQuerying = query.length > 0

  if (!visible) return null

  return createPortal(
    <div
      className={`search-overlay ${isClosing ? "search-overlay--closing" : ""}`}
      onMouseDown={handleBackdropMouseDown}
      onMouseUp={handleBackdropMouseUp}
    >
      <div ref={panelRef} className="search-modal">
        {/* Search bar */}
        <div className="search-modal__search-bar">
          <div className="search-modal__search-icon-wrap">
            <Search size={18} className="search-modal__search-icon" />
          </div>
          <input
            ref={inputRef}
            type="text"
            className="search-modal__search-input"
            placeholder={t("search_placeholder")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
          />
          {query && (
            <Tooltip content={t("clear_search")} placement="top">
              <button
                className="search-modal__clear-btn"
                onClick={() => {
                  setQuery("")
                  inputRef.current?.focus()
                }}
              >
                <X size={14} />
              </button>
            </Tooltip>
          )}
          <div className="search-modal__kbd-hint">
            <kbd>Esc</kbd>
          </div>
        </div>

        {/* Tabs */}
        <div className="search-modal__tabs">
          {(["all", "users", "messages"] as const).map((tab) => (
            <button
              key={tab}
              className={`search-modal__tab ${activeTab === tab ? "search-modal__tab--active" : ""}`}
              onClick={() => setActiveTab(tab)}
            >
              {tab === "all" && <Sparkles size={12} />}
              {tab === "users" && <Users size={12} />}
              {tab === "messages" && <MessageSquare size={12} />}
              <span>{t(tab === "all" ? "search" : tab)}</span>
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="search-modal__content">
          {!isQuerying && (
            <div className="search-modal__empty-state">
              <div className="search-modal__empty-icon">
                <Search size={32} />
              </div>
              <p className="search-modal__empty-text">{t("type_to_search")}</p>
              <div className="search-modal__empty-hint">
                <span>{t("keyboard_hint")}</span>
                <kbd>Ctrl</kbd>
                <kbd>K</kbd>
                <span>{t("escape_hint")}</span>
              </div>
            </div>
          )}

          {isQuerying && isSearching && (
            <div className="search-modal__empty-state">
              <p className="search-modal__empty-text">Searching...</p>
            </div>
          )}

          {isQuerying && !isSearching && hasResults && (
            <div className="search-modal__results">
              {/* Users */}
              {(activeTab === "all" || activeTab === "users") && users.length > 0 && (
                <div className="search-modal__section search-modal__section--animated">
                  <div className="search-modal__section-header">
                    <Users size={12} />
                    <span>{t("users")}</span>
                    <span className="search-modal__section-count">{users.length}</span>
                  </div>
                  <div className="search-modal__list">
                    {users.map((user, i) => (
                      <button
                        key={user.id}
                        className="search-modal__item search-modal__item--animated"
                        style={{ animationDelay: `${i * 40}ms` }}
                        onClick={() => {
                          onUserSelect?.(user)
                          handleClose()
                        }}
                      >
                        <Avatar
                          size={36}
                          src={user.avatar_url}
                          alt={user.display_name || user.username}
                          status={user.status as any}
                        />
                        <div className="search-modal__item-info">
                          <span className="search-modal__item-name">{user.display_name || user.username}</span>
                          <span className="search-modal__item-meta">@{user.username}</span>
                        </div>
                        <ArrowRight size={14} className="search-modal__item-arrow" />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Channels */}
              {(activeTab === "all") && channels.length > 0 && (
                <div className="search-modal__section search-modal__section--animated">
                  <div className="search-modal__section-header">
                    <Hash size={12} />
                    <span>Channels</span>
                    <span className="search-modal__section-count">{channels.length}</span>
                  </div>
                  <div className="search-modal__list">
                    {channels.map((channel, i) => (
                      <button
                        key={channel.id}
                        className="search-modal__item search-modal__item--animated"
                        style={{ animationDelay: `${i * 40}ms` }}
                        onClick={() => {
                          onChannelSelect?.(channel.id)
                          handleClose()
                        }}
                      >
                        <div className="search-modal__item-icon">
                          <Hash size={20} />
                        </div>
                        <div className="search-modal__item-info">
                          <span className="search-modal__item-name">{channel.name}</span>
                          <span className="search-modal__item-meta">{channel.type}</span>
                        </div>
                        <ArrowRight size={14} className="search-modal__item-arrow" />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Messages */}
              {(activeTab === "all" || activeTab === "messages") && messages.length > 0 && (
                <div className="search-modal__section search-modal__section--animated">
                  <div className="search-modal__section-header">
                    <MessageSquare size={12} />
                    <span>{t("messages")}</span>
                    <span className="search-modal__section-count">{messages.length}</span>
                  </div>
                  <div className="search-modal__list">
                    {messages.map((msg, i) => (
                      <button
                        key={msg.id}
                        className="search-modal__item search-modal__item--animated"
                        style={{ animationDelay: `${i * 40}ms` }}
                        onClick={() => {
                          onChannelSelect?.(msg.channel_id)
                          handleClose()
                        }}
                      >
                        <Avatar
                          size={36}
                          src={msg.profiles?.avatar_url}
                          alt={msg.profiles?.display_name || msg.profiles?.username}
                        />
                        <div className="search-modal__item-info">
                          <span className="search-modal__item-name">
                            {msg.profiles?.display_name || msg.profiles?.username}
                          </span>
                          <span className="search-modal__item-meta">
                            {msg.content.length > 80 ? msg.content.slice(0, 80) + "..." : msg.content}
                          </span>
                        </div>
                        <ArrowRight size={14} className="search-modal__item-arrow" />
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {isQuerying && !isSearching && !hasResults && (
            <div className="search-modal__no-results search-modal__section--animated">
              <div className="search-modal__no-results-icon">
                <Search size={40} />
              </div>
              <p className="search-modal__no-results-text">
                {t("no_results")} "{query}"
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        {!isQuerying && (
          <div className="search-modal__footer">
            <div className="search-modal__footer-label">{t("quick_actions")}</div>
            <div className="search-modal__footer-actions">
              <Tooltip content={t("go_to_settings")} placement="top">
                <button
                  className="search-modal__action-btn"
                  onClick={() => {
                    onClose()
                    // Dispatch custom event to open settings
                    window.dispatchEvent(new CustomEvent('open-settings'))
                  }}
                >
                  <Settings size={14} />
                </button>
              </Tooltip>
              <Tooltip content={t("go_to_profile")} placement="top">
                <button
                  className="search-modal__action-btn"
                  onClick={() => {
                    onClose()
                    // Dispatch custom event to open profile
                    window.dispatchEvent(new CustomEvent('open-profile'))
                  }}
                >
                  <User size={14} />
                </button>
              </Tooltip>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}
