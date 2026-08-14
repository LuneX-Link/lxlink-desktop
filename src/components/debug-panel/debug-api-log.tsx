import { useMemo, useState } from "react"
import { Globe, ChevronRight, Copy } from "lucide-react"
import cn from "classnames"
import { useDebug } from "../../contexts/debug-context"
import {
	copyToClipboard,
	formatBytes,
	formatDuration,
	formatTime,
	getMethodClass,
	getStatusClass,
	shortUrl,
} from "./debug-utils"

const FILTERS = ["all", "errors", "slow"] as const
type Filter = (typeof FILTERS)[number]

export function DebugApiLog({ query = "" }: { query?: string }) {
	const { apiLog } = useDebug()
	const [filter, setFilter] = useState<Filter>("all")
	const [expanded, setExpanded] = useState<number | null>(null)

	const maxDuration = useMemo(
		() => Math.max(1, ...apiLog.map((e) => e.duration)),
		[apiLog],
	)

	const entries = useMemo(() => {
		const q = query.trim().toLowerCase()
		return apiLog.filter((e) => {
			if (filter === "errors" && !(e.status === null || e.status >= 400)) return false
			if (filter === "slow" && e.duration < 500) return false
			if (q && !`${e.method} ${e.url} ${e.status ?? ""}`.toLowerCase().includes(q)) return false
			return true
		})
	}, [apiLog, filter, query])

	if (apiLog.length === 0) {
		return (
			<div className="debug-log__empty">
				<Globe size={20} />
				<span>No API calls yet</span>
				<span className="debug-log__empty-hint">fetch and XHR are captured automatically</span>
			</div>
		)
	}

	return (
		<div className="debug-api-log">
			<div className="debug-chips">
				{FILTERS.map((f) => (
					<button
						key={f}
						className={cn("debug-chip", { "debug-chip--active": filter === f })}
						onClick={() => setFilter(f)}
					>
						{f}
					</button>
				))}
				<span className="debug-chips__count">{entries.length} shown</span>
			</div>

			{entries.map((entry) => {
				const isOpen = expanded === entry.id
				return (
					<div key={entry.id} className={cn("debug-api-log__item", { "debug-api-log__item--open": isOpen })}>
						<button
							className="debug-api-log__entry"
							onClick={() => setExpanded(isOpen ? null : entry.id)}
						>
							<ChevronRight
								size={10}
								className={cn("debug-api-log__chevron", {
									"debug-api-log__chevron--open": isOpen,
								})}
							/>
							<span
								className={cn(
									"debug-api-log__method",
									`debug-api-log__method--${getMethodClass(entry.method)}`,
								)}
							>
								{entry.method}
							</span>
							<span className="debug-api-log__url" title={entry.url}>
								{shortUrl(entry.url)}
							</span>
							<span
								className={cn(
									"debug-api-log__status",
									`debug-api-log__status--${getStatusClass(entry.status)}`,
								)}
							>
								{entry.status ?? "ERR"}
							</span>
							<span className="debug-api-log__size">{formatBytes(entry.size)}</span>
							<span className="debug-api-log__duration">{formatDuration(entry.duration)}</span>
						</button>

						<div className="debug-api-log__bar">
							<div
								className={cn(
									"debug-api-log__bar-fill",
									`debug-api-log__bar-fill--${getStatusClass(entry.status)}`,
								)}
								style={{ width: `${Math.max(2, (entry.duration / maxDuration) * 100)}%` }}
							/>
						</div>

						{isOpen && (
							<div className="debug-details">
								<div className="debug-details__row">
									<span>Time</span>
									<code>{formatTime(entry.timestamp)}</code>
								</div>
								<div className="debug-details__row">
									<span>Source</span>
									<code>{entry.kind}</code>
								</div>
								<div className="debug-details__row">
									<span>URL</span>
									<code className="debug-details__wrap">{entry.url}</code>
								</div>
								{entry.error && (
									<div className="debug-details__row debug-details__row--error">
										<span>Error</span>
										<code>{entry.error}</code>
									</div>
								)}
								{entry.requestBody && (
									<div className="debug-details__block">
										<div className="debug-details__block-head">
											Request
											<button onClick={() => copyToClipboard(entry.requestBody!)}>
												<Copy size={10} />
											</button>
										</div>
										<pre>{entry.requestBody}</pre>
									</div>
								)}
								{entry.responseBody && (
									<div className="debug-details__block">
										<div className="debug-details__block-head">
											Response
											<button onClick={() => copyToClipboard(entry.responseBody!)}>
												<Copy size={10} />
											</button>
										</div>
										<pre>{entry.responseBody}</pre>
									</div>
								)}
							</div>
						)}
					</div>
				)
			})}
		</div>
	)
}