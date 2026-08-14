import {
	createContext,
	useContext,
	useState,
	useCallback,
	useEffect,
	useRef,
	useMemo,
	type ReactNode,
} from "react"

export type LogLevel = "log" | "info" | "warn" | "error" | "debug"
export type DebugTab = "stats" | "api" | "ws" | "latency" | "redux" | "console" | "renders"

export interface ApiLogEntry {
	id: number
	method: string
	url: string
	status: number | null
	duration: number
	timestamp: number
	size: number | null
	kind: "fetch" | "xhr"
	requestBody?: string
	responseBody?: string
	error?: string
}

export interface ReduxLogEntry {
	id: number
	action: string
	timestamp: number
	duration?: number
	payload?: unknown
	changedKeys?: string[]
}

export interface ConsoleLogEntry {
	id: number
	level: LogLevel
	message: string
	timestamp: number
	count: number
	stack?: string
}

export interface RenderEntry {
	name: string
	count: number
	lastAt: number
	lastDuration: number
	totalDuration: number
}

export interface WebSocketLogEntry {
	id: number
	url: string
	status: "connecting" | "connected" | "disconnected" | "error" | "message"
	timestamp: number
	latency?: number
	messageCount?: number
	error?: string
	metadata?: Record<string, unknown>
}

export interface LatencyEntry {
	id: number
	endpoint: string
	latency: number
	timestamp: number
	status: "success" | "timeout" | "error"
	error?: string
	metadata?: Record<string, unknown>
}

export interface Vitals {
	ttfb: number | null
	fcp: number | null
	lcp: number | null
	cls: number | null
	dcl: number | null
	load: number | null
}

export interface MemoryInfo {
	used: number
	total: number
	limit: number
}

interface DebugContextValue {
	enabled: boolean
	toggle: () => void
	setEnabled: (value: boolean) => void

	paused: boolean
	togglePaused: () => void

	fps: number
	fpsHistory: number[]
	fpsStats: { min: number; avg: number; max: number }
	frameTime: number

	memory: MemoryInfo | null
	memoryHistory: number[]

	longTasks: { count: number; worst: number; totalBlocking: number }
	vitals: Vitals
	uptime: number

	apiLog: ApiLogEntry[]
	addApiLog: (entry: Omit<ApiLogEntry, "id" | "timestamp">) => void
	clearApiLog: () => void

	reduxLog: ReduxLogEntry[]
	addReduxLog: (entry: Omit<ReduxLogEntry, "id" | "timestamp">) => void
	clearReduxLog: () => void

	consoleLog: ConsoleLogEntry[]
	clearConsoleLog: () => void

	renders: RenderEntry[]
	trackRender: (name: string, duration: number) => void
	clearRenders: () => void

	wsLog: WebSocketLogEntry[]
	addWebSocketLog: (entry: Omit<WebSocketLogEntry, "id" | "timestamp">) => void
	clearWsLog: () => void

	latencyLog: LatencyEntry[]
	addLatencyEntry: (entry: Omit<LatencyEntry, "id" | "timestamp">) => void
	clearLatencyLog: () => void

	clearAll: () => void
	exportSnapshot: () => string

	activeTab: DebugTab
	setActiveTab: (tab: DebugTab) => void
}

const DebugContext = createContext<DebugContextValue | null>(null)

const MAX_LOG_ENTRIES = 300
const MAX_HISTORY = 60
const DEBUG_STORAGE_KEY = "astrolune_debug_enabled"
const DEBUG_TAB_KEY = "astrolune_debug_tab"

function readBool(key: string, fallback = false): boolean {
	try {
		const raw = localStorage.getItem(key)
		return raw === null ? fallback : raw === "true"
	} catch {
		return fallback
	}
}

