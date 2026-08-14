import { useCallback } from "react"
import { useAuthSession } from "../contexts/auth-context"
import { supabase } from "../lib/supabase"

function splitPart(str: string, delimiter: string, index: number): string {
  return str.split(delimiter)[index] || ""
}

export function useAuth() {
  const { user, isLoading, error, signOut, reloadUser } = useAuthSession()

  const signInWithPassword = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
  }, [])

  const signUpWithPassword = useCallback(async (email: string, password: string, username?: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          username: username || splitPart(email, '@', 0),
        },
      },
    })
    if (error) throw error
  }, [])

  const resetPassword = useCallback(async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email)
    if (error) throw error
  }, [])

  const updatePassword = useCallback(async (newPassword: string) => {
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    if (error) throw error
  }, [])

  const requestPasswordReset = useCallback(async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email)
    if (error) throw error
  }, [])

  const token = user ? "session-active" : null

  return {
    signUp: signUpWithPassword,
    signIn: signInWithPassword,
    signOut,
    logout: signOut,
    token,
    isAuthenticated: Boolean(user),
    getCurrentUser: reloadUser,
    refreshToken: reloadUser,
    resetPassword,
    updatePassword,
    requestPasswordReset,
    user,
    loading: isLoading,
    error,
  }
}
