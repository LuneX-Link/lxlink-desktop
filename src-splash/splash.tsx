import { useEffect, useRef } from "react"
import type { LoaderProgress } from "./loader-types"

const LOADING_STAGES = [
  { progress: 10, text: "Initializing core..." },
  { progress: 25, text: "Connecting to server..." },
  { progress: 55, text: "Restoring session..." },
  { progress: 75, text: "Checking updates..." },
  { progress: 95, text: "Preparing interface..." },
  { progress: 100, text: "Ready" },
]

export default function SplashCanvas() {
  const stageRef = useRef<HTMLDivElement>(null)
  const barRef = useRef<HTMLDivElement>(null)
  const percentRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let currentProgress = 0
    let targetProgress = 0
    let customStage: string | null = null
    const listeners = new Set<(state: LoaderProgress) => void>()

    const setStageText = (text: string) => {
      if (!stageRef.current) return
      stageRef.current.style.animation = "none"
      void stageRef.current.offsetHeight
      stageRef.current.style.animation = "text-reveal 0.4s ease forwards"
      stageRef.current.textContent = text
    }

    const notify = () => {
      const state = currentProgress >= 99.5 ? "interactive" : "loading"
      listeners.forEach((listener) => listener({
        state,
        progress: Math.round(currentProgress),
        currentStep: Math.round(currentProgress),
        totalSteps: 100,
        timestamp: Date.now(),
      }))
    }

    const update = () => {
      currentProgress += (targetProgress - currentProgress) * 0.08
      if (Math.abs(targetProgress - currentProgress) < 0.1) currentProgress = targetProgress
      if (barRef.current) barRef.current.style.width = `${currentProgress}%`
      if (percentRef.current) percentRef.current.textContent = `${Math.round(currentProgress)}%`
      if (!customStage) {
        const stage = LOADING_STAGES.find((item) => currentProgress <= item.progress)
        if (stage) setStageText(stage.text)
      }
      notify()
    }

    const interval = window.setInterval(update, 16)
    window.AstroLuneLoader = {
      setProgress: (progress) => { targetProgress = Math.max(0, Math.min(100, progress)) },
      setStage: (text) => { customStage = text; setStageText(text) },
      start: () => { currentProgress = 0; targetProgress = 0; customStage = null; notify() },
      complete: () => { targetProgress = 100; customStage = null },
      reset: () => { currentProgress = 0; targetProgress = 0; customStage = null; notify() },
      onStateChange: (callback) => { listeners.add(callback); return () => listeners.delete(callback) },
      getState: () => ({
        state: currentProgress >= 99.5 ? "interactive" : "loading",
        progress: Math.round(currentProgress),
        currentStep: Math.round(currentProgress),
        totalSteps: 100,
        timestamp: Date.now(),
      }),
    }

    setStageText(LOADING_STAGES[0].text)
    return () => {
      window.clearInterval(interval)
      delete window.AstroLuneLoader
    }
  }, [])

  return (
    <div className="splash-container">
      <div className="splash-content">
        <div className="splash-stage" ref={stageRef} />
        <div className="splash-progress-wrap">
          <div className="splash-progress-track">
            <div className="splash-progress-bar" ref={barRef} style={{ width: "0%" }} />
          </div>
          <div className="splash-percent" ref={percentRef}>0%</div>
        </div>
      </div>
    </div>
  )
}
