import { createClient } from "@supabase/supabase-js"

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "http://localhost:8000"
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || ""

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
    storageKey: "lxlink-auth-session",
  },
  realtime: {
    params: {
      eventsPerSecond: 20,
    },
  },
})

export const supabaseConfig = {
  url: SUPABASE_URL,
  anonKey: SUPABASE_ANON_KEY,
}
