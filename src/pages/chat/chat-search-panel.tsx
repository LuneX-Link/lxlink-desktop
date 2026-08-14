import type React from "react"
import { useMemo, useRef, useState } from "react"
import {
  AtSign,
  CalendarDays,
  FileX2,
  LoaderCircle,
  Paperclip,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react"
import { Avatar } from "../../components/avatar/avatar"
import { Calendar } from "../../components/ui/calendar/calendar"
import { Popover } from "../../components/ui/popover/popover"
import { Select, type SelectOption } from "../../components/ui/select/select"
import { formatDayAndTime, formatShortDate } from "../../lib/format-time"

export type SearchDateFilter =
  | "all"
  | "today"
  | "yesterday"
  | "week"
  | "month"
  | "quarter"
  | "half_year"
  | "year"
  | "custom"

export type SearchFileFilter = "any" | "with" | "without"

export interface SearchAuthorOption {
  id: string
  name: string
  avatar: string | null
}

export interface SearchResultRow {
  id: string
  content: string | null
  createdAt: string
  authorId: string
  authorName: string
  authorAvatar: string | null
  attachmentCount: number
}

interface ChatSearchPanelProps {
  query: string
  onQueryChange: (value: string) => void
  isSearching: boolean
  results: SearchResultRow[]
  authors: SearchAuthorOption[]
  authorFilter: string
  onAuthorFilterChange: (value: string) => void
  dateFilter: SearchDateFilter
  onDateFilterChange: (value: SearchDateFilter) => void
  customDate: string | null
  onCustomDateChange: (value: string | null) => void
  fileFilter: SearchFileFilter
  onFileFilterChange: (value: SearchFileFilter) => void
  onResetFilters: () => void
  onSelectResult: (messageId: string) => void
  onClose: () => void
}

const DATE_OPTIONS: SelectOption<SearchDateFilter>[] = [
  { value: "all", label: "За всё время" },
  { value: "today", label: "Сегодня" },
  { value: "yesterday", label: "Вчера" },
  { value: "week", label: "За последние 7 дней" },
  { value: "month", label: "За месяц" },
  { value: "quarter", label: "За 3 месяца" },
  { value: "half_year", label: "За полгода" },
  { value: "year", label: "За год" },
  { value: "custom", label: "Выбрать дату…", hint: "Календарь" },
]

const FILE_OPTIONS: SelectOption<SearchFileFilter>[] = [
  { value: "any", label: "Файлы: не важно" },
  { value: "with", label: "Только с файлами" },
  { value: "without", label: "Только без файлов" },
]

const pluralResults = (count: number) => {
  const mod10 = count % 10
  const mod100 = count % 100
  if (mod10 === 1 && mod100 !== 11) return "результат"
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "результата"
  return "результатов"
}

export const ChatSearchPanel: React.FC<ChatSearchPanelProps> = ({
  query,
  onQueryChange,
  isSearching,
  results,
  authors,
  authorFilter,
  onAuthorFilterChange,
  dateFilter,
  onDateFilterChange,
  customDate,
  onCustomDateChange,
  fileFilter,
  onFileFilterChange,
  onResetFilters,
  onSelectResult,
  onClose,
}) => {
  const [calendarAnchor, setCalendarAnchor] = useState<HTMLElement | null>(null)
  const calendarButtonRef = useRef<HTMLButtonElement>(null)

  // Author picker rows carry a real avatar next to the nickname.
  const authorOptions = useMemo<SelectOption[]>(
    () => [
      { value: "all", label: "Любой автор", leading: <AtSign size={15} /> },
      ...authors.map((author) => ({
        value: author.id,
        label: author.name,
        leading: <Avatar size={20} src={author.avatar} alt={author.name} />,
      })),
    ],
    [authors],
  )

  const hasFilters =
    authorFilter !== "all" || dateFilter !== "all" || fileFilter !== "any" || Boolean(customDate)

  const dateLabel =
    dateFilter === "custom" && customDate
      ? formatShortDate(customDate)
      : DATE_OPTIONS.find((option) => option.value === dateFilter)?.label ?? "За всё время"

  return (
    <aside className="chat-search-panel">
      <div className="chat-search-panel__header">
        <div>
          <Search size={17} />
          <strong>Поиск по чату</strong>
        </div>
        <button type="button" onClick={onClose} aria-label="Закрыть поиск">
          <X size={17} />
        </button>
      </div>

      <label className="chat-search-panel__input">
        <Search size={16} />
        <input
          autoFocus
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Сообщение, слово или фраза"
        />
        {query && (
          <button type="button" onClick={() => onQueryChange("")} aria-label="Очистить">
            <X size={14} />
          </button>
        )}
      </label>

      <div className="chat-search-panel__filters">
        <div className="chat-search-panel__filters-head">
          <span>
            <SlidersHorizontal size={13} /> Фильтры
          </span>
          {hasFilters && (
            <button type="button" onClick={onResetFilters}>
              Сбросить
            </button>
          )}
        </div>

        <Select
          value={authorFilter}
          options={authorOptions}
          onChange={onAuthorFilterChange}
          showLeadingInTrigger
          ariaLabel="Автор сообщения"
          className="chat-search-panel__select"
        />

        <div className="chat-search-panel__date-row">
          <Select
            value={dateFilter}
            options={DATE_OPTIONS}
            onChange={(value) => {
              onDateFilterChange(value)
              if (value === "custom") setCalendarAnchor(calendarButtonRef.current)
              else onCustomDateChange(null)
            }}
            icon={<CalendarDays size={15} />}
            ariaLabel="Период"
            className="chat-search-panel__select"
          />
          <button
            ref={calendarButtonRef}
            type="button"
            className={`chat-search-panel__calendar-button${customDate ? " is-active" : ""}`}
            title="Выбрать дату в календаре"
            onClick={(event) => setCalendarAnchor(calendarAnchor ? null : event.currentTarget)}
          >
            <CalendarDays size={15} />
          </button>
        </div>

        <Select
          value={fileFilter}
          options={FILE_OPTIONS}
          onChange={onFileFilterChange}
          icon={fileFilter === "without" ? <FileX2 size={15} /> : <Paperclip size={15} />}
          ariaLabel="Вложения"
          className="chat-search-panel__select"
        />

        {hasFilters && (
          <div className="chat-search-panel__active-filters">
            <span className="chat-search-panel__chip">
              <CalendarDays size={12} /> {dateLabel}
            </span>
            {authorFilter !== "all" && (
              <span className="chat-search-panel__chip">
                <AtSign size={12} /> {authors.find((author) => author.id === authorFilter)?.name ?? "Автор"}
              </span>
            )}
            {fileFilter !== "any" && (
              <span className="chat-search-panel__chip">
                {fileFilter === "with" ? <Paperclip size={12} /> : <FileX2 size={12} />}
                {fileFilter === "with" ? "С файлами" : "Без файлов"}
              </span>
            )}
          </div>
        )}
      </div>

      <div className="chat-search-panel__summary">
        {query ? `${results.length} ${pluralResults(results.length)}` : "Введите запрос для поиска"}
      </div>

      <div className="chat-search-panel__results">
        {isSearching && (
          <div className="chat-search-panel__loading">
            <LoaderCircle size={19} /> Ищем сообщения…
          </div>
        )}
        {!isSearching && query && results.length === 0 && (
          <div className="chat-search-panel__empty">
            <Search size={25} />
            <strong>Ничего не найдено</strong>
            <span>Попробуйте изменить запрос или фильтры</span>
          </div>
        )}
        {!isSearching &&
          results.map((result) => (
            <button
              type="button"
              className="chat-search-result"
              key={result.id}
              onClick={() => onSelectResult(result.id)}
            >
              <Avatar size={32} src={result.authorAvatar} alt={result.authorName} />
              <div>
                <span>
                  <strong>{result.authorName}</strong>
                  <time>{formatDayAndTime(result.createdAt)}</time>
                </span>
                <p>{result.content || "Вложение"}</p>
                {result.attachmentCount > 0 && (
                  <small>
                    <Paperclip size={11} /> {result.attachmentCount} файл(а)
                  </small>
                )}
              </div>
            </button>
          ))}
      </div>

      {calendarAnchor && (
        <Popover
          anchor={calendarAnchor}
          align="end"
          onClose={() => setCalendarAnchor(null)}
          className="chat-search-panel__calendar-pop"
        >
          <Calendar
            value={customDate}
            onChange={(value) => {
              onCustomDateChange(value)
              onDateFilterChange(value ? "custom" : "all")
              if (value) setCalendarAnchor(null)
            }}
          />
        </Popover>
      )}
    </aside>
  )
}

export default ChatSearchPanel
