export type CallKind = "audio" | "video"

export type CallStatus = "ringing" | "active" | "declined" | "missed" | "ended"

export type CallParticipantStatus = "ringing" | "joined" | "declined" | "left" | "missed"

export interface Call {
  id: string
  channel_id: string
  initiator_id: string
  room_name: string
  kind: CallKind
  status: CallStatus
  created_at: string
  started_at: string | null
  ended_at: string | null
  expires_at: string
  updated_at: string
}

export interface CallParticipant {
  call_id: string
  user_id: string
  status: CallParticipantStatus
  invited_at: string
  joined_at: string | null
  left_at: string | null
}

export interface IncomingCall extends Call {
  channel_name: string
}

export interface LiveKitCallToken {
  token: string
  url: string
  room: string
}
