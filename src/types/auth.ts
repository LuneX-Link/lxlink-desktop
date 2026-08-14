export type AuthStatus =
  | "loading"
  | "recovering"
  | "authenticated"
  | "unauthenticated"
  | "offline"

export interface DesktopAuthFlow {
  requestId: string
  verifier: string
  expiresAt: string
}
