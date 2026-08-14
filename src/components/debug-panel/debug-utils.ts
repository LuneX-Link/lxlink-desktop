export function formatDuration(ms: number): string {
	if (ms < 1) return "<1ms"
	if (ms < 1000) return `${Math.round(ms)}ms`
	return `${(ms / 1000).toFixed(1)}s`
}

export function formatMb(mb: number): string {
	if (mb < 1024) return `${mb} MB`
	return `${(mb / 1024).toFixed(1)} GB`
}

export function formatBytes(bytes: number | null): string {
	if (bytes === null || Number.isNaN(bytes)) return "—"
	if (bytes < 1024) return `${bytes} B`
	if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`
	return `${(bytes / 1048576).toFixed(1)} MB`
}

export function formatTime(timestamp: number): string {
	return new Date(timestamp).toLocaleTimeString("en-US", {
		hour12: false,
		hour: "2-digit",
		minute: "2-digit",
		second: "2-digit",
	})
}

export function formatUptime(seconds: number): string {
	const h = Math.floor(seconds / 3600)
	const m = Math.floor((seconds % 3600) / 60)
	const s = seconds % 60
	if (h > 0) return `${h}h ${m}m`
	if (m > 0) return `${m}m ${s}s`
	return `${s}s`
}

export function shortUrl(url: string): string {
	try {
		const u = new URL(url, window.location.origin)
		return u.pathname + (u.search ? u.search : "")
	} catch {
		return url
	}
}

export function getMethodClass(method: string): string {
	const m = method.toUpperCase()
	if (["GET", "POST", "PUT", "DELETE", "PATCH"].includes(m)) return m.toLowerCase()
	return ""
}

export function getStatusClass(status: number | null): string {
	if (status === null) return "pending"
	if (status >= 200 && status < 300) return "ok"
	if (status >= 300 && status < 400) return "redirect"
	if (status >= 400 && status < 500) return "warn"
	return "error"
}

export function thresholdClass(value: number, warn: number, danger: number): string {
	if (value >= danger) return "danger"
	if (value >= warn) return "warning"
	return "normal"
}

export function copyToClipboard(text: string) {
	navigator.clipboard?.writeText(text).catch(() => {})
}

export function downloadJson(content: string, filename: string) {
	const blob = new Blob([content], { type: "application/json" })
	const a = document.createElement("a")
	a.href = URL.createObjectURL(blob)
	a.download = filename
	a.click()
	URL.revokeObjectURL(a.href)
}

export function safeJson(value: unknown): string {
	try {
		return JSON.stringify(value, null, 2)
	} catch {
		return String(value)
	}
}

export function filterByQuery<T>(items: T[], query?: string, getSearchText?: (item: T) => string): T[] {
	if (!query || !items.length) return items
	const q = query.toLowerCase()
	return items.filter((item) => {
		if (getSearchText) {
			return getSearchText(item).toLowerCase().includes(q)
		}
		return JSON.stringify(item).toLowerCase().includes(q)
	})
}