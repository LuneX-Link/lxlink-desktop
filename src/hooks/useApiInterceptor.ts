import { useEffect, useRef } from "react"
import { useDebug } from "../contexts/debug-context"

const originalFetch = typeof window !== "undefined" ? window.fetch : null

// Error log buffer for potential user submission
const errorLogBuffer: Array<{ timestamp: number; url: string; method: string; error: string }> = []
const MAX_ERROR_LOG_SIZE = 100

export function getErrorLogs() {
  return [...errorLogBuffer]
}

export function useApiInterceptor() {
  const { addApiLog, enabled } = useDebug()
  const enabledRef = useRef(enabled)
  enabledRef.current = enabled

  useEffect(() => {
    if (!originalFetch) return

    const interceptedFetch: typeof window.fetch = async (...args) => {
      const [input, init] = args
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url
      const method = init?.method ?? "GET"
      const startTime = performance.now()

      try {
        const response = await originalFetch(input, init)
        const duration = performance.now() - startTime

        // Log to debug panel if enabled
        if (enabledRef.current) {
          addApiLog({
            method,
            url: url.replace(/^https?:\/\/[^/]+/, ""),
            status: response.status,
            duration,
            size: null,
            kind: "fetch",
          })
        }

        return response
      } catch (error) {
        const duration = performance.now() - startTime
        const shortUrl = url.replace(/^https?:\/\/[^/]+/, "").split("?")[0]
        const errorMessage = error instanceof Error ? error.message : "Network error"

        // Log to debug panel if enabled
        if (enabledRef.current) {
          addApiLog({
            method,
            url: shortUrl,
            status: null,
            duration,
            size: null,
            kind: "fetch",
            error: errorMessage,
          })
        }

        // Buffer errors for potential user submission (no toast)
        errorLogBuffer.push({
          timestamp: Date.now(),
          url: shortUrl,
          method,
          error: errorMessage,
        })
        if (errorLogBuffer.length > MAX_ERROR_LOG_SIZE) {
          errorLogBuffer.shift()
        }

        // Log to console for debugging (no UI toast)
        console.warn(`[API] ${method} ${shortUrl} failed:`, errorMessage)

        throw error
      }
    }

    window.fetch = interceptedFetch

    return () => {
      window.fetch = originalFetch
    }
  }, [addApiLog])
}
