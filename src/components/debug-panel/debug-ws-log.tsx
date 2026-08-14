import { useMemo, useState } from "react"
import { Wifi, ChevronRight, Copy } from "lucide-react"
import cn from "classnames"
import { useDebug } from "../../contexts/debug-context"
import { copyToClipboard, formatTime, safeJson } from "./debug-utils"

interface DebugWsLogProps {
	query?: string
}

export function DebugWsLog({ query }: DebugWsLogProps) {
	const { wsLog } = useDebug()
	const [expanded, setExpanded] = useState<number | null>(null)

	const entries = useMemo(() => {
		const q = query?.trim().toLowerCase()
		if (!q) return wsLog
		return wsLog.filter((e) => e.url.toLowerCase().includes(q))
	}, [wsLog, query])

	if (wsLog.length === 0) {
		return (
			<div className="debug-log__empty">
				<Wifi size={20} />
				<span>No WebSocket events yet</span>
				<span className="debug-log__empty-hint">connect to see WebSocket activity</span>
			</div>
		)
	}

	return (
		<div className="debug-ws-log">
			{entries.map((entry) => {
				const isOpen = expanded === entry.id
				return (
					<div key={entry.id} className="debug-ws-log__item">
						<button
							className="debug-ws-log__entry"
							onClick={() => setExpanded(isOpen ? null : entry.id)}
						>
							<ChevronRight
								size={10}
								className={cn("debug-api-log__chevron", {
									"debug-api-log__chevron--open": isOpen,
								})}
							/>
							<span className="debug-ws-log__time">{formatTime(entry.timestamp)}</span>
							<span className="debug-ws-log__url" title={entry.url}>
								{entry.url}
							</span>
							<span className={`debug-ws-log__status debug-ws-log__status--${entry.status}`}>
								{entry.status}
							</span>
							{entry.latency && (
								<span className="debug-ws-log__latency">{entry.latency}ms</span>
							)}
							{entry.messageCount && (
								<span className="debug-ws-log__messages">{entry.messageCount}</span>
							)}
						</button>

						{isOpen && (
							<div className="debug-details">
								<div className="debug-details__row">
									<span>Status</span>
									<code className={`debug-ws-log__status debug-ws-log__status--${entry.status}`}>
										{entry.status}
									</code>
								</div>
								{entry.latency && (
									<div className="debug-details__row">
										<span>Latency</span>
										<code>{entry.latency}ms</code>
									</div>
								)}
								{entry.messageCount && (
									<div className="debug-details__row">
										<span>Messages</span>
										<code>{entry.messageCount}</code>
									</div>
								)}
								{entry.error && (
									<div className="debug-details__block">
										<div className="debug-details__block-head">
											Error
											<button onClick={() => copyToClipboard(safeJson(entry.error))}>
												<Copy size={10} />
											</button>
										</div>
										<pre>{safeJson(entry.error)}</pre>
									</div>
								)}
								{entry.metadata && (
									<div className="debug-details__block">
										<div className="debug-details__block-head">
											Metadata
											<button onClick={() => copyToClipboard(safeJson(entry.metadata))}>
												<Copy size={10} />
											</button>
										</div>
										<pre>{safeJson(entry.metadata)}</pre>
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
