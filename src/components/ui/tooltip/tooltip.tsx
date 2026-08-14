import React, { useState, useRef, useCallback } from "react"
import { createPortal } from "react-dom"
import "./tooltip.scss"

interface TooltipProps {
  content: React.ReactNode
  children: React.ReactElement
  placement?: "top" | "bottom" | "left" | "right"
  delay?: number
}

export const Tooltip: React.FC<TooltipProps> = ({
  content,
  children,
  placement = "bottom",
  delay = 300,
}) => {
  const [visible, setVisible] = useState(false)
  const [coords, setCoords] = useState({ x: 0, y: 0 })
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const triggerRef = useRef<HTMLElement | null>(null)

  const show = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      if (!triggerRef.current) return
      const rect = triggerRef.current.getBoundingClientRect()
      let x = 0
      let y = 0
      const gap = 8

      switch (placement) {
        case "top":
          x = rect.left + rect.width / 2
          y = rect.top - gap
          break
        case "bottom":
          x = rect.left + rect.width / 2
          y = rect.bottom + gap
          break
        case "left":
          x = rect.left - gap
          y = rect.top + rect.height / 2
          break
        case "right":
          x = rect.right + gap
          y = rect.top + rect.height / 2
          break
      }

      setCoords({ x, y })
      setVisible(true)
    }, delay)
  }, [delay, placement])

  const hide = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    setVisible(false)
  }, [])

  const child = children as React.ReactElement<any>

  React.useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
    }
  }, [])

  React.useEffect(() => {
    const checkBackdrop = () => {
      const backdrops = document.querySelectorAll('.backdrop, [class*="backdrop"]')
      if (backdrops.length > 0 && visible) {
        setVisible(false)
      }
    }

    const observer = new MutationObserver(checkBackdrop)
    observer.observe(document.body, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [visible])

  return (
    <>
      {React.cloneElement(child, {
        onMouseEnter: (event: React.MouseEvent<HTMLElement>) => {
          triggerRef.current = event.currentTarget as HTMLElement
          show()
          child.props.onMouseEnter?.(event)
        },
        onMouseLeave: (event: React.MouseEvent<HTMLElement>) => {
          hide()
          child.props.onMouseLeave?.(event)
        },
        onFocus: (event: React.FocusEvent<HTMLElement>) => {
          triggerRef.current = event.currentTarget as HTMLElement
          show()
          child.props.onFocus?.(event)
        },
        onBlur: (event: React.FocusEvent<HTMLElement>) => {
          hide()
          child.props.onBlur?.(event)
        },
      })}
      {visible &&
        createPortal(
          <div className={`tooltip tooltip--${placement}`} style={{ left: coords.x, top: coords.y }}>
            {content}
          </div>,
          document.body,
        )}
    </>
  )
}

export default Tooltip
