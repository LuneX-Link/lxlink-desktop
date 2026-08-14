import { useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { supabase } from "../../lib/supabase"

export function AuthCallback() {
  const navigate = useNavigate()

  useEffect(() => {
    const handleCallback = async () => {
      // Token can come from hash (#access_token=...&refresh_token=...)
      // or from query (?token=...&refresh_token=...)
      const hash = window.location.hash
      const search = window.location.search
      const params = new URLSearchParams(
        hash.startsWith("#") ? hash.slice(1) : search,
      )

      const accessToken =
        params.get("access_token") || params.get("token")
      const refreshToken = params.get("refresh_token")

      if (accessToken) {
        await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken || "",
        })
      }

      // Clean URL and redirect to root
      window.history.replaceState({}, "", window.location.pathname)
      navigate("/", { replace: true })
    }

    handleCallback()
  }, [navigate])

  return (
    <div
      style={{
        background: "#000",
        color: "#fff",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        height: "100vh",
        fontFamily: "sans-serif",
      }}
    >
      Authorizing...
    </div>
  )
}
