import { useEffect, useState } from "react"
import {
	Activity,
	Cpu,
	HardDrive,
	Wifi,
	WifiOff,
	Monitor,
	Globe,
	Zap,
	Timer,
	Layers,
	Database,
	Gauge,
	Languages,
} from "lucide-react"
import { useDebug } from "../../contexts/debug-context"
import { Sparkline } from "./sparkline"
import { formatDuration, formatMb, formatUptime, thresholdClass } from "./debug-utils"

function getGPUInfo(): string {
	try {
		const canvas = document.createElement("canvas")
		const gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl")
		if (gl && "getExtension" in gl) {
			const debugInfo = (gl as WebGLRenderingContext).getExtension("WEBGL_debug_renderer_info")
			if (debugInfo) {
				const renderer = (gl as WebGLRenderingContext).getParameter(
					debugInfo.UNMASKED_RENDERER_WEBGL,
				)
				return renderer || "Unknown"
			}
		}
	} catch {}
	return "N/A"
}

function getBrowserInfo(): string {
	const ua = navigator.userAgent
	if (ua.includes("Firefox")) return "Firefox"
	if (ua.includes("Edg")) return "Edge"
	if (ua.includes("OPR") || ua.includes("Opera")) return "Opera"
	if (ua.includes("Chrome")) return "Chrome"
	if (ua.includes("Safari")) return "Safari"
	return "Unknown"
}

function getOSInfo(): string {
	const ua = navigator.userAgent
	if (ua.includes("Android")) return "Android"
	if (/iPhone|iPad|iPod/.test(ua)) return "iOS"
	if (ua.includes("Win")) return "Windows"
	if (ua.includes("Mac")) return "macOS"
	if (ua.includes("Linux")) return "Linux"
	return "Unknown"
}

function localStorageSize(): string {
	try {
		let total = 0
		for (let i = 0; i < localStorage.length; i += 1) {
			const key = localStorage.key(i)
			if (!key) continue
			total += key.length + (localStorage.getItem(key)?.length ?? 0)
		}
		return `${(total / 1024).toFixed(1)} KB`
	} catch {
		return "N/A"
	}
}

function Row({
	icon,
	label,
	children,
}: {
	icon: React.ReactNode
	label: string
	children: React.ReactNode
}) {
	return (
		<div className="debug-stats__row">
			<span className="debug-stats__label">
				{icon}
				{label}
			</span>
			<div className="debug-stats__right">{children}</div>
		</div>
	)
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
	return (
		<div className="debug-stats__section">
			<div className="debug-stats__section-title">{title}</div>
			{children}
		</div>
	)
}

