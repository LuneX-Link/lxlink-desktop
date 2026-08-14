import React, { useCallback, useEffect, useState } from "react"
import ReactDOM from "react-dom/client"
import { Provider } from "react-redux"
import { HashRouter, Navigate, Route, Routes } from "react-router-dom"

import App from "./app"
import { store } from "./lib"
import { closeToast } from "./lib"
import LanguageDetector from "i18next-browser-languagedetector"
import { initReactI18next } from "react-i18next"
import i18n from "i18next"
import resources from "./locales"
import { useAppDispatch, useAppSelector } from "./hooks"
import { Toast } from "./components"

import { CallProvider } from "./contexts/call-context"
import { AuthProvider, useAuthSession } from "./contexts/auth-context"
import { RealtimeProvider } from "./contexts/realtime-context"
import { ConnectivityProvider } from "./contexts/connectivity-context"
import { DebugProvider, useDebug } from "./contexts/debug-context"
import { DebugPanel } from "./components/debug-panel/debug-panel"
import { OfflineBanner } from "./components/offline-banner/offline-banner"
import { useApiInterceptor } from "./hooks/useApiInterceptor"
import { setDebugReduxLogger } from "./lib/redux-logger"
import { ServerPickerScreen } from "./components/server-picker/ServerPickerScreen"
import { AuthCallback } from "./pages/auth/auth-callback"
import { AuthWaiting } from "./pages/auth/auth-waiting"
import { ChatPage } from "./pages/chat/chat"
import "./scss/app.scss"
import "./components/main-sidebar/main-sidebar.scss"

import "@fontsource/noto-sans/400.css"
import "@fontsource/noto-sans/500.css"
import "@fontsource/noto-sans/700.css"

const SERVER_STORAGE_KEY = "astrolune_server"

function getStoredServer(): { address: string; port: number } | null {
  try {
    const raw = localStorage.getItem(SERVER_STORAGE_KEY)
    if (raw) return JSON.parse(raw)
  } catch {}
  // TODO: restore after screenshots — auto-connect to localhost
  return { address: "localhost", port: 8001 }
}

function storeServer(address: string, port: number): void {
  localStorage.setItem(SERVER_STORAGE_KEY, JSON.stringify({ address, port }))
}

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: "en",
    interpolation: {
      escapeValue: false,
    },
  })

const GlobalToast = () => {
  const toasts = useAppSelector((state) => state.toast.toasts)
  const dispatch = useAppDispatch()

  return (
    <div className="toast-container">
      {toasts.map((toast) => (
        <Toast
          key={toast.id}
          visible={true}
          title={toast.title}
          message={toast.message}
          type={toast.type}
          duration={toast.duration}
          onClose={() => dispatch(closeToast(toast.id))}
        />
      ))}
    </div>
  )
}

const AuthenticatedApp = () => {
  return (
    <CallProvider>
      <App />
    </CallProvider>
  )
}

const AuthGate = () => {
  const { isAuthenticated, isLoading } = useAuthSession()

  if (isLoading) {
    return null
  }

  if (!isAuthenticated) {
    return <AuthWaiting />
  }

  return (
    <Routes>
      <Route path="/" element={<AuthenticatedApp />}>
        <Route path="chat/:chatId?" element={<ChatPage />} />
      </Route>
      <Route path="/call" element={<Navigate to="/" replace />} />
      <Route path="/call/:roomId" element={<Navigate to="/" replace />} />
      <Route path="/login" element={<Navigate to="/" replace />} />
      <Route path="/register" element={<Navigate to="/" replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

const ServerGate = () => {
  const [server, setServer] = useState<{ address: string; port: number } | null>(() => getStoredServer())
  const [isConnecting, setIsConnecting] = useState(false)

  const handleConnect = useCallback((address: string, port: number) => {
    setIsConnecting(true)
    storeServer(address, port)
    setServer({ address, port })
    setIsConnecting(false)
  }, [])

  if (isConnecting) {
    return null
  }

  if (!server) {
    return <ServerPickerScreen onConnect={handleConnect} />
  }

  return (
    <ConnectivityProvider>
      <AuthProvider>
        <RealtimeProvider>
          <OfflineBanner />
          <HashRouter>
            <Routes>
              <Route path="/auth-callback" element={<AuthCallback />} />
              <Route path="*" element={<AuthGate />} />
            </Routes>
          </HashRouter>
        </RealtimeProvider>
      </AuthProvider>
    </ConnectivityProvider>
  )
}

const DebugKeyboardHandler = () => {
  const { toggle, addReduxLog } = useDebug()
  useApiInterceptor()

  useEffect(() => {
    setDebugReduxLogger(addReduxLog)
    return () => setDebugReduxLogger(() => {})
  }, [addReduxLog])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === "D") {
        e.preventDefault()
        toggle()
      }
    }

    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [toggle])

  // Block webview context menu
  useEffect(() => {
    const preventContextMenu = (e: MouseEvent) => {
      e.preventDefault()
    }

    document.addEventListener("contextmenu", preventContextMenu)
    return () => document.removeEventListener("contextmenu", preventContextMenu)
  }, [])

  return null
}

const Root = () => {
  return (
    <Provider store={store}>
      <DebugProvider>
        <DebugKeyboardHandler />
        <DebugPanel />
        <ServerGate />
        <GlobalToast />
      </DebugProvider>
    </Provider>
  )
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>,
)
