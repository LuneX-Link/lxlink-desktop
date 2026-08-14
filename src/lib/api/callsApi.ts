import type { RealtimeChannel, RealtimePostgresChangesPayload } from "@supabase/supabase-js"

import { supabase } from "../supabase"
import type {
  Call,
  CallKind,
  CallParticipant,
  LiveKitCallToken,
} from "../../types/calls"

const callRpc = async (name: string, args: Record<string, unknown>) => {
  const { data, error } = await supabase.rpc(name, args)
  if (error) throw error
  return data as Call
}

export const callsApi = {
  start: (channelId: string, kind: CallKind) =>
    callRpc("start_call", { p_channel_id: channelId, p_kind: kind }),

  accept: (callId: string) => callRpc("accept_call", { p_call_id: callId }),
  decline: (callId: string) => callRpc("decline_call", { p_call_id: callId }),
  leave: (callId: string) => callRpc("leave_call", { p_call_id: callId }),
  end: (callId: string) => callRpc("end_call", { p_call_id: callId }),
  miss: (callId: string) => callRpc("miss_call", { p_call_id: callId }),

  getById: async (callId: string) => {
    const { data, error } = await supabase
      .from("calls")
      .select("*")
      .eq("id", callId)
      .single()
    if (error) throw error
    return data as Call
  },

  getIncoming: async (userId: string) => {
    const { data, error } = await supabase
      .from("call_participants")
      .select("call_id, user_id, status, invited_at, joined_at, left_at, calls!inner(*)")
      .eq("user_id", userId)
      .eq("status", "ringing")
      .eq("calls.status", "ringing")
      .gt("calls.expires_at", new Date().toISOString())
      .order("invited_at", { ascending: false })
      .limit(1)
      .maybeSingle()
    if (error) throw error
    if (!data) return null

    const relation = data.calls as unknown as Call | Call[]
    return (Array.isArray(relation) ? relation[0] : relation) ?? null
  },

  getToken: async (callId: string, purpose: "participant" | "media" = "participant") => {
    const { data, error } = await supabase.functions.invoke("livekit-token", {
      body: { call_id: callId, purpose },
    })
    if (error) throw error
    return data as LiveKitCallToken
  },

  subscribeForUser: (
    userId: string,
    onChange: (payload: RealtimePostgresChangesPayload<CallParticipant>) => void,
  ): RealtimeChannel => supabase
    .channel(`calls:user:${userId}`)
    .on<CallParticipant>(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "call_participants",
        filter: `user_id=eq.${userId}`,
      },
      onChange,
    )
    .subscribe(),

  subscribeToCall: (
    callId: string,
    onChange: (payload: RealtimePostgresChangesPayload<Call>) => void,
  ): RealtimeChannel => supabase
    .channel(`calls:call:${callId}`)
    .on<Call>(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "calls",
        filter: `id=eq.${callId}`,
      },
      onChange,
    )
    .subscribe(),
}
