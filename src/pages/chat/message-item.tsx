import type React from "react"
import { useEffect, useMemo, useRef, useState } from "react"
import EmojiPicker, { EmojiStyle, SkinTones, Theme, type EmojiClickData } from "emoji-picker-react"
import {
  Check,
  CheckCheck,
  Copy,
  Hash,
  Link2,
  LoaderCircle,
  MoreHorizontal,
  Pencil,
  Pin,
  Reply,
  Share2,
  Smile,
  SmilePlus,
  Trash2,
  X,
} from "lucide-react"
import { Avatar } from "../../components/avatar/avatar"
import { AttachmentPreview } from "../../components/attachment-preview/attachment-preview"
import { Menu, type MenuItem } from "../../components/ui/menu/menu"
import { Popover } from "../../components/ui/popover/popover"
import { Tooltip } from "../../components/ui/tooltip/tooltip"
import { parseMessageBody } from "../../lib/attachments"
import { formatClockTime, formatDayAndTime } from "../../lib/format-time"
import type { Message } from "../../hooks/useChatMessages"

interface MessageItemProps {
  message: Message
  displayName: string
  avatar?: string | null
  isOwn: boolean
  highlighted: boolean
  /** Gated by the privacy setting — hides the delivered/read ticks entirely. */
  showReadReceipts: boolean
  /** MRU emoji: first three feed the toolbar, first five the context menu. */
  recentReactions: string[]
  currentUserId?: string
  onToggleReaction: (emoji: string) => void
  onReply: () => void
  onEdit: (content: string) => void
  onDelete: () => void
  onOpenProfile: () => void
}

const escapeHtml = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")

const renderInlineMarkdown = (value: string) => ({
  __html: escapeHtml(value)
    .replace(/```([\s\S]*?)```/g, "<pre><code>$1</code></pre>")
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>")
    .replace(/~~([^~]+)~~/g, "<s>$1</s>")
    .replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noreferrer">$1</a>'),
})

