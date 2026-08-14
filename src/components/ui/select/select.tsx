"use client"

import type React from "react"
import { useEffect, useLayoutEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { Check, ChevronDown } from "lucide-react"
import cn from "classnames"
import "./select.scss"

export interface SelectOption<T extends string = string> {
  value: T
  label: string
  /** Optional leading visual — an icon, or an avatar for people pickers. */
  leading?: React.ReactNode
  /** Secondary line under the label. */
  hint?: string
  disabled?: boolean
}

export interface SelectProps<T extends string = string> {
  value: T
  options: SelectOption<T>[]
  onChange: (value: T) => void
  placeholder?: string
  /** Leading icon inside the trigger. */
  icon?: React.ReactNode
  /** Renders leading visuals in the trigger too (used by the author picker). */
  showLeadingInTrigger?: boolean
  disabled?: boolean
  className?: string
  ariaLabel?: string
}

const VIEWPORT_PADDING = 8
const MAX_MENU_HEIGHT = 260

export function Select<T extends string = string>({
  value,
  options,
  onChange,
  placeholder = "Выберите",
  icon,
  showLeadingInTrigger = false,
  disabled,
  className,
  ariaLabel,
}: SelectProps<T>) {
  const [isOpen, setIsOpen] = useState(false)
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties | null>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  const selected = options.find((option) => option.value === value)

  useLayoutEffect(() => {
    if (!isOpen || !triggerRef.current) return
    const rect = triggerRef.current.getBoundingClientRect()
    const spaceBelow = window.innerHeight - rect.bottom - VIEWPORT_PADDING
    const spaceAbove = rect.top - VIEWPORT_PADDING
    const dropUp = spaceBelow < Math.min(MAX_MENU_HEIGHT, 160) && spaceAbove > spaceBelow

    setMenuStyle({
      left: rect.left,
      width: rect.width,
      maxHeight: Math.min(MAX_MENU_HEIGHT, dropUp ? spaceAbove : spaceBelow),
      ...(dropUp ? { bottom: window.innerHeight - rect.top + 5 } : { top: rect.bottom + 5 }),
    })
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node
      if (menuRef.current?.contains(target) || triggerRef.current?.contains(target)) return
      setIsOpen(false)
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation()
        setIsOpen(false)
      }
    }
    const handleReflow = () => setIsOpen(false)

    document.addEventListener("mousedown", handlePointerDown)
    document.addEventListener("keydown", handleKeyDown)
    window.addEventListener("resize", handleReflow)
    window.addEventListener("scroll", handleReflow, true)
    return () => {
      document.removeEventListener("mousedown", handlePointerDown)
      document.removeEventListener("keydown", handleKeyDown)
      window.removeEventListener("resize", handleReflow)
      window.removeEventListener("scroll", handleReflow, true)
    }
  }, [isOpen])

  return (
    <div className={cn("aselect", className)}>
      <button
        ref={triggerRef}
        type="button"
        aria-label={ariaLabel}
        aria-expanded={isOpen}
        className={cn("aselect__trigger", { "aselect__trigger--open": isOpen })}
        disabled={disabled}
        onClick={() => setIsOpen((open) => !open)}
      >
        {icon && <span className="aselect__trigger-icon">{icon}</span>}
        {showLeadingInTrigger && selected?.leading && (
          <span className="aselect__trigger-leading">{selected.leading}</span>
        )}
        <span className={cn("aselect__value", { "aselect__value--placeholder": !selected })}>
          {selected?.label ?? placeholder}
        </span>
        <ChevronDown size={14} className={cn("aselect__chevron", { "aselect__chevron--open": isOpen })} />
      </button>

      {isOpen &&
        menuStyle &&
        createPortal(
          <div ref={menuRef} className="aselect__menu" style={menuStyle}>
            {options.map((option) => (
              <button
                key={option.value}
                type="button"
                disabled={option.disabled}
                className={cn("aselect__option", {
                  "aselect__option--active": option.value === value,
                  "aselect__option--disabled": option.disabled,
                })}
                onClick={() => {
                  onChange(option.value)
                  setIsOpen(false)
                }}
              >
                {option.leading && <span className="aselect__option-leading">{option.leading}</span>}
                <span className="aselect__option-copy">
                  <span className="aselect__option-label">{option.label}</span>
                  {option.hint && <span className="aselect__option-hint">{option.hint}</span>}
                </span>
                {option.value === value && <Check size={13} className="aselect__option-check" />}
              </button>
            ))}
          </div>,
          document.body,
        )}
    </div>
  )
}

export default Select
