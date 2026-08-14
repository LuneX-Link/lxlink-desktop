import { useState, useRef, useCallback, useEffect, useMemo } from "react"
import { createPortal } from "react-dom"
import {
	X,
	GripVertical,
	Activity,
	Globe,
	Layers,
	Cpu,
	Terminal,
	Trash2,
	Search,
	Pause,
	Play,
	Download,
	Copy,
	Maximize2,
	Minimize2,
	CornerDownRight,
	Zap,
	Timer,
} from "lucide-react"
import cn from "classnames"
import { useDebug, type DebugTab } from "../../contexts/debug-context"
import { DebugStats } from "./debug-stats"
import { DebugApiLog } from "./debug-api-log"
import { DebugWsLog } from "./debug-ws-log"
import { DebugLatencyLog } from "./debug-latency-log"
import { DebugReduxLog } from "./debug-redux-log"
import { DebugConsoleLog } from "./debug-console-log"
import { DebugRenders } from "./debug-renders"
import { copyToClipboard, downloadJson, formatDuration } from "./debug-utils"
import "./debug-panel.scss"

const PANEL_MIN_WIDTH = 380
const PANEL_MAX_WIDTH = 900
const PANEL_MIN_HEIGHT = 260
const PANEL_MAX_HEIGHT = 720
const LAYOUT_KEY = "astrolune_debug_layout"

interface TabDef {
	id: DebugTab
	label: string
	icon: React.ReactNode
}

const TABS: TabDef[] = [
	{ id: "stats", label: "Stats", icon: <Activity size={13} /> },
	{ id: "api", label: "Network", icon: <Globe size={13} /> },
	{ id: "ws", label: "WebSocket", icon: <Zap size={13} /> },
	{ id: "latency", label: "Latency", icon: <Timer size={13} /> },
	{ id: "redux", label: "Redux", icon: <Layers size={13} /> },
	{ id: "console", label: "Console", icon: <Terminal size={13} /> },
	{ id: "renders", label: "Renders", icon: <Cpu size={13} /> },
]

interface Layout {
	x: number
	y: number
	width: number
	height: number
}

function loadLayout(): Layout {
	const fallback: Layout = {
		x: Math.max(0, window.innerWidth - 480),
		y: Math.max(0, window.innerHeight - 400),
		width: 440,
		height: 360,
	}
	try {
		const raw = localStorage.getItem(LAYOUT_KEY)
		if (!raw) return fallback
		const parsed = JSON.parse(raw) as Layout
		return {
			x: Math.min(Math.max(0, parsed.x), window.innerWidth - 120),
			y: Math.min(Math.max(0, parsed.y), window.innerHeight - 60),
			width: Math.min(Math.max(PANEL_MIN_WIDTH, parsed.width), PANEL_MAX_WIDTH),
			height: Math.min(Math.max(PANEL_MIN_HEIGHT, parsed.height), PANEL_MAX_HEIGHT),
		}
	} catch {
		return fallback
	}
}