export const MessageItem: React.FC<MessageItemProps> = ({
  message,
  displayName,
  avatar,
  isOwn,
  highlighted,
  showReadReceipts,
  recentReactions,
  currentUserId,
  onToggleReaction,
  onReply,
  onEdit,
  onDelete,
  onOpenProfile,
}) => {
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null)
  const [reactionAnchor, setReactionAnchor] = useState<HTMLElement | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [editDraft, setEditDraft] = useState("")
  const editRef = useRef<HTMLTextAreaElement>(null)

  // Attachments live inside the message body until the backend grows a table.
  const { text, attachments } = useMemo(() => parseMessageBody(message.content), [message.content])
  const groupedReactions = Object.entries(message.reactions ?? {}).filter(([, users]) => users.length > 0)
  const myReactions = groupedReactions
    .filter(([, users]) => (currentUserId ? users.includes(currentUserId) : false))
    .map(([emoji]) => emoji)

  useEffect(() => {
    if (!isEditing) return
    const element = editRef.current
    if (!element) return
    element.focus()
    element.setSelectionRange(element.value.length, element.value.length)
    element.style.height = "auto"
    element.style.height = `${Math.min(element.scrollHeight, 220)}px`
  }, [isEditing])

  const startEditing = () => {
    setEditDraft(text || message.content)
    setIsEditing(true)
  }

  const commitEdit = () => {
    const next = editDraft.trim()
    if (next && next !== (text || message.content)) onEdit(next)
    setIsEditing(false)
  }

  const copyText = () => void navigator.clipboard.writeText(text || message.content)
  const copyLink = () => void navigator.clipboard.writeText(`astrolune://message/${message.messageId}`)
  const copyId = () => void navigator.clipboard.writeText(message.messageId)

  const applyReaction = (emoji: string) => onToggleReaction(emoji)

  // Same items for the right-click menu and the toolbar's three-dots button.
  const menuItems: MenuItem[] = [
    { label: "Ответить", icon: <Reply size={15} />, onClick: onReply, shortcut: "R" },
    ...(isOwn ? [{ label: "Изменить", icon: <Pencil size={15} />, onClick: startEditing, shortcut: "E" } as MenuItem] : []),
    { label: "Закрепить", icon: <Pin size={15} />, onClick: () => undefined },
    { separator: true },
    { label: "Копировать текст", icon: <Copy size={15} />, onClick: copyText, shortcut: "Ctrl+C" },
    { label: "Копировать ссылку", icon: <Link2 size={15} />, onClick: copyLink },
    { label: "Переслать", icon: <Share2 size={15} />, onClick: copyText },
    ...(isOwn
      ? [{ separator: true } as MenuItem, { label: "Удалить сообщение", icon: <Trash2 size={15} />, onClick: onDelete, danger: true } as MenuItem]
      : []),
    { separator: true },
    { label: "Копировать ID сообщения", icon: <Hash size={15} />, onClick: copyId },
  ]

  const openMenuAt = (event: React.MouseEvent) => {
    event.preventDefault()
    setContextMenu({ x: event.clientX, y: event.clientY })
  }

  return (
    <article
      id={`message-${message.messageId}`}
      data-message-id={message.messageId}
      className={`message-item${isOwn ? " message-item--own" : ""}${highlighted ? " message-item--highlighted" : ""}${
        contextMenu ? " message-item--menu-open" : ""
      }`}
      onContextMenu={openMenuAt}
    >
      <button type="button" className="message-item__avatar" onClick={onOpenProfile} aria-label={displayName}>
        <Avatar src={avatar ?? null} alt={displayName} size={36} />
      </button>

      <div className="message-item__body">
        <div className="message-item__meta">
          <button type="button" className="message-item__author" onClick={onOpenProfile}>
            {displayName}
          </button>
          <time title={formatDayAndTime(message.createdAt)}>{formatClockTime(message.createdAt)}</time>
          {message.editedAt && <span className="message-item__edited">изменено</span>}
          {showReadReceipts && isOwn && (
            <span className="message-item__status">
              {message.status === "pending" && <LoaderCircle size={13} className="message-item__pending" />}
              {message.status === "sent" && <Check size={13} />}
              {(message.status === "delivered" || message.status === "read" || !message.status) && <CheckCheck size={14} />}
            </span>
          )}
        </div>

        {message.replyToId && (
          <div className="message-item__reply-reference">
            <Reply size={12} /> Ответ на сообщение
          </div>
        )}

        {isEditing ? (
          <div className="message-item__editor">
            <textarea
              ref={editRef}
              value={editDraft}
              rows={1}
              onChange={(event) => {
                setEditDraft(event.target.value)
                event.target.style.height = "auto"
                event.target.style.height = `${Math.min(event.target.scrollHeight, 220)}px`
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault()
                  commitEdit()
                }
                if (event.key === "Escape") {
                  event.preventDefault()
                  setIsEditing(false)
                }
              }}
            />
            <div className="message-item__editor-actions">
              <span>Enter — сохранить · Esc — отменить</span>
              <button type="button" className="message-item__editor-cancel" onClick={() => setIsEditing(false)}>
                <X size={13} /> Отменить
              </button>
              <button type="button" className="message-item__editor-save" onClick={commitEdit}>
                <Check size={13} /> Сохранить
              </button>
            </div>
          </div>
        ) : (
          text && <div className="message-item__content" dangerouslySetInnerHTML={renderInlineMarkdown(text)} />
        )}

        {attachments.length > 0 && (
          <div className="message-item__attachments">
            {attachments.map((attachment) => (
              <AttachmentPreview
                key={attachment.id}
                attachment={attachment}
                defaultExpanded={attachment.kind !== "code"}
              />
            ))}
          </div>
        )}

        {groupedReactions.length > 0 && (
          <div className="message-item__reactions">
            {groupedReactions.map(([emoji, users]) => (
              <button
                key={emoji}
                type="button"
                className={myReactions.includes(emoji) ? "is-active" : undefined}
                onClick={() => applyReaction(emoji)}
              >
                <span>{emoji}</span>
                <strong>{users.length}</strong>
              </button>
            ))}
            <Tooltip content="Добавить реакцию">
              <button
                type="button"
                className="message-item__reactions-add"
                onClick={(event) => setReactionAnchor(event.currentTarget)}
              >
                <SmilePlus size={14} />
              </button>
            </Tooltip>
          </div>
        )}

        {/* Hover toolbar: 3 recent reactions │ add · reply · edit · more */}
        <div className="message-item__actions">
          {recentReactions.slice(0, 3).map((emoji) => (
            <Tooltip key={emoji} content={emoji}>
              <button
                type="button"
                className={`message-item__action message-item__action--emoji${
                  myReactions.includes(emoji) ? " is-active" : ""
                }`}
                onClick={() => applyReaction(emoji)}
              >
                {emoji}
              </button>
            </Tooltip>
          ))}

          <span className="message-item__actions-divider" />

          <Tooltip content="Добавить реакцию">
            <button
              type="button"
              className="message-item__action"
              onClick={(event) => setReactionAnchor(event.currentTarget)}
            >
              <Smile size={15} />
            </button>
          </Tooltip>
          <Tooltip content="Ответить">
            <button type="button" className="message-item__action" onClick={onReply}>
              <Reply size={15} />
            </button>
          </Tooltip>
          {isOwn && (
            <Tooltip content="Изменить">
              <button type="button" className="message-item__action" onClick={startEditing}>
                <Pencil size={15} />
              </button>
            </Tooltip>
          )}
          <Tooltip content="Ещё">
            <button
              type="button"
              className="message-item__action"
              onClick={(event) => {
                const rect = event.currentTarget.getBoundingClientRect()
                setContextMenu({ x: rect.right, y: rect.bottom + 4 })
              }}
            >
              <MoreHorizontal size={16} />
            </button>
          </Tooltip>
        </div>
      </div>

      {contextMenu && (
        <Menu
          items={menuItems}
          position={contextMenu}
          reactions={recentReactions.slice(0, 5)}
          activeReactions={myReactions}
          onReactionSelect={applyReaction}
          reactionTrailing={{
            icon: <SmilePlus size={15} />,
            label: "Все реакции",
            onClick: () => {
              const target = document.querySelector<HTMLElement>(
                `[data-message-id="${message.messageId}"] .message-item__actions .message-item__action`,
              )
              setReactionAnchor(target ?? null)
            },
          }}
          onClose={() => setContextMenu(null)}
        />
      )}

      {reactionAnchor && (
        <Popover anchor={reactionAnchor} align="end" onClose={() => setReactionAnchor(null)} className="message-item__emoji-pop">
          <EmojiPicker
            width={320}
            height={400}
            theme={Theme.DARK}
            emojiStyle={EmojiStyle.NATIVE}
            defaultSkinTone={SkinTones.NEUTRAL}
            lazyLoadEmojis
            searchPlaceholder="Найти реакцию"
            previewConfig={{ showPreview: false }}
            onEmojiClick={(emojiData: EmojiClickData) => {
              applyReaction(emojiData.emoji)
              setReactionAnchor(null)
            }}
          />
        </Popover>
      )}
    </article>
  )
}

export default MessageItem
