import { useCallback, useEffect, useRef, useState } from "react"
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow"
import { invoke } from "@tauri-apps/api/core"
import { check } from "@tauri-apps/plugin-updater"
import { createClient } from "@supabase/supabase-js"

import SplashCanvas from "./splash"
import { Button } from "../src/components/ui/button/button"
import "../src/components/ui/button/button.scss"
import "./app.css"

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "http://localhost:8000"
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || ""
const HEALTH_TIMEOUT_MS = 5_000
const RETRY_INTERVAL_MS = 3_000

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
    storageKey: "lxlink-auth-session",
  },
})

const wait = (duration: number) => new Promise<void>((resolve) => window.setTimeout(resolve, duration))

async function checkBackendHealth() {
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), HEALTH_TIMEOUT_MS)
  try {
    const response = await fetch(`${SUPABASE_URL}/auth/v1/health`, {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
      cache: "no-store",
      signal: controller.signal,
    })
    return response.ok
  } catch {
    return false
  } finally {
    window.clearTimeout(timeout)
  }
}

const setLoader = (progress: number, stage: string) => {
  window.AstroLuneLoader?.setProgress(progress)
  window.AstroLuneLoader?.setStage(stage)
}

function Splash() {
  const [offline, setOffline] = useState(false)
  const [updateFailure, setUpdateFailure] = useState(false)
  const wakeConnectionRef = useRef<(() => void) | null>(null)
  const updateDecisionRef = useRef<((decision: "retry" | "continue") => void) | null>(null)

  const retryConnection = useCallback(() => {
    wakeConnectionRef.current?.()
  }, [])

  const retryUpdate = useCallback(() => {
    updateDecisionRef.current?.("retry")
  }, [])

  const continueWithoutUpdate = useCallback(() => {
    updateDecisionRef.current?.("continue")
  }, [])

  useEffect(() => {
    let active = true
    window.AstroLuneLoader?.start()

    const waitForBackend = async () => {
      while (active) {
        setLoader(18, "Connecting to server...")
        if (await checkBackendHealth()) {
          setOffline(false)
          return true
        }
        setOffline(true)
        setLoader(18, "Waiting for connection...")
        await new Promise<void>((resolve) => {
          wakeConnectionRef.current = resolve
          window.setTimeout(resolve, RETRY_INTERVAL_MS)
        })
        wakeConnectionRef.current = null
      }
      return false
    }

    const checkAndInstallUpdate = async () => {
      setLoader(66, "Checking updates...")
      let update
      try {
        update = await check()
      } catch (checkError) {
        console.debug("[Updater] Check skipped:", checkError)
        return true
      }
      if (!update) return true

      while (active) {
        try {
          let downloaded = 0
          let downloadSize = 0
          await update.downloadAndInstall((event) => {
            if (event.event === "Started") {
              downloadSize = event.data.contentLength ?? 0
              setLoader(70, "Downloading update...")
            } else if (event.event === "Progress") {
              downloaded += event.data.chunkLength
              const progress = downloadSize > 0
                ? 70 + Math.round((downloaded / downloadSize) * 28)
                : 80
              setLoader(Math.min(progress, 98), "Downloading update...")
            } else if (event.event === "Finished") {
              setLoader(99, "Installing update...")
            }
          })
          await invoke("restart_app")
          return false
        } catch (updateError) {
          console.error("[Updater] Download failed:", updateError)
          setUpdateFailure(true)
          setLoader(70, "Update failed. Retry or continue.")
          const decision = await new Promise<"retry" | "continue">((resolve) => {
            updateDecisionRef.current = resolve
          })
          updateDecisionRef.current = null
          setUpdateFailure(false)
          if (decision === "continue") return true
        }
      }
      return false
    }

    const boot = async () => {
      const connected = await waitForBackend()
      if (!active || !connected) return
      setLoader(38, "Restoring session...")
      await supabase.auth.getSession()
      if (!active) return
      const shouldContinue = await checkAndInstallUpdate()
      if (!active || !shouldContinue) return
      setLoader(100, "Ready")
      await wait(250)
      await invoke("show_main_window")
      await getCurrentWebviewWindow().close()
    }

    void boot().catch((bootError) => {
      console.error("[Splash] Boot failed:", bootError)
      setOffline(true)
      setLoader(18, "Waiting for connection...")
    })

    return () => {
      active = false
      wakeConnectionRef.current?.()
      updateDecisionRef.current?.("continue")
    }
  }, [])

  return (
    <div className="splash-container">
      <SplashCanvas />
      {(offline || updateFailure) && (
        <div className="splash-actions">
          {offline && (
            <Button theme="outline" onClick={retryConnection}>
              Проверить снова
            </Button>
          )}
          {updateFailure && (
            <>
              <Button theme="outline" onClick={retryUpdate}>Повторить обновление</Button>
              <Button theme="primary" onClick={continueWithoutUpdate}>Продолжить</Button>
            </>
          )}
        </div>
      )}
    </div>
  )
}

export default Splash
