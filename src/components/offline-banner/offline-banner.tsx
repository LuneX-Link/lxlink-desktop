import React from "react"
import { useConnectivity } from "../../contexts/connectivity-context"
import { WifiOff } from "lucide-react"
import "./offline-banner.scss"

const HELP_URL = "https://docs.astrolune.app/troubleshooting"

export const OfflineBanner: React.FC = () => {
  const { isConnected, isChecking } = useConnectivity()

  if (isConnected) return null

  return (
    <a
      href={HELP_URL}
      target="_blank"
      rel="noopener noreferrer"
      className="offline-banner"
      title="Click for help"
    >
      <WifiOff size={14} className="offline-banner__icon" />
      <span className="offline-banner__text">
        {isChecking ? "Checking connection..." : "No connection — Click for help"}
      </span>
    </a>
  )
}
