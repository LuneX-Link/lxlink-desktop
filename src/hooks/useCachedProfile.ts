import { useCallback, useEffect, useState } from "react"
import { profilesApi, type Profile } from "../lib/api/profilesApi"
import { useConnectivity } from "../contexts/connectivity-context"

const PROFILE_CACHE_KEY = "astrolune_profile_cache"
const PROFILE_CACHE_TIMESTAMP_KEY = "astrolune_profile_cache_timestamp"

interface CachedProfile {
  data: Profile | null
  timestamp: number
}

/**
 * Hook that provides profile data with offline support
 * - Loads from localStorage cache immediately on mount
 * - Fetches fresh data from API when online
 * - Updates cache with latest data
 * - Returns cached data when offline
 */
export const useCachedProfile = () => {
  const { isConnected } = useConnectivity()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Load cached profile on mount
  useEffect(() => {
    try {
      const cachedData = localStorage.getItem(PROFILE_CACHE_KEY)
      const cachedTimestamp = localStorage.getItem(PROFILE_CACHE_TIMESTAMP_KEY)

      if (cachedData && cachedTimestamp) {
        const parsedCache: CachedProfile = {
          data: JSON.parse(cachedData),
          timestamp: parseInt(cachedTimestamp, 10),
        }

        // Only use cache if it's less than 24 hours old
        const cacheAge = Date.now() - parsedCache.timestamp
        const maxCacheAge = 24 * 60 * 60 * 1000 // 24 hours

        if (cacheAge < maxCacheAge && parsedCache.data) {
          setProfile(parsedCache.data)
        } else {
          // Clear expired cache
          localStorage.removeItem(PROFILE_CACHE_KEY)
          localStorage.removeItem(PROFILE_CACHE_TIMESTAMP_KEY)
        }
      }
    } catch (err) {
      console.warn("Failed to load cached profile:", err)
    }
  }, [])

  const fetchProfile = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)

      const freshProfile = await profilesApi.getMe()
      setProfile(freshProfile)

      // Cache the profile
      if (freshProfile) {
        localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(freshProfile))
        localStorage.setItem(PROFILE_CACHE_TIMESTAMP_KEY, Date.now().toString())
      }

      return freshProfile
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to fetch profile"
      setError(errorMessage)
      console.error("Failed to fetch profile:", err)

      // If we're offline and have cached data, keep using it
      if (!isConnected && profile) {
        // Already have cached data, just return it
        return profile
      }

      throw err
    } finally {
      setIsLoading(false)
    }
  }, [isConnected, profile])

  // Auto-fetch when online
  useEffect(() => {
    if (isConnected) {
      fetchProfile()
    }
  }, [isConnected, fetchProfile])

  const updateProfile = useCallback(async (updates: Partial<Profile>) => {
    try {
      const updated = await profilesApi.updateMe(updates)

      // Update cache immediately
      if (updated) {
        localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(updated))
        localStorage.setItem(PROFILE_CACHE_TIMESTAMP_KEY, Date.now().toString())
        setProfile(updated)
      }

      return updated
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to update profile"
      setError(errorMessage)
      console.error("Failed to update profile:", err)
      throw err
    }
  }, [])

  return {
    profile,
    isLoading,
    error,
    fetchProfile,
    updateProfile,
  }
}
