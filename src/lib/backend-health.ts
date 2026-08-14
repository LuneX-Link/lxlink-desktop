import { supabaseConfig } from "./supabase"

export const BACKEND_HEALTH_TIMEOUT_MS = 5_000

export async function checkBackendHealth(signal?: AbortSignal): Promise<boolean> {
  const controller = signal ? null : new AbortController()
  const timeout = controller
    ? window.setTimeout(() => controller.abort(), BACKEND_HEALTH_TIMEOUT_MS)
    : null

  try {
    const response = await fetch(`${supabaseConfig.url}/auth/v1/health`, {
      method: "GET",
      cache: "no-store",
      signal: signal ?? controller?.signal,
      headers: {
        apikey: supabaseConfig.anonKey,
        Authorization: `Bearer ${supabaseConfig.anonKey}`,
      },
    })
    return response.ok
  } catch {
    return false
  } finally {
    if (timeout !== null) window.clearTimeout(timeout)
  }
}