export function DebugPanel() {
	const {
		enabled,
		toggle,
		activeTab,
		setActiveTab,
		paused,
		togglePaused,
		apiLog,
		wsLog,
		latencyLog,
		reduxLog,
		consoleLog,
		renders,
		clearApiLog,
		clearWsLog,
		clearLatencyLog,
		clearReduxLog,
		clearConsoleLog,
		clearRenders,
		clearAll,
		exportSnapshot,
		fps,
		memory,
		longTasks,
	} = useDebug()

	const [isMinimized, setIsMinimized] = useState(false)
	const [layout, setLayout] = useState<Layout>(loadLayout)
	const [isDragging, setIsDragging] = useState(false)
	const [isResizing, setIsResizing] = useState(false)
	const [query, setQuery] = useState("")

	const panelRef = useRef<HTMLDivElement>(null)
	const dragOffset = useRef({ x: 0, y: 0 })
	const resizeStart = useRef({ x: 0, y: 0, w: 0, h: 0 })

	useEffect(() => {
		try {
			localStorage.setItem(LAYOUT_KEY, JSON.stringify(layout))
		} catch {}
	}, [layout])

	const handleDragStart = useCallback(
		(e: React.MouseEvent) => {
			if ((e.target as HTMLElement).closest("button, input")) return
			e.preventDefault()
			setIsDragging(true)
			dragOffset.current = { x: e.clientX - layout.x, y: e.clientY - layout.y }
		},
		[layout.x, layout.y],
	)

	const handleResizeStart = useCallback(
		(e: React.MouseEvent) => {
			e.preventDefault()
			e.stopPropagation()
			setIsResizing(true)
			resizeStart.current = { x: e.clientX, y: e.clientY, w: layout.width, h: layout.height }
		},
		[layout.width, layout.height],
	)

	useEffect(() => {
		if (!isDragging && !isResizing) return

		const handleMouseMove = (e: MouseEvent) => {
			if (isDragging) {
				setLayout((prev) => ({
					...prev,
					x: Math.max(0, Math.min(e.clientX - dragOffset.current.x, window.innerWidth - 120)),
					y: Math.max(0, Math.min(e.clientY - dragOffset.current.y, window.innerHeight - 48)),
				}))
			}
			if (isResizing) {
				const dx = e.clientX - resizeStart.current.x
				const dy = e.clientY - resizeStart.current.y
				setLayout((prev) => ({
					...prev,
					width: Math.max(PANEL_MIN_WIDTH, Math.min(resizeStart.current.w + dx, PANEL_MAX_WIDTH)),
					height: Math.max(PANEL_MIN_HEIGHT, Math.min(resizeStart.current.h + dy, PANEL_MAX_HEIGHT)),
				}))
			}
		}

		const handleMouseUp = () => {
			setIsDragging(false)
			setIsResizing(false)
		}

		window.addEventListener("mousemove", handleMouseMove)
		window.addEventListener("mouseup", handleMouseUp)
		return () => {
			window.removeEventListener("mousemove", handleMouseMove)
			window.removeEventListener("mouseup", handleMouseUp)
		}
	}, [isDragging, isResizing])

	const snapToCorner = useCallback((corner: "tl" | "tr" | "bl" | "br") => {
		setLayout((prev) => {
			const pad = 16
			const x = corner === "tl" || corner === "bl" ? pad : window.innerWidth - prev.width - pad
			const y = corner === "tl" || corner === "tr" ? pad : window.innerHeight - prev.height - pad
			return { ...prev, x: Math.max(0, x), y: Math.max(0, y) }
		})
	}, [])

	const errorCount = useMemo(
		() => consoleLog.filter((e) => e.level === "error").length,
		[consoleLog],
	)
	const failedRequests = useMemo(
		() => apiLog.filter((e) => e.status === null || e.status >= 400).length,
		[apiLog],
	)

	const tabCounts: Record<DebugTab, number> = {
		stats: 0,
		api: apiLog.length,
		ws: wsLog.length,
		latency: latencyLog.length,
		redux: reduxLog.length,
		console: consoleLog.length,
		renders: renders.length,
	}

	const clearCurrent = useCallback(() => {
		if (activeTab === "api") return clearApiLog()
		if (activeTab === "ws") return clearWsLog()
		if (activeTab === "latency") return clearLatencyLog()
		if (activeTab === "redux") return clearReduxLog()
		if (activeTab === "console") return clearConsoleLog()
		if (activeTab === "renders") return clearRenders()
		return clearAll()
	}, [activeTab, clearApiLog, clearWsLog, clearLatencyLog, clearReduxLog, clearConsoleLog, clearRenders, clearAll])

	if (!enabled) return null

	const searchable = activeTab !== "stats"

	return createPortal(
		<div
			ref={panelRef}
			className={cn("debug-panel", {
				"debug-panel--minimized": isMinimized,
				"debug-panel--dragging": isDragging,
				"debug-panel--paused": paused,
			})}
			style={{
				left: layout.x,
				top: layout.y,
				width: isMinimized ? 260 : layout.width,
				height: isMinimized ? 36 : layout.height,
			}}
		>
			{/* Header */}
			<div className="debug-panel__header" onMouseDown={handleDragStart}>
				<div className="debug-panel__title">
					<GripVertical size={12} className="debug-panel__grip" />
					<span className="debug-panel__title-text">Debug</span>
					<span
						className={cn("debug-panel__pulse", {
							"debug-panel__pulse--paused": paused,
						})}
					/>
					{isMinimized && (
						<span className="debug-panel__mini-stats">
							{fps} fps · {memory ? `${memory.used}MB` : "—"}
							{errorCount > 0 ? ` · ${errorCount}✕` : ""}
						</span>
					)}
				</div>

				<div className="debug-panel__header-actions">
					<button
						className="debug-panel__header-btn"
						onClick={togglePaused}
						title={paused ? "Resume capture" : "Pause capture"}
					>
						{paused ? <Play size={12} /> : <Pause size={12} />}
					</button>
					<button
						className="debug-panel__header-btn"
						onClick={() => copyToClipboard(exportSnapshot())}
						title="Copy snapshot as JSON"
					>
						<Copy size={12} />
					</button>
					<button
						className="debug-panel__header-btn"
						onClick={() => downloadJson(exportSnapshot(), `debug-${Date.now()}.json`)}
						title="Download snapshot"
					>
						<Download size={12} />
					</button>
					<button
						className="debug-panel__header-btn"
						onClick={() => setIsMinimized((v) => !v)}
						title={isMinimized ? "Expand" : "Minimize"}
					>
						{isMinimized ? <Maximize2 size={12} /> : <Minimize2 size={12} />}
					</button>
					<button className="debug-panel__header-btn debug-panel__header-btn--close" onClick={toggle} title="Close (Ctrl+Shift+D)">
						<X size={12} />
					</button>
				</div>
			</div>

			{!isMinimized && (
				<>
					{/* Tabs */}
					<div className="debug-panel__tabs">
						{TABS.map((tab) => (
							<button
								key={tab.id}
								className={cn("debug-panel__tab", {
									"debug-panel__tab--active": activeTab === tab.id,
								})}
								onClick={() => setActiveTab(tab.id)}
							>
								{tab.icon}
								<span>{tab.label}</span>
								{tabCounts[tab.id] ? (
									<span
										className={cn("debug-panel__tab-badge", {
											"debug-panel__tab-badge--danger":
												(tab.id === "console" && errorCount > 0) ||
												(tab.id === "api" && failedRequests > 0),
										})}
									>
										{tabCounts[tab.id]}
									</span>
								) : null}
							</button>
						))}
						<div className="debug-panel__tabs-spacer" />
						<button className="debug-panel__clear-btn" onClick={clearCurrent} title="Clear current log">
							<Trash2 size={12} />
						</button>
					</div>

					{/* Toolbar */}
					{searchable && (
						<div className="debug-panel__toolbar">
							<Search size={11} className="debug-panel__search-icon" />
							<input
								className="debug-panel__search"
								placeholder="Filter…"
								value={query}
								onChange={(e) => setQuery(e.target.value)}
							/>
							{query && (
								<button className="debug-panel__search-clear" onClick={() => setQuery("")}>
									<X size={10} />
								</button>
							)}
						</div>
					)}

					{/* Content */}
					<div className="debug-panel__content">
						{activeTab === "stats" && <DebugStats />}
						{activeTab === "api" && <DebugApiLog query={query} />}
						{activeTab === "ws" && <DebugWsLog query={query} />}
						{activeTab === "latency" && <DebugLatencyLog query={query} />}
						{activeTab === "redux" && <DebugReduxLog query={query} />}
						{activeTab === "console" && <DebugConsoleLog query={query} />}
						{activeTab === "renders" && <DebugRenders query={query} />}
					</div>

					{/* Footer */}
					<div className="debug-panel__footer">
						<span className="debug-panel__footer-item">
							<Activity size={10} /> {fps} fps
						</span>
						<span className="debug-panel__footer-item">
							<Cpu size={10} /> {memory ? `${memory.used} MB` : "—"}
						</span>
						<span className="debug-panel__footer-item">
							jank {longTasks.count} · {formatDuration(longTasks.totalBlocking)}
						</span>
						<div className="debug-panel__tabs-spacer" />
						<div className="debug-panel__snap">
							{(["tl", "tr", "bl", "br"] as const).map((c) => (
								<button
									key={c}
									className={`debug-panel__snap-btn debug-panel__snap-btn--${c}`}
									onClick={() => snapToCorner(c)}
									title={`Snap ${c}`}
								/>
							))}
						</div>
					</div>

					{/* Resize handle */}
					<div className="debug-panel__resize" onMouseDown={handleResizeStart}>
						<CornerDownRight size={10} />
					</div>
				</>
			)}
		</div>,
		document.body,
	)
}