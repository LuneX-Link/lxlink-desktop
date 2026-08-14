import { useMemo, useState } from "react"
import { Layers, ChevronRight, Copy } from "lucide-react"
import cn from "classnames"
import { useDebug } from "../../contexts/debug-context"
import { copyToClipboard, formatDuration, formatTime, safeJson } from "./debug-utils"

export function DebugReduxLog({ query = "" }: { query?: string }) {
	const { reduxLog } = useDebug()
	const [expanded, setExpanded] = useState<number | null>(null)

	const entries = useMemo(() => {
		const q = query.trim().toLowerCase()
		if (!q) return reduxLog
		return reduxLog.filter((e) => e.action.toLowerCase().includes(q))
	}, [reduxLog, query])

	if (reduxLog.length === 0) {
		return (
			<div className="debug-log__empty">
				<Layers size={20} />
				<span>No state changes yet</span>
				<span className="debug-log__empty-hint">connect the debug middleware to see actions</span>
			</div>
		)
	}

	return (
		<div className="debug-redux-log">
			{entries.map((entry) => {
				const isOpen = expanded === entry.id
				return (
					<div key={entry.id} className="debug-redux-log__item">
						<button
							className="debug-redux-log__entry"
							onClick={() => setExpanded(isOpen ? null : entry.id)}
						>
							<ChevronRight
								size={10}
								className={cn("debug-api-log__chevron", {
									"debug-api-log__chevron--open": isOpen,
								})}
							/>
							<span className="debug-redux-log__time">{formatTime(entry.timestamp)}</span>
							<span className="debug-redux-log__action" title={entry.action}>
								{entry.action}
							</span>
							{entry.changedKeys && entry.changedKeys.length > 0 && (
								<span className="debug-redux-log__keys">{entry.changedKeys.length} keys</span>
							)}
							{entry.duration !== undefined && (
								<span className="debug-redux-log__duration">{formatDuration(entry.duration)}</span>
							)}
						</button>

						{isOpen && (
							<div className="debug-details">
								{entry.changedKeys && entry.changedKeys.length > 0 && (
									<div className="debug-details__row">
										<span>Changed</span>
										<code className="debug-details__wrap">{entry.changedKeys.join(", ")}</code>
									</div>
								)}
								<div className="debug-details__block">
									<div className="debug-details__block-head">
										Payload
										<button onClick={() => copyToClipboard(safeJson(entry.payload))}>
											<Copy size={10} />
										</button>
									</div>
									<pre>{safeJson(entry.payload)}</pre>
								</div>
							</div>
						)}
					</div>
				)
			})}
		</div>
	)
}