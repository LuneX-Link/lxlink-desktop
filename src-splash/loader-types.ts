export interface LoaderProgress {
  state: 'idle' | 'loading' | 'complete' | 'interactive'
  currentStep: number
  totalSteps: number
  progress: number
  timestamp: number
}

export interface LoaderAPI {
  getState: () => LoaderProgress
  setProgress: (progress: number) => void
  setStage: (text: string) => void
  start: () => void
  complete: () => void
  reset: () => void
  onStateChange: (callback: (state: LoaderProgress) => void) => () => void
}

declare global {
  interface Window {
    AstroLuneLoader?: LoaderAPI
  }
}

export {}
