import { supabase } from "../supabase"

export function createReq(baseUrl: string) {
  const normalize = (url: string) => url.replace(/\/+$/, "")

  return async <T>(path: string, init: RequestInit = {}): Promise<T> => {
    const { data: { session } } = await supabase.auth.getSession()
    const headers = new Headers(init.headers)
    if (session?.access_token) {
      headers.set("Authorization", `Bearer ${session.access_token}`)
    }
    headers.set("Content-Type", "application/json")

    const response = await fetch(`${normalize(baseUrl)}${path}`, {
      ...init,
      headers,
    })

    if (!response.ok) {
      const text = await response.text().catch(() => "")
      throw new Error(text || `Request failed (${response.status})`)
    }

    return response.json() as Promise<T>
  }
}
