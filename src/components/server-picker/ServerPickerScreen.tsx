import React, { useCallback, useEffect, useState } from "react"
import {
  discoverServers,
  checkServerHealth,
  type DiscoveredServer,
} from "../../lib/discovery/mdns"

import "./server-picker.scss"

interface ServerPickerScreenProps {
  onConnect: (address: string, port: number) => void
}

interface ServerWithStatus extends DiscoveredServer {
  status: "checking" | "online" | "offline"
}

export function ServerPickerScreen({ onConnect }: ServerPickerScreenProps) {
  const [servers, setServers] = useState<ServerWithStatus[]>([])
  const [scanning, setScanning] = useState(true)
  const [manualInput, setManualInput] = useState("")
  const [error, setError] = useState<string | null>(null)

  const scanForServers = useCallback(async () => {
    setScanning(true)
    setError(null)

    try {
      const discovered = await discoverServers()
      const withStatus: ServerWithStatus[] = discovered.map((server) => ({
        ...server,
        status: "checking" as const,
      }))

      setServers(withStatus)

      const checked = await Promise.all(
        withStatus.map(async (server) => {
          const online = await checkServerHealth(server.address, server.port)
          return { ...server, status: (online ? "online" : "offline") as "online" | "offline" }
        }),
      )

      setServers(checked)
    } catch (err) {
      setError("Failed to scan for servers")
      console.error("[ServerPicker] scan error:", err)
    } finally {
      setScanning(false)
    }
  }, [])

  useEffect(() => {
    void scanForServers()
  }, [scanForServers])

  const handleManualConnect = useCallback(() => {
    const trimmed = manualInput.trim()
    if (!trimmed) return

    let address = trimmed
    let port = 8001

    const colonIndex = trimmed.lastIndexOf(":")
    if (colonIndex > 0) {
      const parsedPort = parseInt(trimmed.slice(colonIndex + 1), 10)
      if (!isNaN(parsedPort) && parsedPort > 0 && parsedPort <= 65535) {
        port = parsedPort
        address = trimmed.slice(0, colonIndex)
      }
    }

    onConnect(address, port)
  }, [manualInput, onConnect])

  const handleLocalhostConnect = useCallback(() => {
    onConnect("localhost", 8001)
  }, [onConnect])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        handleManualConnect()
      }
    },
    [handleManualConnect],
  )

  return (
    <div className="server-picker">
      <div className="server-picker-card">
        <div className="server-picker-card__header">
          <h1 className="server-picker-card__title">Connect to Server</h1>
          <p className="server-picker-card__subtitle">
            Discover local servers or enter an address manually
          </p>
        </div>

        {error && (
          <div className="server-picker-card__error">{error}</div>
        )}

        <div className="server-picker-card__section">
          <div className="server-picker-card__section-title">
            Local Servers
          </div>

          {scanning && (
            <div className="server-picker-card__scan-status">
              <div className="server-picker-card__spinner" />
              <span>Scanning for servers...</span>
            </div>
          )}

          <div className="server-picker-card__server-list">
            {servers.map((server, index) => (
              <div
                key={`${server.address}-${server.port}-${index}`}
                className="server-picker-card__server-item"
                onClick={() => onConnect(server.address, server.port)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    onConnect(server.address, server.port)
                  }
                }}
              >
                <div className="server-picker-card__server-info">
                  <span className="server-picker-card__server-name">
                    {server.name}
                  </span>
                  <span className="server-picker-card__server-address">
                    {server.address}:{server.port}
                  </span>
                </div>
                <div className="server-picker-card__server-status">
                  <div
                    className={`server-picker-card__status-dot server-picker-card__status-dot--${server.status}`}
                  />
                  <span
                    className={`server-picker-card__status-text server-picker-card__status-text--${server.status}`}
                  >
                    {server.status === "checking"
                      ? "Checking..."
                      : server.status === "online"
                        ? "Online"
                        : "Offline"}
                  </span>
                </div>
              </div>
            ))}

            {!scanning && servers.length === 0 && (
              <div className="server-picker-card__empty">
                No servers found on your local network
              </div>
            )}
          </div>
        </div>

        <div className="server-picker-card__divider">or</div>

        <div className="server-picker-card__section">
          <div className="server-picker-card__section-title">
            Manual Connection
          </div>
          <div className="server-picker-card__manual-input">
            <input
              type="text"
              className="server-picker-card__input"
              placeholder="IP address or hostname:port"
              value={manualInput}
              onChange={(e) => setManualInput(e.target.value)}
              onKeyDown={handleKeyDown}
            />
            <button
              type="button"
              className="server-picker-card__connect-btn"
              onClick={handleManualConnect}
              disabled={!manualInput.trim()}
            >
              Connect
            </button>
          </div>
        </div>

        <div className="server-picker-card__section">
          <button
            type="button"
            className="server-picker-card__localhost-btn"
            onClick={handleLocalhostConnect}
          >
            Connect to localhost:8001
          </button>
        </div>
      </div>
    </div>
  )
}
