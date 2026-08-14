"use client"

import type React from "react"
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import cn from "classnames"
import "./popover.scss"

export type PopoverAlign = "start" | "center" | "end"

export interface PopoverProps {
  /** The element the popover is anchored to. */
  anchor: HTMLElement | null
  onClose: () => void
  children: React.ReactNode
  /** Horizontal anchoring against the trigger. */
  align?: PopoverAlign
  width?: number
  className?: string
  /** Keeps the popover open when clicking inside this element too. */
  ignoreRef?: React.RefObject<HTMLElement>
}

const VIEWPORT_PADDING = 10
const GAP = 8

export const Popover: React.FC<PopoverProps> = ({
  anchor,
  onClose,
  children,
  align = "center",
  width,
  className,
  ignoreRef,
}) => {
  const popoverRef = useRef<HTMLDivElement>(null)
  const [style, setStyle] = useState<React.CSSProperties | null>(null)

  const place = useCallback(() => {
    const element = popoverRef.current
    if (!element || !anchor) return

    const trigger = anchor.getBoundingClientRect()
    const box = element.getBoundingClientRect()

    let left = trigger.left
    if (align === "center") left = trigger.left + trigger.width / 2 - box.width / 2
    if (align === "end") left = trigger.right - box.width
    left = Math.min(Math.max(left, VIEWPORT_PADDING), window.innerWidth - box.width - VIEWPORT_PADDING)

    const below = trigger.bottom + GAP
    const flip = below + box.height > window.innerHeight - VIEWPORT_PADDING
    const top = flip ? Math.max(VIEWPORT_PADDING, trigger.top - GAP - box.height) : below

    setStyle({ left, top, width })
  }, [align, anchor, width])

  useLayoutEffect(() => {
    place()
  }, [place])

  useEffect(() => {
    window.addEventListener("resize", place)
    window.addEventListener("scroll", place, true)
    return () => {
      window.removeEventListener("resize", place)
      window.removeEventListener("scroll", place, true)
    }
  }, [place])

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node
      if (popoverRef.current?.contains(target)) return
      if (anchor?.contains(target)) return
      if (ignoreRef?.current?.contains(target)) return
      onClose()
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
  }, [anchor, ignoreRef, onClose])

  return createPortal(
    <div
      ref={popoverRef}
      className={cn("apopover", className, { "apopover--measuring": style === null })}
      style={style ?? { left: 0, top: 0, width }}
    >
      {children}
    </div>,
    document.body,
  )
}

export default Popover
