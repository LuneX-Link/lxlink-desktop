import { useEffect, useState } from "react"
import { useAuthSession } from "../contexts/auth-context"
import { profilesApi, type Profile } from "../lib/api/profilesApi"

export const useCurrentUser = () => {
  const { isAuthenticated } = useAuthSession()
  const [user, setUser] = useState<Profile | null>(null)

  useEffect(() => {
    if (!isAuthenticated) {
      setUser(null)
      return
    }
    void profilesApi.getMe().then(setUser).catch(() => {})
  }, [isAuthenticated])

  const updateProfile = async (payload: Partial<Pick<Profile, "display_name" | "avatar_url" | "banner_url" | "bio" | "pronouns" | "role">>) => {
    const updated = await profilesApi.updateMe(payload)
    setUser(updated)
    return updated
  }

  return { user, updateProfile }
}
