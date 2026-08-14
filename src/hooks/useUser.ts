import { useEffect, useState } from "react"
import { profilesApi, type Profile } from "../lib/api/profilesApi"

const CACHE = new Map<string, Profile>()

export const useUser = (userId: string) => {
  const [user, setUser] = useState<Profile | null>(CACHE.get(userId) ?? null)

  useEffect(() => {
    if (!userId) return
    const cached = CACHE.get(userId)
    if (cached) {
      setUser(cached)
      return
    }

    void profilesApi.getById(userId).then((loaded) => {
      CACHE.set(userId, loaded)
      setUser(loaded)
    }).catch(() => {})
  }, [userId])

  return { user }
}
