import { invoke } from "@tauri-apps/api/core"
import { ExternalLink, LoaderCircle, ShieldCheck, WifiOff } from "lucide-react"

import { Button } from "../../components"
import { useAuthSession } from "../../contexts/auth-context"
import { useConnectivity } from "../../contexts/connectivity-context"
import "./auth-waiting.scss"

export function AuthWaiting() {
  const { beginSignIn, isAwaitingAuth, error } = useAuthSession()
  const { isConnected, isChecking, checkConnection } = useConnectivity()

  const handleOpenAuth = async () => {
    try {
      const url = await beginSignIn()
      await invoke("open_url", { url })
    } catch (openError) {
      console.error("[AuthWaiting] Failed to open authorization:", openError)
    }
  }

  const waitingForNetwork = !isConnected

  return (
    <main className="auth-waiting">
      <section className="auth-waiting__content" aria-live="polite">
        <div className="auth-waiting__mark" aria-hidden="true">
          <span>LX</span>
        </div>

        <div className="auth-waiting__copy">
          <span className="auth-waiting__eyebrow">LX Link Desktop</span>
          <h1>{waitingForNetwork ? "Ожидаем подключение" : "Войдите в аккаунт"}</h1>
          <p>
            {waitingForNetwork
              ? "Соединение с сервером потеряно. Авторизация продолжится автоматически после восстановления связи."
              : "Страница входа откроется в браузере. После подтверждения приложение получит сессию один раз и продолжит работу."}
          </p>
        </div>

        <div className="auth-waiting__status">
          {waitingForNetwork ? <WifiOff size={17} /> : isAwaitingAuth ? <LoaderCircle size={17} /> : <ShieldCheck size={17} />}
          <span>
            {waitingForNetwork
              ? isChecking ? "Проверяем сервер…" : "Нет соединения с backend"
              : isAwaitingAuth ? "Ожидаем подтверждение в браузере…" : "Безопасный одноразовый вход готов"}
          </span>
        </div>

        {error && <p className="auth-waiting__error">{error}</p>}

        <div className="auth-waiting__actions">
          {waitingForNetwork ? (
            <Button theme="outline" onClick={() => void checkConnection()} disabled={isChecking}>
              {isChecking && <LoaderCircle size={16} />}
              Проверить соединение
            </Button>
          ) : (
            <Button theme="outline" onClick={() => void handleOpenAuth()}>
              <ExternalLink size={16} />
              {isAwaitingAuth ? "Открыть страницу снова" : "Открыть страницу входа"}
            </Button>
          )}
        </div>
      </section>
    </main>
  )
}
