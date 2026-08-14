import { invoke } from "@tauri-apps/api/core"

export interface DiscoveredServer {
  name: string
  address: string
  port: number
}

export async function discoverServers(): Promise<DiscoveredServer[]> {
  try {
    const servers = await invoke<DiscoveredServer[]>("discover_mdns_services")
    return servers
  } catch (error) {
    console.warn("[mDNS] discovery failed:", error)
    return []
  }
}

export async function checkServerHealth(
  address: string,
  port: number,
): Promise<boolean> {
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 3000)

    const response = await fetch(`http://${address}:${port}/health`, {
      method: "GET",
      signal: controller.signal,
    })

    clearTimeout(timeoutId)
    return response.ok
  } catch {
    return false
  }
}
