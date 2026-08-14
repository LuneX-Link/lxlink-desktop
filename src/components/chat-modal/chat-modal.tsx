import { useState, useCallback, useEffect, useRef } from "react"
import { createPortal } from "react-dom"
import {
  Search,
  Users,
  MessageSquare,
  ArrowRight,
  Plus,
  UserPlus,
  X,
} from "lucide-react"
import { Avatar } from "../avatar/avatar"
import { Tooltip } from "../ui/tooltip/tooltip"
import { useTranslation } from "react-i18next"
import type { Chat } from "../../types"
import "./chat-modal.scss"

interface NewChatModalProps {
  visible: boolean
  onClose: () => void
  chats: Chat[]
  onSelectChat: (chatId: string) => void
}

export const NewChatModal: React.FC<NewChatModalProps> = ({
  visible,
  onClose,
  chats,
  onSelectChat,
}) => {
  const { t } = useTranslation("empty_states")
  const [search, setSearch] = useState("")
  const [tab, setTab] = useState<"dm" | "group">("dm")
  const [isClosing, setIsClosing] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const mouseDownTarget = useRef<EventTarget | null>(null)

  useEffect(() => {
    if (visible) {
      setSearch("")
      setTab("dm")
      setIsClosing(false)
      setTimeout(() => inputRef.current?.focus(), 150)
    }
  }, [visible])

  const handleClose = useCallback(() => {
    setIsClosing(true)
    setTimeout(() => {
      onClose()
      setIsClosing(false)
    }, 200)
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
      panelRef.current &&
      !panelRef.current.contains(e.target as Node)
    ) {
      handleClose()
    }
    mouseDownTarget.current = null
  }

  const recent = chats.slice(0, 5)
  const filtered = chats.filter(
    (c) =>
      !search ||
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      (c.status ?? "").toLowerCase().includes(search.toLowerCase()),
  )

  const handleSelect = useCallback(
    (chatId: string) => {
      onSelectChat(chatId)
      handleClose()
    },
    [handleClose, onSelectChat],
  )

  if (!visible) return null

  return createPortal(
    <div
      className={`ncm-overlay ${isClosing ? "ncm-overlay--closing" : ""}`}
      onMouseDown={handleBackdropMouseDown}
      onMouseUp={handleBackdropMouseUp}
    >
      <div ref={panelRef} className="ncm-panel">
        {/* Search bar */}
        <div className="ncm-panel__search-bar">
          <div className="ncm-panel__search-icon-wrap">
            {tab === "dm" ? (
              <MessageSquare size={16} className="ncm-panel__search-icon" />
            ) : (
              <Users size={16} className="ncm-panel__search-icon" />
            )}
          </div>
          <input
            ref={inputRef}
            type="text"
            className="ncm-panel__search-input"
            placeholder={
              tab === "dm" ? t("new_msg_dm_placeholder") : t("new_msg_group_placeholder")
            }
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoFocus
          />
          {search && (
            <Tooltip content={t("new_msg_no_results_body")} placement="top">
              <button
                className="ncm-panel__clear-btn"
                onClick={() => {
                  setSearch("")
                  inputRef.current?.focus()
                }}
              >
                <X size={14} />
              </button>
            </Tooltip>
          )}
          <div className="ncm-panel__kbd-hint">
            <kbd>Esc</kbd>
          </div>
        </div>

        {/* Tabs */}
        <div className="ncm-panel__tabs">
          <button
            className={`ncm-panel__tab ${tab === "dm" ? "ncm-panel__tab--active" : ""}`}
            onClick={() => setTab("dm")}
          >
            <MessageSquare size={12} />
            <span>{t("new_msg_tab_dm")}</span>
          </button>
          <button
            className={`ncm-panel__tab ${tab === "group" ? "ncm-panel__tab--active" : ""}`}
            onClick={() => setTab("group")}
          >
            <Users size={12} />
            <span>{t("new_msg_tab_group")}</span>
          </button>
        </div>

        {/* Content */}
        <div className="ncm-panel__content">
          {tab === "dm" ? (
            <div className="ncm-panel__body ncm-panel__body--animated">
              {/* Recent chats */}
              {!search && recent.length > 0 && (
                <div className="ncm-panel__section">
                  <div className="ncm-panel__section-header">
                    <span>{t("recent")}</span>
                    <span className="ncm-panel__section-count">{recent.length}</span>
                  </div>
                  <div className="ncm-panel__list">
                    {recent.map((chat, i) => (
                      <button
                        key={chat.id}
                        className="ncm-panel__item ncm-panel__item--animated"
                        style={{ animationDelay: `${i * 40}ms` }}
                        onClick={() => handleSelect(chat.id)}
                      >
                        <Avatar size={32} src={chat.avatar} alt={chat.name} status="online" />
                        <div className="ncm-panel__item-info">
                          <span className="ncm-panel__item-name">{chat.name}</span>
                          {chat.status && (
                            <span className="ncm-panel__item-meta">{chat.status}</span>
                          )}
                        </div>
                        <ArrowRight size={14} className="ncm-panel__item-arrow" />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Empty recent */}
              {!search && recent.length === 0 && (
                <div className="ncm-panel__empty">
                  <div className="ncm-panel__empty-icon-wrap">
                    <MessageSquare size={24} />
                  </div>
                  <p className="ncm-panel__empty-title">{t("new_msg_no_recent_title")}</p>
                  <p className="ncm-panel__empty-subtitle">{t("new_msg_no_recent_body")}</p>
                </div>
              )}

              {/* Search results */}
              {search && filtered.length > 0 && (
                <div className="ncm-panel__section">
                  <div className="ncm-panel__section-header">
                    <span>{t("results")}</span>
                    <span className="ncm-panel__section-count">{filtered.length}</span>
                  </div>
                  <div className="ncm-panel__list">
                    {filtered.map((chat, i) => (
                      <button
                        key={chat.id}
                        className="ncm-panel__item ncm-panel__item--animated"
                        style={{ animationDelay: `${i * 40}ms` }}
                        onClick={() => handleSelect(chat.id)}
                      >
                        <Avatar size={32} src={chat.avatar} alt={chat.name} />
                        <div className="ncm-panel__item-info">
                          <span className="ncm-panel__item-name">{chat.name}</span>
                          {chat.status && (
                            <span className="ncm-panel__item-meta">{chat.status}</span>
                          )}
                        </div>
                        <ArrowRight size={14} className="ncm-panel__item-arrow" />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* No results */}
              {search && filtered.length === 0 && (
                <div className="ncm-panel__empty">
                  <div className="ncm-panel__empty-icon-wrap">
                    <Search size={24} />
                  </div>
                  <p className="ncm-panel__empty-title">{t("new_msg_no_results_title")}</p>
                  <p className="ncm-panel__empty-subtitle">{t("new_msg_no_results_body")}</p>
                </div>
              )}
            </div>
          ) : (
            <div className="ncm-panel__body ncm-panel__body--animated">
              <div className="ncm-panel__group-create">
                <div className="ncm-panel__group-icon-wrap">
                  <UserPlus size={28} />
                </div>
                <p className="ncm-panel__group-title">{t("new_msg_group_title")}</p>
                <p className="ncm-panel__group-subtitle">{t("new_msg_group_body")}</p>
                <Tooltip content={t("new_msg_create_group")} placement="top">
                  <button className="ncm-panel__group-btn">
                    <Plus size={14} />
                    <span>{t("new_msg_create_group")}</span>
                  </button>
                </Tooltip>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}
