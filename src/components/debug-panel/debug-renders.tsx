import { useMemo } from "react"
import { Cpu } from "lucide-react"
import { useDebug } from "../../contexts/debug-context"
import { formatTime } from "./debug-utils"

export function DebugRenders({ query = "" }: { query?: string }) {
	const { renders } = useDebug()

	const rows = useMemo(() => {
		const q = query.trim().toLowerCase()
		return [...renders]
			.filter((r) => !q || r.name.toLowerCase().includes(q))
			.sort((a, b) => b.count - a.count)
	}, [renders, query])

	const max = Math.max(1, ...rows.map((r) => r.count))

	if (renders.length === 0) {
		return (
			<div className="debug-log__empty">
				<Cpu size={20} />
				<span>No tracked components</span>
				<span className="debug-log__empty-hint">add useRenderTracker("Name") inside a component</span>
			</div>
		)
	}

	return (
		<div className="debug-renders">
			{rows.map((r) => (
				<div key={r.name} className="debug-renders__row">
					<span className="debug-renders__name" title={r.name}>
						{r.name}
					</span>
					<div className="debug-renders__bar">
						<div className="debug-renders__bar-fill" style={{ width: `${(r.count / max) * 100}%` }} />
					</div>
					<span className="debug-renders__count">{r.count}</span>
					<span className="debug-renders__meta">
						{r.lastDuration.toFixed(1)}ms · avg {(r.totalDuration / r.count).toFixed(1)}ms
					</span>
					<span className="debug-renders__time">{formatTime(r.lastAt)}</span>
				</div>
			))}
		</div>
	)
}