import { useState } from "react"
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow"

function getErrorMessage(): string {
  try {
    const params = new URLSearchParams(window.location.search)
    return params.get("message") || "An unexpected error occurred."
  } catch {
    return "An unexpected error occurred."
  }
}

export default function ErrorWindow() {
  const [isReporting, setIsReporting] = useState(false)
  const errorMessage = getErrorMessage()

  const handleRestart = async () => {
    try {
      const win = getCurrentWebviewWindow()
      await win.emit("astrolune-restart")
      await win.close()
    } catch {
      window.location.reload()
    }
  }

  const handleClose = async () => {
    try {
      const win = getCurrentWebviewWindow()
      await win.close()
    } catch {
      window.close()
    }
  }

  const handleReport = () => {
    setIsReporting(true)
    // Could open a URL or form
    setTimeout(() => setIsReporting(false), 2000)
  }

  return (
    <div className="error-window">
      <div className="error-icon">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      </div>

      <h2 className="error-title">Something went wrong</h2>

      <div className="error-message">
        <p>{errorMessage}</p>
      </div>

      <div className="error-actions">
        <button className="error-btn error-btn--secondary" onClick={handleReport} disabled={isReporting}>
          {isReporting ? "Reported" : "Report Problem"}
        </button>
        <button className="error-btn error-btn--primary" onClick={handleRestart}>
          Restart
        </button>
        <button className="error-btn error-btn--ghost" onClick={handleClose}>
          Close
        </button>
      </div>
    </div>
  )
}