export function DebugStats() {
	const { fps, fpsHistory, fpsStats, frameTime, memory, memoryHistory, longTasks, vitals, uptime, apiLog } =
		useDebug()

	const [gpu, setGpu] = useState("Loading…")
	const [battery, setBattery] = useState<{ level: number; charging: boolean } | null>(null)
	const [storage, setStorage] = useState<string>("N/A")
	const [domNodes, setDomNodes] = useState(0)
	const [viewport, setViewport] = useState({ w: window.innerWidth, h: window.innerHeight })
	const [online, setOnline] = useState(navigator.onLine)

	useEffect(() => {
		setGpu(getGPUInfo())

		const nav = navigator as Navigator & { getBattery?: () => Promise<any> }
		nav.getBattery?.()
			.then((bat: any) => {
				const sync = () => setBattery({ level: bat.level * 100, charging: bat.charging })
				sync()
				bat.addEventListener("levelchange", sync)
				bat.addEventListener("chargingchange", sync)
			})
			.catch(() => {})

		navigator.storage?.estimate?.()
			.then((est) => {
				if (est.usage && est.quota) {
					setStorage(`${formatMb(Math.round(est.usage / 1048576))} / ${formatMb(Math.round(est.quota / 1048576))}`)
				}
			})
			.catch(() => {})

		const tick = () => setDomNodes(document.getElementsByTagName("*").length)
		tick()
		const interval = setInterval(tick, 2000)

		const onResize = () => setViewport({ w: window.innerWidth, h: window.innerHeight })
		const onOnline = () => setOnline(navigator.onLine)
		window.addEventListener("resize", onResize)
		window.addEventListener("online", onOnline)
		window.addEventListener("offline", onOnline)

		return () => {
			clearInterval(interval)
			window.removeEventListener("resize", onResize)
			window.removeEventListener("online", onOnline)
			window.removeEventListener("offline", onOnline)
		}
	}, [])

	const connection = (navigator as Navigator & {
		connection?: { effectiveType?: string; downlink?: number; rtt?: number; saveData?: boolean }
	}).connection

	const avgApi =
		apiLog.length > 0
			? Math.round(apiLog.reduce((acc, e) => acc + e.duration, 0) / apiLog.length)
			: null
	const failedApi = apiLog.filter((e) => e.status === null || e.status >= 400).length

	const fpsClass = fps >= 55 ? "normal" : fps >= 30 ? "warning" : "danger"
	const memClass = memory ? thresholdClass(memory.used / memory.limit, 0.6, 0.85) : "normal"

	return (
		<div className="debug-stats">
			<Section title="Performance">
				<Row icon={<Activity size={12} />} label="FPS">
					<Sparkline values={fpsHistory} max={60} color="currentColor" />
					<span className={`debug-stats__value debug-stats__value--${fpsClass}`}>{fps}</span>
				</Row>
				<Row icon={<Gauge size={12} />} label="FPS min / avg / max">
					<span className="debug-stats__value">
						{fpsStats.min} / {fpsStats.avg} / {fpsStats.max}
					</span>
				</Row>
				<Row icon={<Timer size={12} />} label="Frame time">
					<span className="debug-stats__value">{frameTime.toFixed(1)} ms</span>
				</Row>
				<Row icon={<Zap size={12} />} label="Long tasks">
					<span className="debug-stats__value">
						{longTasks.count} · worst {longTasks.worst}ms · blocking {longTasks.totalBlocking}ms
					</span>
				</Row>
			</Section>

			<Section title="Memory">
				<Row icon={<Cpu size={12} />} label="JS heap">
					<Sparkline values={memoryHistory} color="currentColor" />
					<span className={`debug-stats__value debug-stats__value--${memClass}`}>
						{memory ? formatMb(memory.used) : "N/A"}
					</span>
				</Row>
				<Row icon={<HardDrive size={12} />} label="Heap limit">
					<span className="debug-stats__value">{memory ? formatMb(memory.limit) : "N/A"}</span>
				</Row>
				<Row icon={<Layers size={12} />} label="DOM nodes">
					<span className="debug-stats__value">{domNodes}</span>
				</Row>
			</Section>

			<Section title="Web vitals">
				<Row icon={<Timer size={12} />} label="TTFB / FCP">
					<span className="debug-stats__value">
						{vitals.ttfb !== null ? formatDuration(vitals.ttfb) : "—"} /{" "}
						{vitals.fcp !== null ? formatDuration(vitals.fcp) : "—"}
					</span>
				</Row>
				<Row icon={<Timer size={12} />} label="LCP / CLS">
					<span className="debug-stats__value">
						{vitals.lcp !== null ? formatDuration(vitals.lcp) : "—"} / {vitals.cls ?? "—"}
					</span>
				</Row>
				<Row icon={<Timer size={12} />} label="DCL / Load">
					<span className="debug-stats__value">
						{vitals.dcl !== null ? formatDuration(vitals.dcl) : "—"} /{" "}
						{vitals.load !== null ? formatDuration(vitals.load) : "—"}
					</span>
				</Row>
				<Row icon={<Timer size={12} />} label="Uptime">
					<span className="debug-stats__value">{formatUptime(uptime)}</span>
				</Row>
			</Section>

			<Section title="Network">
				<Row icon={online ? <Wifi size={12} /> : <WifiOff size={12} />} label="Status">
					<span className={`debug-stats__value debug-stats__value--${online ? "normal" : "danger"}`}>
						{online ? "Online" : "Offline"}
					</span>
				</Row>
				{connection && (
					<Row icon={<Globe size={12} />} label="Connection">
						<span className="debug-stats__value">
							{connection.effectiveType ?? "?"} · {connection.downlink ?? "?"} Mb/s · rtt{" "}
							{connection.rtt ?? "?"}ms{connection.saveData ? " · saveData" : ""}
						</span>
					</Row>
				)}
				<Row icon={<Globe size={12} />} label="Requests">
					<span className="debug-stats__value">
						{apiLog.length} · avg {avgApi !== null ? `${avgApi}ms` : "—"}
						{failedApi > 0 ? ` · ${failedApi} failed` : ""}
					</span>
				</Row>
			</Section>

			<Section title="Device">
				<Row icon={<Monitor size={12} />} label="Viewport">
					<span className="debug-stats__value">
						{viewport.w}×{viewport.h} ({window.devicePixelRatio}x)
					</span>
				</Row>
				<Row icon={<Cpu size={12} />} label="CPU cores">
					<span className="debug-stats__value">{navigator.hardwareConcurrency ?? "N/A"}</span>
				</Row>
				<Row icon={<Zap size={12} />} label="GPU">
					<span className="debug-stats__value debug-stats__value--truncate" title={gpu}>
						{gpu}
					</span>
				</Row>
				<Row icon={<Globe size={12} />} label="Browser / OS">
					<span className="debug-stats__value">
						{getBrowserInfo()} · {getOSInfo()}
					</span>
				</Row>
				<Row icon={<Languages size={12} />} label="Locale">
					<span className="debug-stats__value">
						{navigator.language} · {Intl.DateTimeFormat().resolvedOptions().timeZone}
					</span>
				</Row>
				{battery && (
					<Row icon={<Zap size={12} />} label="Battery">
						<span className="debug-stats__value">
							{Math.round(battery.level)}% {battery.charging ? "(charging)" : ""}
						</span>
					</Row>
				)}
			</Section>

			<Section title="Storage">
				<Row icon={<Database size={12} />} label="localStorage">
					<span className="debug-stats__value">{localStorageSize()}</span>
				</Row>
				<Row icon={<Database size={12} />} label="Quota used">
					<span className="debug-stats__value">{storage}</span>
				</Row>
			</Section>
		</div>
	)
}