import type { Middleware } from "@reduxjs/toolkit"

let debugAddReduxLog: ((entry: { action: string; payload?: unknown }) => void) | null = null

export function setDebugReduxLogger(logger: (entry: { action: string; payload?: unknown }) => void) {
  debugAddReduxLog = logger
}

export const debugLoggerMiddleware: Middleware = (_store) => (next) => (action) => {
  if (debugAddReduxLog && typeof action === "object" && action !== null && "type" in action) {
    const act = action as { type: string; payload?: unknown }
    debugAddReduxLog({
      action: act.type,
      payload: act.payload,
    })
  }

  return next(action)
}
