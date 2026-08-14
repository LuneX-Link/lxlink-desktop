"use client"

import type React from "react"
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { ChevronRight } from "lucide-react"
import cn from "classnames"
import "./menu.scss"

// ─── Types ───────────────────────────────────────────────────────────────────

export interface MenuItem {
  /** Visible label. Omitted for separators. */
  label?: string
  icon?: React.ReactNode
  onClick?: () => void
  /** Renders a horizontal rule instead of a row. */
  separator?: boolean
  /** Small uppercase caption row. */
  header?: boolean
  danger?: boolean
  disabled?: boolean
  /** Right-aligned hint, e.g. a keyboard shortcut. */
  shortcut?: string
  /** Marks the row as currently selected (shows a check). */
  active?: boolean
  submenu?: MenuItem[]
  /** Stable key when labels repeat. */
  id?: string
}

export type MenuAlign = "start" | "end"

export interface MenuProps {
  /** Anchor point in viewport coordinates (from a click or an element rect). */
  position: { x: number; y: number }
  items: MenuItem[]
  onClose: () => void
  /** Emoji row rendered above the items. */
  reactions?: string[]
  onReactionSelect?: (emoji: string) => void
  /** Emojis already applied by the current user. */
  activeReactions?: string[]
  /** Extra trailing button in the reaction row (e.g. "more emoji"). */
  reactionTrailing?: { icon: React.ReactNode; label: string; onClick: () => void }
  /** Horizontal anchoring relative to `position.x`. */
  align?: MenuAlign
  minWidth?: number
  className?: string
}

const VIEWPORT_PADDING = 8

// ─── Component ───────────────────────────────────────────────────────────────

export const Menu: React.FC<MenuProps> = ({
  position,
  items,
  onClose,
  reactions,
  onReactionSelect,
  activeReactions,
  reactionTrailing,
  align = "start",
  minWidth,
  className,
}) => {
  const menuRef = useRef<HTMLDivElement>(null)
  const [coords, setCoords] = useState<{ x: number; y: number } | null>(null)
  const [openSubmenu, setOpenSubmenu] = useState<number | null>(null)
  const [submenuUp, setSubmenuUp] = useState(false)

  // Clamp the menu inside the viewport once we know its measured size.
  const reposition = useCallback(() => {
    const element = menuRef.current
    if (!element) return

    const { width, height } = element.getBoundingClientRect()
    let x = align === "end" ? position.x - width : position.x
    let y = position.y

    if (x + width > window.innerWidth - VIEWPORT_PADDING) x = window.innerWidth - width - VIEWPORT_PADDING
    if (x < VIEWPORT_PADDING) x = VIEWPORT_PADDING
    // Flip above the anchor when there is no room below.
    if (y + height > window.innerHeight - VIEWPORT_PADDING) {
      const flipped = position.y - height
      y = flipped >= VIEWPORT_PADDING ? flipped : Math.max(VIEWPORT_PADDING, window.innerHeight - height - VIEWPORT_PADDING)
    }

    setCoords({ x, y })
  }, [align, position.x, position.y])

  useLayoutEffect(() => {
    reposition()
  }, [reposition, items.length])

  useEffect(() => {
    window.addEventListener("resize", reposition)
    window.addEventListener("scroll", reposition, true)
    return () => {
      window.removeEventListener("resize", reposition)
      window.removeEventListener("scroll", reposition, true)
    }
  }, [reposition])

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) onClose()
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation()
        onClose()
      }
    }
    document.addEventListener("mousedown", handlePointerDown)
    document.addEventListener("keydown", handleKeyDown)
    return () => {
      document.removeEventListener("mousedown", handlePointerDown)
      document.removeEventListener("keydown", handleKeyDown)
    }
  }, [onClose])

  const run = (item: MenuItem) => {
    if (item.disabled) return
    item.onClick?.()
    onClose()
  }

  const openSubmenuAt = (index: number, event: React.MouseEvent<HTMLButtonElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    setSubmenuUp(window.innerHeight - rect.top < 220)
    setOpenSubmenu(index)
  }

  return createPortal(
    <div
      ref={menuRef}
      className={cn("amenu", className, { "amenu--measuring": coords === null })}
      style={{ left: coords?.x ?? position.x, top: coords?.y ?? position.y, minWidth }}
      onContextMenu={(event) => event.preventDefault()}
    >
      {reactions && reactions.length > 0 && (
        <>
          <div className="amenu__reactions">
            {reactions.map((emoji) => (
              <button
                key={emoji}
                type="button"
                className={cn("amenu__reaction", { "amenu__reaction--active": activeReactions?.includes(emoji) })}
                onClick={() => {
                  onReactionSelect?.(emoji)
                  onClose()
                }}
              >
                {emoji}
              </button>
            ))}
            {reactionTrailing && (
              <button
                type="button"
                className="amenu__reaction amenu__reaction--action"
                aria-label={reactionTrailing.label}
                title={reactionTrailing.label}
                onClick={() => {
                  reactionTrailing.onClick()
                  onClose()
                }}
              >
                {reactionTrailing.icon}
              </button>
            )}
          </div>
          <div className="amenu__separator" />
        </>
      )}

      {items.map((item, index) => {
        const key = item.id ?? `${item.label ?? "sep"}-${index}`

        if (item.separator) return <div key={key} className="amenu__separator" />
        if (item.header) return <div key={key} className="amenu__header">{item.label}</div>

        if (item.submenu) {
          return (
            <div key={key} className="amenu__row">
              <button
                type="button"
                className={cn("amenu__item", {
                  "amenu__item--danger": item.danger,
                  "amenu__item--disabled": item.disabled,
                  "amenu__item--open": openSubmenu === index,
                })}
                onMouseEnter={(event) => openSubmenuAt(index, event)}
                onClick={(event) => openSubmenuAt(index, event)}
              >
                {item.icon && <span className="amenu__icon">{item.icon}</span>}
                <span className="amenu__label">{item.label}</span>
                <ChevronRight size={14} className="amenu__arrow" />
              </button>

              {openSubmenu === index && (
                <div
                  className={cn("amenu__submenu", { "amenu__submenu--up": submenuUp })}
                  onMouseLeave={() => setOpenSubmenu(null)}
                >
                  {item.submenu.map((subItem, subIndex) => (
                    <button
                      key={subItem.id ?? `${subItem.label}-${subIndex}`}
                      type="button"
                      className={cn("amenu__item", {
                        "amenu__item--danger": subItem.danger,
                        "amenu__item--disabled": subItem.disabled,
                        "amenu__item--active": subItem.active,
                      })}
                      onClick={() => run(subItem)}
                    >
                      {subItem.icon && <span className="amenu__icon">{subItem.icon}</span>}
                      <span className="amenu__label">{subItem.label}</span>
                      {subItem.active && <span className="amenu__check" />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )
        }

        return (
          <button
            key={key}
            type="button"
            className={cn("amenu__item", {
              "amenu__item--danger": item.danger,
              "amenu__item--disabled": item.disabled,
              "amenu__item--active": item.active,
            })}
            onClick={() => run(item)}
          >
            {item.icon && <span className="amenu__icon">{item.icon}</span>}
            <span className="amenu__label">{item.label}</span>
            {item.shortcut && <span className="amenu__shortcut">{item.shortcut}</span>}
            {item.active && <span className="amenu__check" />}
          </button>
        )
      })}
    </div>,
    document.body,
  )
}

export default Menu
