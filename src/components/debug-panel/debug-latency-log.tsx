import { useMemo, useState } from "react"
import { Timer, ChevronRight, Copy } from "lucide-react"
import cn from "classnames"
import { useDebug } from "../../contexts/debug-context"
import { copyToClipboard, formatDuration, formatTime, safeJson } from "./debug-utils"

export function DebugLatencyLog({ query = "" }: { query?: string }) {
	const { latencyLog } = useDebug()
	const [expanded, setExpanded] = useState<number | null>(null)

	const entries = useMemo(() => {
		const q = query.trim().toLowerCase()
		if (!q) return latencyLog
		return latencyLog.filter((e) => e.endpoint.toLowerCase().includes(q))
	}, [latencyLog, query])

	if (latencyLog.length === 0) {
		return (
			<div className="debug-log__empty">
				<Timer size={20} />
				<span>No latency data yet</span>
				<span className="debug-log__empty-hint">make API calls to see latency metrics</span>
			</div>
		)
	}

	return (
		<div className="debug-latency-log">
			{entries.map((entry) => {
				const isOpen = expanded === entry.id
				return (
					<div key={entry.id} className="debug-latency-log__item">
						<button
							className="debug-latency-log__entry"
							onClick={() => setExpanded(isOpen ? null : entry.id)}
						>
							<ChevronRight
								size={10}
								className={cn("debug-api-log__chevron", {
									"debug-api-log__chevron--open": isOpen,
								})}
							/>
							<span className="debug-latency-log__time">{formatTime(entry.timestamp)}</span>
							<span className="debug-latency-log__endpoint" title={entry.endpoint}>
								{entry.endpoint}
							</span>
							<span className={`debug-latency-log__latency debug-latency-log__latency--${
								entry.latency > 500 ? "high" : entry.latency > 200 ? "medium" : "low"
							}`}>
								{entry.latency}ms
							</span>
							<span className={`debug-latency-log__status debug-latency-log__status--${entry.status}`}>
								{entry.status}
							</span>
						</button>

						{isOpen && (
							<div className="debug-details">
								<div className="debug-details__row">
									<span>Status</span>
									<code className={`debug-latency-log__status debug-latency-log__status--${entry.status}`}>
										{entry.status}
									</code>
								</div>
								<div className="debug-details__row">
									<span>Latency</span>
									<code>{formatDuration(entry.latency)}</code>
								</div>
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
