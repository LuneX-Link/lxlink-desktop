import { isPermissionGranted, requestPermission, sendNotification } from "@tauri-apps/plugin-notification"
import { useCallback, useEffect, useMemo, useState } from "react"
import { notificationsSupabaseApi, type Notification as SupabaseNotification } from "../lib/api/notificationsSupabase"
import type { Notification } from "../types/domain"
import { useToast } from "./useToast"

const showNativeNotification = async (notification: Notification) => {
  let permissionGranted = await isPermissionGranted()
  if (!permissionGranted) {
    permissionGranted = (await requestPermission()) === "granted"
  }
  if (permissionGranted) {
    sendNotification({ title: notification.title, body: notification.body })
  }
}

export type NotificationType = "message" | "mention" | "system"

export const notificationIconByType: Record<NotificationType, string> = {
  message: "msg",
  mention: "@",
  system: "sys",
}

/** Convert Supabase notification to domain Notification */
const fromSupabase = (n: SupabaseNotification): Notification => ({
  id: n.id,
  type: (n.type === "message" || n.type === "mention" ? n.type : "system") as NotificationType,
  title: n.title || "Notification",
  body: n.body || "",
  read: n.is_read,
  createdAt: n.created_at,
  metadata: n.metadata || null,
})

export const useNotifications = () => {
  const { showSuccessToast } = useToast()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [isLoading, setIsLoading] = useState(false)

  const unreadCount = useMemo(
    () => notifications.reduce((count, n) => count + (n.read ? 0 : 1), 0),
    [notifications],
  )

  const loadNotifications = useCallback(async () => {
    setIsLoading(true)
    try {
      const list = await notificationsSupabaseApi.list(50)
      setNotifications(list.map(fromSupabase))
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Load on mount
  useEffect(() => {
    void loadNotifications()
  }, [loadNotifications])

  // Subscribe to Supabase Realtime for new notifications
  useEffect(() => {
    const unsubscribe = notificationsSupabaseApi.subscribe((n) => {
      const notification = fromSupabase(n)
      setNotifications((prev) => [notification, ...prev.filter((item) => item.id !== notification.id)])

      if (document.visibilityState === "visible") {
        showSuccessToast(notification.title, notification.body)
      } else {
        void showNativeNotification(notification)
      }
    })

    return () => {
      unsubscribe()
    }
  }, [showSuccessToast])

  const markAsRead = useCallback(async (id: string) => {
    await notificationsSupabaseApi.markRead(id)
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)))
  }, [])

  const markAllAsRead = useCallback(async () => {
    await notificationsSupabaseApi.markAllRead()
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
  }, [])

  const dismiss = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id))
  }, [])

  return useMemo(() => ({
    notifications,
    unreadCount,
    isLoading,
    loading: isLoading,
    loadNotifications,
    markAsRead,
    markAllAsRead,
    dismiss,
    clearAll: markAllAsRead,
    reload: loadNotifications,
  }), [dismiss, isLoading, loadNotifications, markAllAsRead, markAsRead, notifications, unreadCount])
}
