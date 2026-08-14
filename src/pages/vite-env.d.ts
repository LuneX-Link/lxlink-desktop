/// <reference types="vite/client" />

interface Window {
  AstroLuneLoader?: {
    getState: () => LoaderProgress
    setProgress: (progress: number) => void
    setStage: (text: string) => void
    start: () => void
    complete: () => void
    reset: () => void
    onStateChange: (callback: (state: LoaderProgress) => void) => () => void
  }
}

interface LoaderProgress {
  state: 'idle' | 'loading' | 'complete' | 'interactive'
  currentStep: number
  totalSteps: number
  progress: number
  timestamp: number
}
