"use client"

import type React from "react"
import { useMemo, useState } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import cn from "classnames"
import "./calendar.scss"

export interface CalendarProps {
  /** Selected day, ISO `YYYY-MM-DD` or null. */
  value?: string | null
  onChange: (value: string | null) => void
  /** Nothing after this day can be picked (defaults to today). */
  maxDate?: Date
  minDate?: Date
  className?: string
}

const WEEKDAYS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"]
const MONTHS = [
  "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
  "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь",
]

const toKey = (date: Date) => {
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${date.getFullYear()}-${month}-${day}`
}

const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate())

/** Monday-first offset for the 1st of the month. */
const leadingBlanks = (year: number, month: number) => (new Date(year, month, 1).getDay() + 6) % 7

export const Calendar: React.FC<CalendarProps> = ({ value, onChange, maxDate, minDate, className }) => {
  const selected = value ? new Date(`${value}T00:00:00`) : null
  const today = startOfDay(new Date())
  const max = maxDate ? startOfDay(maxDate) : today
  const min = minDate ? startOfDay(minDate) : null

  const [cursor, setCursor] = useState(() => {
    const base = selected ?? today
    return { year: base.getFullYear(), month: base.getMonth() }
  })

  const days = useMemo(() => {
    const total = new Date(cursor.year, cursor.month + 1, 0).getDate()
    const blanks = leadingBlanks(cursor.year, cursor.month)
    const cells: Array<Date | null> = Array.from({ length: blanks }, () => null)
    for (let day = 1; day <= total; day += 1) cells.push(new Date(cursor.year, cursor.month, day))
    while (cells.length % 7 !== 0) cells.push(null)
    return cells
  }, [cursor.month, cursor.year])

  const shiftMonth = (delta: number) => {
    setCursor((current) => {
      const next = new Date(current.year, current.month + delta, 1)
      return { year: next.getFullYear(), month: next.getMonth() }
    })
  }

  const isDisabled = (date: Date) => date > max || (min !== null && date < min)

  const canGoBack = min === null || new Date(cursor.year, cursor.month, 1) > min
  const canGoForward = new Date(cursor.year, cursor.month + 1, 1) <= max

  return (
    <div className={cn("acal", className)}>
      <div className="acal__head">
        <button
          type="button"
          className="acal__nav"
          aria-label="Предыдущий месяц"
          disabled={!canGoBack}
          onClick={() => shiftMonth(-1)}
        >
          <ChevronLeft size={15} />
        </button>
        <span className="acal__title">
          {MONTHS[cursor.month]} <span className="acal__year">{cursor.year}</span>
        </span>
        <button
          type="button"
          className="acal__nav"
          aria-label="Следующий месяц"
          disabled={!canGoForward}
          onClick={() => shiftMonth(1)}
        >
          <ChevronRight size={15} />
        </button>
      </div>

      <div className="acal__weekdays">
        {WEEKDAYS.map((weekday) => (
          <span key={weekday} className="acal__weekday">{weekday}</span>
        ))}
      </div>

      <div className="acal__grid">
        {days.map((date, index) => {
          if (!date) return <span key={`blank-${index}`} className="acal__cell acal__cell--blank" />

          const key = toKey(date)
          const disabled = isDisabled(date)

          return (
            <button
              key={key}
              type="button"
              disabled={disabled}
              className={cn("acal__cell", {
                "acal__cell--today": date.getTime() === today.getTime(),
                "acal__cell--selected": value === key,
                "acal__cell--disabled": disabled,
              })}
              onClick={() => onChange(value === key ? null : key)}
            >
              {date.getDate()}
            </button>
          )
        })}
      </div>

      <div className="acal__foot">
        <button type="button" className="acal__action" onClick={() => onChange(toKey(today))}>
          Сегодня
        </button>
        <button
          type="button"
          className="acal__action acal__action--muted"
          disabled={!value}
          onClick={() => onChange(null)}
        >
          Сбросить
        </button>
      </div>
    </div>
  )
}

export default Calendar
