import type { UserRole } from "../types"
import {
  Crown, Shield, Zap, ShieldCheck, Scale, Lock,
  MessageCircleQuestion, Wrench, Radio, Diamond, Star, Target,
  Rocket, Flame, Scroll, Palette, TestTube, Bug,
  Trophy, Medal, Ghost,
} from "lucide-react"

export interface RoleBadge {
  id: UserRole
  label: string
  color: string
  icon: typeof Crown
  category: "leadership" | "moderation" | "support" | "donors" | "activity" | "honorary" | "premium"
}

export const ROLE_BADGES: RoleBadge[] = [
  // Premium
  { id: "owner",      label: "Властелин",     color: "#f0b232", icon: Crown,           category: "leadership" },
  { id: "steward",    label: "Наместник",     color: "#c084fc", icon: Shield,          category: "leadership" },
  { id: "executor",   label: "Исполнитель",   color: "#00d4ff", icon: Zap,             category: "leadership" },

  // Moderation
  { id: "guardian",   label: "Защитник",      color: "#4ade80", icon: ShieldCheck,     category: "moderation" },
  { id: "arbiter",    label: "Арбитр",        color: "#facc15", icon: Scale,           category: "moderation" },
  { id: "sentinel",   label: "Страж",         color: "#94a3b8", icon: Lock,            category: "moderation" },

  // Support
  { id: "guide",      label: "Проводник",     color: "#60a5fa", icon: MessageCircleQuestion, category: "support" },
  { id: "mechanic",   label: "Механик",       color: "#f97316", icon: Wrench,          category: "support" },
  { id: "liaison",    label: "Связной",       color: "#22d3ee", icon: Radio,           category: "support" },

  // Donors
  { id: "patron",     label: "Покровитель",   color: "#a78bfa", icon: Diamond,         category: "donors" },
  { id: "influencer", label: "Влиятельный",   color: "#fbbf24", icon: Star,            category: "donors" },
  { id: "recruit",    label: "Целевой",       color: "#f43f5e", icon: Target,          category: "donors" },

  // Activity
  { id: "pioneer",    label: "Первопроходец", color: "#38bdf8", icon: Rocket,          category: "activity" },
  { id: "flamekeeper",label: "Пламенный",     color: "#ef4444", icon: Flame,           category: "activity" },
  { id: "chronicler", label: "Летописец",     color: "#a3a3a3", icon: Scroll,          category: "activity" },
  { id: "creator",    label: "Творец",        color: "#e879f9", icon: Palette,         category: "activity" },
  { id: "tester",     label: "Испытатель",    color: "#34d399", icon: TestTube,        category: "activity" },

  // Honorary
  { id: "hunter",     label: "Охотник",       color: "#fb923c", icon: Bug,             category: "honorary" },
  { id: "champion",   label: "Триумфатор",    color: "#facc15", icon: Trophy,          category: "honorary" },
  { id: "veteran",    label: "Ветеран",       color: "#a1a1aa", icon: Medal,           category: "honorary" },
  { id: "ghost",      label: "Невидимка",     color: "#6b7280", icon: Ghost,           category: "honorary" },
]

/** Check if user has an active subscription */
export const hasSubscription = (user: { role?: UserRole | null; is_admin?: boolean }): boolean => {
  // Admins and certain roles get premium by default
  if (user.is_admin) return true
  const premiumRoles: UserRole[] = ["owner", "steward", "patron", "influencer"]
  return user.role != null && premiumRoles.includes(user.role)
}

/** Get badge for a user role (returns null if no role) */
export const getRoleBadge = (role: UserRole | null | undefined): RoleBadge | null => {
  if (!role) return null
  return ROLE_BADGES.find((b) => b.id === role) ?? null
}

/** Get all applicable badges for a user (role badge + verified + admin) */
export const getUserBadges = (user: {
  role?: UserRole | null
  is_verified?: boolean
  is_admin?: boolean
}): RoleBadge[] => {
  const badges: RoleBadge[] = []

  // Role badge (highest priority)
  const roleBadge = getRoleBadge(user.role)
  if (roleBadge) {
    badges.push(roleBadge)
  }

  // Admin badge (if not already owner/steward)
  if (user.is_admin && !["owner", "steward"].includes(user.role ?? "")) {
    badges.push(ROLE_BADGES.find((b) => b.id === "owner")!)
  }

  // Verified badge (if not already a role that implies verification)
  if (user.is_verified && !roleBadge) {
    badges.push(ROLE_BADGES.find((b) => b.id === "guardian")!)
  }

  return badges.filter(Boolean)
}
