import { useMemo, useState } from "react"
import { Terminal, Copy } from "lucide-react"
import cn from "classnames"
import { useDebug, type LogLevel } from "../../contexts/debug-context"
import { copyToClipboard, formatTime } from "./debug-utils"

const LEVELS: Array<LogLevel | "all"> = ["all", "log", "info", "warn", "error"]

export function DebugConsoleLog({ query = "" }: { query?: string }) {
	const { consoleLog } = useDebug()
	const [level, setLevel] = useState<LogLevel | "all">("all")
	const [openId, setOpenId] = useState<number | null>(null)

	const entries = useMemo(() => {
		const q = query.trim().toLowerCase()
		return consoleLog.filter((e) => {
			if (level !== "all" && e.level !== level) return false
			if (q && !e.message.toLowerCase().includes(q)) return false
			return true
		})
	}, [consoleLog, level, query])

	if (consoleLog.length === 0) {
		return (
			<div className="debug-log__empty">
				<Terminal size={20} />
				<span>Console is quiet</span>
				<span className="debug-log__empty-hint">logs, warnings and errors appear here</span>
			</div>
		)
	}

	return (
		<div className="debug-console-log">
			<div className="debug-chips">
				{LEVELS.map((l) => (
					<button
						key={l}
						className={cn("debug-chip", `debug-chip--${l}`, { "debug-chip--active": level === l })}
						onClick={() => setLevel(l)}
					>
						{l}
					</button>
				))}
				<span className="debug-chips__count">{entries.length} shown</span>
			</div>

			{entries.map((entry) => (
				<div key={entry.id} className="debug-console-log__item">
					<button
						className={cn("debug-console-log__entry", `debug-console-log__entry--${entry.level}`)}
						onClick={() => setOpenId(openId === entry.id ? null : entry.id)}
					>
						<span className="debug-console-log__time">{formatTime(entry.timestamp)}</span>
						<span className={`debug-console-log__level debug-console-log__level--${entry.level}`}>
							{entry.level}
						</span>
						<span className="debug-console-log__message">{entry.message}</span>
						{entry.count > 1 && <span className="debug-console-log__count">×{entry.count}</span>}
					</button>

					{openId === entry.id && (
						<div className="debug-details">
							<div className="debug-details__block">
								<div className="debug-details__block-head">
									Message
									<button onClick={() => copyToClipboard(`${entry.message}\n${entry.stack ?? ""}`)}>
										<Copy size={10} />
									</button>
								</div>
								<pre>{entry.message}</pre>
							</div>
							{entry.stack && (
								<div className="debug-details__block">
									<div className="debug-details__block-head">Stack</div>
									<pre>{entry.stack}</pre>
								</div>
							)}
						</div>
					)}
				</div>
			))}
		</div>
	)
}