export interface User {
  id: string
  username: string
  email?: string
  displayName?: string | null
  avatar?: string | null
  avatarUrl?: string | null
  bio?: string | null
  status?: "online" | "offline" | "dnd" | "invisible" | "inactive"
  since?: string
}

export interface AuthUser {
  id: string
  email: string | null
  username: string
  displayName?: string | null
  avatar?: string | null
}

export interface Channel {
  id: string
  spaceId: string
  name: string
  type: "text" | "voice"
}

export interface Message {
  messageId: string
  channelId: string
  authorId: string
  content: string
  attachments: string[]
  createdAt: string
  editedAt?: string | null
  isDeleted?: boolean
  reactions?: Record<string, string[]>
}

export type NotificationType = "message" | "mention" | "system"

export interface Notification {
  id: string
  type: NotificationType
  title: string
  body: string
  read: boolean
  createdAt: string
  metadata: Record<string, unknown> | null
}

export interface Subscription {
  planName: string
  status: "active" | "expired" | "trial"
  expiryDate: string | null
  featureFlags: string[]
}
