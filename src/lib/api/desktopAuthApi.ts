import { supabaseConfig } from "../supabase"
import type { DesktopAuthFlow } from "../../types/auth"

const STORAGE_KEY = "lxlink-desktop-auth-flow"
const AUTH_URL = import.meta.env.VITE_AUTH_URL || "http://localhost:3002"

interface ClaimResponse {
  pending: boolean
  session?: {
    access_token: string
    refresh_token: string
    expires_at?: number | null
  }
}

const toBase64Url = (bytes: Uint8Array) => {
  let binary = ""
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

const invokePublicFunction = async <T>(name: string, payload: unknown): Promise<T> => {
  const response = await fetch(`${supabaseConfig.url}/functions/v1/${name}`, {
    method: "POST",
    headers: {
      apikey: supabaseConfig.anonKey,
      Authorization: `Bearer ${supabaseConfig.anonKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  })

  if (response.status === 202) return response.json() as Promise<T>
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { error?: string } | null
    throw new Error(body?.error || `Authorization service returned ${response.status}`)
  }
  return response.json() as Promise<T>
}

const load = (): DesktopAuthFlow | null => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const flow = JSON.parse(raw) as DesktopAuthFlow
    if (new Date(flow.expiresAt).getTime() <= Date.now()) {
      localStorage.removeItem(STORAGE_KEY)
      return null
    }
    return flow
  } catch {
    localStorage.removeItem(STORAGE_KEY)
    return null
  }
}

const clear = () => localStorage.removeItem(STORAGE_KEY)

export const desktopAuthApi = {
  load,
  clear,

  start: async (): Promise<{ flow: DesktopAuthFlow; url: string }> => {
    const verifierBytes = crypto.getRandomValues(new Uint8Array(32))
    const verifier = toBase64Url(verifierBytes)
    const digest = new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier)),
    )
    const requestId = crypto.randomUUID()
    const response = await invokePublicFunction<{ expires_at: string }>("desktop-auth-start", {
      request_id: requestId,
      code_challenge: toBase64Url(digest),
    })
    const flow: DesktopAuthFlow = {
      requestId,
      verifier,
      expiresAt: response.expires_at,
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(flow))

    const url = new URL(AUTH_URL)
    url.searchParams.set("desktop_request_id", requestId)
    return { flow, url: url.toString() }
  },

  claim: async (flow: DesktopAuthFlow) => {
    const response = await invokePublicFunction<ClaimResponse>("desktop-auth-claim", {
      request_id: flow.requestId,
      verifier: flow.verifier,
    })
    return response.pending ? null : response.session ?? null
  },
}
