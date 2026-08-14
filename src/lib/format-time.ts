export const formatRelativeTime = (value: string): string => {
  const date = new Date(value)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return "Just now"
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays === 1) return "Yesterday"
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" })
}

export const formatFullTimestamp = (value: string): string =>
  new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value))

export const formatTimestamp = formatRelativeTime

// ── Chat formatting ──────────────────────────────────────────────────────────
// Messages show a bare clock (`12:12`) and day dividers read
// «Сегодня» / «Вчера» / `12.08.2026`.

const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate())

/** `12:12` — 24-hour clock, no seconds. */
export const formatClockTime = (value: string): string => {
  const date = new Date(value)
  const hours = String(date.getHours()).padStart(2, "0")
  const minutes = String(date.getMinutes()).padStart(2, "0")
  return `${hours}:${minutes}`
}

/** `12.08.2026` */
export const formatShortDate = (value: string | Date): string => {
  const date = typeof value === "string" ? new Date(value) : value
  const day = String(date.getDate()).padStart(2, "0")
  const month = String(date.getMonth() + 1).padStart(2, "0")
  return `${day}.${month}.${date.getFullYear()}`
}

/** «Сегодня» / «Вчера» / `12.08.2026` for message day dividers. */
export const formatDayLabel = (value: string): string => {
  const date = startOfDay(new Date(value))
  const today = startOfDay(new Date())
  const dayMs = 86_400_000
  const diffDays = Math.round((today.getTime() - date.getTime()) / dayMs)

  if (diffDays === 0) return "Сегодня"
  if (diffDays === 1) return "Вчера"
  return formatShortDate(date)
}

/** Day label plus clock, used for tooltips: «Сегодня в 12:12». */
export const formatDayAndTime = (value: string): string =>
  `${formatDayLabel(value)} в ${formatClockTime(value)}`