export function DebugProvider({ children }: { children: ReactNode }) {
	const [enabled, setEnabled] = useState(() => readBool(DEBUG_STORAGE_KEY))
	const [paused, setPaused] = useState(false)
	const [activeTab, setActiveTab] = useState<DebugTab>(() => {
		try {
			return (localStorage.getItem(DEBUG_TAB_KEY) as DebugTab) || "stats"
		} catch {
			return "stats"
		}
	})

	const [fps, setFps] = useState(0)
	const [fpsHistory, setFpsHistory] = useState<number[]>([])
	const [frameTime, setFrameTime] = useState(0)
	const [memory, setMemory] = useState<MemoryInfo | null>(null)
	const [memoryHistory, setMemoryHistory] = useState<number[]>([])
	const [longTasks, setLongTasks] = useState({ count: 0, worst: 0, totalBlocking: 0 })
	const [vitals, setVitals] = useState<Vitals>({
		ttfb: null,
		fcp: null,
		lcp: null,
		cls: null,
		dcl: null,
		load: null,
	})
	const [uptime, setUptime] = useState(0)

	const [apiLog, setApiLog] = useState<ApiLogEntry[]>([])
	const [reduxLog, setReduxLog] = useState<ReduxLogEntry[]>([])
	const [consoleLog, setConsoleLog] = useState<ConsoleLogEntry[]>([])
	const [renders, setRenders] = useState<RenderEntry[]>([])
	const [wsLog, setWsLog] = useState<WebSocketLogEntry[]>([])
	const [latencyLog, setLatencyLog] = useState<LatencyEntry[]>([])

	const idRef = useRef(0)
	const nextId = useCallback(() => {
		idRef.current += 1
		return idRef.current
	}, [])

	const pausedRef = useRef(paused)
	pausedRef.current = paused

	const frameCountRef = useRef(0)
	const lastFpsTimeRef = useRef(performance.now())

	const toggle = useCallback(() => setEnabled((prev) => !prev), [])
	const togglePaused = useCallback(() => setPaused((prev) => !prev), [])

	/* ---------------- log writers ---------------- */

	const addApiLog = useCallback(
		(entry: Omit<ApiLogEntry, "id" | "timestamp">) => {
			if (pausedRef.current) return
			const newEntry: ApiLogEntry = { ...entry, id: nextId(), timestamp: Date.now() }
			setApiLog((prev) => [newEntry, ...prev].slice(0, MAX_LOG_ENTRIES))
		},
		[nextId],
	)

	const addReduxLog = useCallback(
		(entry: Omit<ReduxLogEntry, "id" | "timestamp">) => {
			if (pausedRef.current) return
			const newEntry: ReduxLogEntry = { ...entry, id: nextId(), timestamp: Date.now() }
			setReduxLog((prev) => [newEntry, ...prev].slice(0, MAX_LOG_ENTRIES))
		},
		[nextId],
	)

	const addWebSocketLog = useCallback(
		(entry: Omit<WebSocketLogEntry, "id" | "timestamp">) => {
			if (pausedRef.current) return
			const newEntry: WebSocketLogEntry = { ...entry, id: nextId(), timestamp: Date.now() }
			setWsLog((prev) => [newEntry, ...prev].slice(0, MAX_LOG_ENTRIES))
		},
		[nextId],
	)

	const addLatencyEntry = useCallback(
		(entry: Omit<LatencyEntry, "id" | "timestamp">) => {
			if (pausedRef.current) return
			const newEntry: LatencyEntry = { ...entry, id: nextId(), timestamp: Date.now() }
			setLatencyLog((prev) => [newEntry, ...prev].slice(0, MAX_LOG_ENTRIES))
		},
		[nextId],
	)

	const trackRender = useCallback((name: string, duration: number) => {
		if (pausedRef.current) return
		setRenders((prev) => {
			const idx = prev.findIndex((r) => r.name === name)
			if (idx === -1) {
				return [
					...prev,
					{ name, count: 1, lastAt: Date.now(), lastDuration: duration, totalDuration: duration },
				]
			}
			const next = [...prev]
			const cur = next[idx]
			next[idx] = {
				...cur,
				count: cur.count + 1,
				lastAt: Date.now(),
				lastDuration: duration,
				totalDuration: cur.totalDuration + duration,
			}
			return next
		})
	}, [])

	const clearApiLog = useCallback(() => setApiLog([]), [])
	const clearReduxLog = useCallback(() => setReduxLog([]), [])
	const clearConsoleLog = useCallback(() => setConsoleLog([]), [])
	const clearRenders = useCallback(() => setRenders([]), [])
	const clearWsLog = useCallback(() => setWsLog([]), [])
	const clearLatencyLog = useCallback(() => setLatencyLog([]), [])
	const clearAll = useCallback(() => {
		setApiLog([])
		setReduxLog([])
		setConsoleLog([])
		setRenders([])
		setWsLog([])
		setLatencyLog([])
	}, [])

	/* ---------------- persistence ---------------- */

	useEffect(() => {
		try {
			localStorage.setItem(DEBUG_STORAGE_KEY, String(enabled))
		} catch {}
	}, [enabled])

	useEffect(() => {
		try {
			localStorage.setItem(DEBUG_TAB_KEY, activeTab)
		} catch {}
	}, [activeTab])

	/* ---------------- hotkey: Ctrl/Cmd + Shift + D ---------------- */

	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "d") {
				e.preventDefault()
				toggle()
			}
		}
		window.addEventListener("keydown", onKey)
		return () => window.removeEventListener("keydown", onKey)
	}, [toggle])

	/* ---------------- FPS + frame time ---------------- */

	useEffect(() => {
		if (!enabled) return
		let rafId: number
		const measure = () => {
			frameCountRef.current += 1
			const now = performance.now()
			const elapsed = now - lastFpsTimeRef.current
			if (elapsed >= 500) {
				const value = Math.round((frameCountRef.current * 1000) / elapsed)
				setFps(value)
				setFrameTime(elapsed / Math.max(1, frameCountRef.current))
				setFpsHistory((prev) => [...prev, value].slice(-MAX_HISTORY))
				frameCountRef.current = 0
				lastFpsTimeRef.current = now
			}
			rafId = requestAnimationFrame(measure)
		}
		rafId = requestAnimationFrame(measure)
		return () => cancelAnimationFrame(rafId)
	}, [enabled])

	/* ---------------- memory ---------------- */

	useEffect(() => {
		if (!enabled) return
		const updateMemory = () => {
			const perf = (
				performance as unknown as {
					memory?: { usedJSHeapSize: number; totalJSHeapSize: number; jsHeapSizeLimit: number }
				}
			).memory
			if (!perf) return
			const used = Math.round(perf.usedJSHeapSize / 1048576)
			setMemory({
				used,
				total: Math.round(perf.totalJSHeapSize / 1048576),
				limit: Math.round(perf.jsHeapSizeLimit / 1048576),
			})
			setMemoryHistory((prev) => [...prev, used].slice(-MAX_HISTORY))
		}
		updateMemory()
		const interval = setInterval(updateMemory, 1500)
		return () => clearInterval(interval)
	}, [enabled])

	/* ---------------- uptime ---------------- */

	useEffect(() => {
		if (!enabled) return
		const tick = () => setUptime(Math.round(performance.now() / 1000))
		tick()
		const interval = setInterval(tick, 1000)
		return () => clearInterval(interval)
	}, [enabled])

	/* ---------------- long tasks + web vitals ---------------- */

	useEffect(() => {
		if (!enabled || typeof PerformanceObserver === "undefined") return
		const observers: PerformanceObserver[] = []

		const observe = (type: string, cb: (list: PerformanceObserverEntryList) => void) => {
			try {
				const po = new PerformanceObserver(cb)
				po.observe({ type, buffered: true } as PerformanceObserverInit)
				observers.push(po)
			} catch {}
		}

		observe("longtask", (list) => {
			const entries = list.getEntries()
			setLongTasks((prev) => {
				let { count, worst, totalBlocking } = prev
				for (const e of entries) {
					count += 1
					worst = Math.max(worst, e.duration)
					totalBlocking += Math.max(0, e.duration - 50)
				}
				return { count, worst: Math.round(worst), totalBlocking: Math.round(totalBlocking) }
			})
		})

		observe("paint", (list) => {
			for (const e of list.getEntries()) {
				if (e.name === "first-contentful-paint") {
					setVitals((v) => ({ ...v, fcp: Math.round(e.startTime) }))
				}
			}
		})

		observe("largest-contentful-paint", (list) => {
			const entries = list.getEntries()
			const last = entries[entries.length - 1]
			if (last) setVitals((v) => ({ ...v, lcp: Math.round(last.startTime) }))
		})

		observe("layout-shift", (list) => {
			let delta = 0
			for (const e of list.getEntries() as unknown as Array<{ value: number; hadRecentInput: boolean }>) {
				if (!e.hadRecentInput) delta += e.value
			}
			if (delta > 0) setVitals((v) => ({ ...v, cls: Number(((v.cls ?? 0) + delta).toFixed(4)) }))
		})

		const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined
		if (nav) {
			setVitals((v) => ({
				...v,
				ttfb: Math.round(nav.responseStart),
				dcl: Math.round(nav.domContentLoadedEventEnd),
				load: nav.loadEventEnd ? Math.round(nav.loadEventEnd) : v.load,
			}))
		}

		return () => observers.forEach((po) => po.disconnect())
	}, [enabled])

	/* ---------------- console + error capture ---------------- */

	useEffect(() => {
		if (!enabled) return

		const push = (level: LogLevel, message: string, stack?: string) => {
			if (pausedRef.current) return
			setConsoleLog((prev) => {
				const head = prev[0]
				if (head && head.level === level && head.message === message) {
					const next = [...prev]
					next[0] = { ...head, count: head.count + 1, timestamp: Date.now() }
					return next
				}
				return [
					{ id: nextId(), level, message, stack, timestamp: Date.now(), count: 1 },
					...prev,
				].slice(0, MAX_LOG_ENTRIES)
			})
		}

		const serialize = (args: unknown[]) =>
			args
				.map((a) => {
					if (typeof a === "string") return a
					if (a instanceof Error) return `${a.name}: ${a.message}`
					try {
						return JSON.stringify(a)
					} catch {
						return String(a)
					}
				})
				.join(" ")
				.slice(0, 2000)

		const levels: LogLevel[] = ["log", "info", "warn", "error", "debug"]
		const originals = new Map<LogLevel, (...args: unknown[]) => void>()

		levels.forEach((level) => {
			const original = console[level] as (...args: unknown[]) => void
			originals.set(level, original)
			console[level] = ((...args: unknown[]) => {
				push(level, serialize(args))
				original.apply(console, args)
			}) as typeof console.log
		})

		const onError = (e: ErrorEvent) =>
			push("error", `${e.message} (${e.filename}:${e.lineno}:${e.colno})`, e.error?.stack)
		const onRejection = (e: PromiseRejectionEvent) =>
			push("error", `Unhandled rejection: ${String(e.reason)}`, (e.reason as Error)?.stack)

		window.addEventListener("error", onError)
		window.addEventListener("unhandledrejection", onRejection)

		return () => {
			levels.forEach((level) => {
				const original = originals.get(level)
				if (original) console[level] = original as typeof console.log
			})
			window.removeEventListener("error", onError)
			window.removeEventListener("unhandledrejection", onRejection)
		}
	}, [enabled, nextId])

	/* ---------------- network capture (fetch + XHR) ---------------- */

	useEffect(() => {
    if (!enabled) return

    const proto = XMLHttpRequest.prototype
    const originalOpen = proto.open
    const originalSend = proto.send

    type Meta = { __method: string; __url: string; __start: number; __body?: string }

    proto.open = function (this: XMLHttpRequest & Meta, method: string, url: string | URL) {
      this.__method = method.toUpperCase()
      this.__url = String(url)
      return originalOpen.apply(this, arguments as unknown as Parameters<typeof originalOpen>)
    } as typeof proto.open

    proto.send = function (this: XMLHttpRequest & Meta, body?: Document | XMLHttpRequestBodyInit | null) {
      this.__start = performance.now()
      this.__body = typeof body === "string" ? body.slice(0, 2000) : undefined
      this.addEventListener("loadend", () => {
        addApiLog({
          method: this.__method,
          url: this.__url,
          status: this.status || null,
          duration: performance.now() - this.__start,
          size: Number(this.getResponseHeader("content-length")) || null,
          kind: "xhr",
          requestBody: this.__body,
          responseBody: typeof this.responseText === "string" ? this.responseText.slice(0, 4000) : undefined,
          error: this.status === 0 ? "Network error / aborted" : undefined,
        })
      })
      return originalSend.call(this, body)
    } as typeof proto.send

    return () => {
      proto.open = originalOpen
      proto.send = originalSend
    }
  }, [enabled, addApiLog])

	/* ---------------- derived ---------------- */

	const fpsStats = useMemo(() => {
		if (fpsHistory.length === 0) return { min: 0, avg: 0, max: 0 }
		const min = Math.min(...fpsHistory)
		const max = Math.max(...fpsHistory)
		const avg = Math.round(fpsHistory.reduce((a, b) => a + b, 0) / fpsHistory.length)
		return { min, avg, max }
	}, [fpsHistory])

	const exportSnapshot = useCallback(() => {
		return JSON.stringify(
			{
				capturedAt: new Date().toISOString(),
				url: window.location.href,
				userAgent: navigator.userAgent,
				perf: { fps, fpsStats, frameTime, memory, longTasks, vitals, uptime },
				apiLog,
				reduxLog,
				consoleLog,
				renders,
			},
			null,
			2,
		)
	}, [fps, fpsStats, frameTime, memory, longTasks, vitals, uptime, apiLog, reduxLog, consoleLog, renders])

	const value: DebugContextValue = {
		enabled,
		toggle,
		setEnabled,
		paused,
		togglePaused,
		fps,
		fpsHistory,
		fpsStats,
		frameTime,
		memory,
		memoryHistory,
		longTasks,
		vitals,
		uptime,
		apiLog,
		addApiLog,
		clearApiLog,
		reduxLog,
		addReduxLog,
		clearReduxLog,
		consoleLog,
		clearConsoleLog,
		renders,
		trackRender,
		clearRenders,
		wsLog,
		addWebSocketLog,
		clearWsLog,
		latencyLog,
		addLatencyEntry,
		clearLatencyLog,
		clearAll,
		exportSnapshot,
		activeTab,
		setActiveTab,
	}

	return <DebugContext.Provider value={value}>{children}</DebugContext.Provider>
}

export function useDebug(): DebugContextValue {
	const ctx = useContext(DebugContext)
	if (!ctx) throw new Error("useDebug must be used within DebugProvider")
	return ctx
}

/** Считает рендеры компонента во вкладке "Renders". */
export function useRenderTracker(name: string) {
	const { trackRender, enabled } = useDebug()
	const startRef = useRef(0)
	startRef.current = performance.now()
	useEffect(() => {
		if (enabled) trackRender(name, performance.now() - startRef.current)
	})
}
