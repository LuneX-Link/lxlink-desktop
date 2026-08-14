import type React from "react"

export type AppUpdaterEvent =
  | { type: "update-available"; info: { version: string } }
  | { type: "update-downloaded" }
  | { type: "error"; error: { message: string } }

export type UserStatus = "online" | "dnd" | "invisible" | "inactive" | "offline"

export type UserRole =
  | "owner" | "steward" | "executor"
  | "guardian" | "arbiter" | "sentinel"
  | "guide" | "mechanic" | "liaison"
  | "patron" | "influencer" | "recruit"
  | "pioneer" | "flamekeeper" | "chronicler"
  | "creator" | "tester" | "hunter"
  | "champion" | "veteran" | "ghost"

export interface Server {
  id: string
  name: string
  joinDate: string
  description: string | null
  avatarUrl?: string | null
  bannerUrl?: string | null
}

export interface Chat {
  id: string
  name: string
  avatar: string | null
  status: string
  /** The other participant in a DM — lets the UI show presence and open their profile. */
  peerId?: string | null
  type?: "text" | "voice" | "dm" | "group_dm"
  lastMessage?: string
  lastMessageAt?: string
  unreadCount?: number
}

export interface User {
  id?: string
  name: string
  avatar: string | null
  status: string
}

export type MediaContent = {}

export interface Message {
  id: string
  senderId: string
  content: string
  timestamp: number
  isEdited?: boolean
  attachments?: MediaContent[]
}

export interface UserData {
  id: string
  avatar: {
    src: string | null
    alt?: string
  }
  banner?: string | null
  username: string
  nickname: string
  bio: string
  pronouns?: string
  status?: UserStatus
  activity?: UserActivity
  role?: UserRole | null
  is_verified?: boolean
  is_admin?: boolean
  createdAt?: string
}

export interface UserActivity {
  icon: string
  gameName: string
  startTime: number
  details?: string
}

export interface Profile {
  id: string
  userId: string
  username: string
  displayName?: string
  pronouns?: string
  bio?: string
  avatarUrl?: string | null
  bannerUrl?: string | null
  status?: UserStatus
  lastSeen?: string
  createdAt: string
  updatedAt: string
}

export interface SettingsSection {
  id: string
  label: string
  icon?: React.ReactNode
}

export interface SettingsCategory {
  title: string
  items: SettingsSection[]
}

export * from "./chat"
export * from "./auth"
export * from "./calls"

export interface DesktopSource {
  id: string
  name: string
  thumbnail: string
  display_id: string
  appIcon: string | null
}

export type { User as ApiUser, Channel as ApiChannel, Message as ApiMessage, Notification as ApiNotification, Subscription as ApiSubscription } from "./domain"
