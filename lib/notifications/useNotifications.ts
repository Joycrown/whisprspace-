import { useState, useEffect, useCallback } from 'react'
import {
  fetchNotifications,
  getUnreadCount,
  markAsRead,
  markMultipleAsRead,
  markAllAsRead,
  deleteNotification,
  deleteMultipleNotifications,
  deleteAllRead,
  subscribeToNotifications,
  Notification,
  NotificationCategory,
} from './notification-service'
import { useUserStore } from '@/store/userStore'

/**
 * Hook for managing notifications
 */
export const useNotifications = (options?: {
  category?: NotificationCategory
  autoRefresh?: boolean
  enableRealtime?: boolean
}) => {
  const { session } = useUserStore()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Load notifications
  const loadNotifications = useCallback(async (filters?: {
    category?: NotificationCategory
    isRead?: boolean
    limit?: number
    offset?: number
  }) => {
    if (!session.user) return

    setIsLoading(true)
    setError(null)

    const { data, error: err, unreadCount: count } = await fetchNotifications({
      category: filters?.category || options?.category,
      isRead: filters?.isRead,
      limit: filters?.limit || 50,
      offset: filters?.offset || 0,
    })

    if (err) {
      setError(err)
    } else {
      setNotifications(data)
      setUnreadCount(count)
    }

    setIsLoading(false)
  }, [session.user, options?.category])

  // Refresh unread count only
  const refreshUnreadCount = useCallback(async () => {
    if (!session.user) return

    const { count } = await getUnreadCount()
    setUnreadCount(count)
  }, [session.user])

  // Mark notification as read
  const markNotificationAsRead = useCallback(async (notificationId: string) => {
    const { success, error: err } = await markAsRead(notificationId)

    if (err) {
      setError(err)
    } else if (success) {
      setNotifications((prev) =>
        prev.map((notif) =>
          notif.id === notificationId ? { ...notif, isRead: true } : notif
        )
      )
      setUnreadCount((prev) => Math.max(0, prev - 1))
    }

    return { success, error: err }
  }, [])

  // Mark multiple as read
  const markManyAsRead = useCallback(async (notificationIds: string[]) => {
    const { success, error: err } = await markMultipleAsRead(notificationIds)

    if (err) {
      setError(err)
    } else if (success) {
      setNotifications((prev) =>
        prev.map((notif) =>
          notificationIds.includes(notif.id) ? { ...notif, isRead: true } : notif
        )
      )
      await refreshUnreadCount()
    }

    return { success, error: err }
  }, [refreshUnreadCount])

  // Mark all as read
  const markAllNotificationsAsRead = useCallback(async () => {
    const { success, error: err } = await markAllAsRead()

    if (err) {
      setError(err)
    } else if (success) {
      setNotifications((prev) =>
        prev.map((notif) => ({ ...notif, isRead: true }))
      )
      setUnreadCount(0)
    }

    return { success, error: err }
  }, [])

  // Delete notification
  const removeNotification = useCallback(async (notificationId: string) => {
    const { success, error: err } = await deleteNotification(notificationId)

    if (err) {
      setError(err)
    } else if (success) {
      setNotifications((prev) =>
        prev.filter((notif) => notif.id !== notificationId)
      )
      await refreshUnreadCount()
    }

    return { success, error: err }
  }, [refreshUnreadCount])

  // Delete multiple notifications
  const removeManyNotifications = useCallback(async (notificationIds: string[]) => {
    const { success, error: err } = await deleteMultipleNotifications(notificationIds)

    if (err) {
      setError(err)
    } else if (success) {
      setNotifications((prev) =>
        prev.filter((notif) => !notificationIds.includes(notif.id))
      )
      await refreshUnreadCount()
    }

    return { success, error: err }
  }, [refreshUnreadCount])

  // Delete all read
  const removeAllRead = useCallback(async () => {
    const { success, error: err } = await deleteAllRead()

    if (err) {
      setError(err)
    } else if (success) {
      setNotifications((prev) =>
        prev.filter((notif) => !notif.isRead)
      )
    }

    return { success, error: err }
  }, [])

  // Load notifications on mount
  useEffect(() => {
    if (session.user) {
      loadNotifications()
    }
  }, [session.user, loadNotifications])

  // Subscribe to real-time notifications
  useEffect(() => {
    if (!session.user || !options?.enableRealtime) return

    const subscription = subscribeToNotifications(
      session.user.id,
      (newNotification) => {
        setNotifications((prev) => [newNotification, ...prev])
        setUnreadCount((prev) => prev + 1)
      }
    )

    return () => {
      subscription.unsubscribe()
    }
  }, [session.user, options?.enableRealtime])

  // Auto-refresh unread count
  useEffect(() => {
    if (!session.user || !options?.autoRefresh) return

    const interval = setInterval(() => {
      refreshUnreadCount()
    }, 30000) // Every 30 seconds

    return () => clearInterval(interval)
  }, [session.user, options?.autoRefresh, refreshUnreadCount])

  return {
    notifications,
    unreadCount,
    isLoading,
    error,
    loadNotifications,
    refreshUnreadCount,
    markAsRead: markNotificationAsRead,
    markManyAsRead,
    markAllAsRead: markAllNotificationsAsRead,
    deleteNotification: removeNotification,
    deleteManyNotifications: removeManyNotifications,
    deleteAllRead: removeAllRead,
  }
}

/**
 * Hook for notification badge (just unread count)
 */
export const useNotificationBadge = () => {
  const { session } = useUserStore()
  const [unreadCount, setUnreadCount] = useState(0)

  const refreshCount = useCallback(async () => {
    if (!session.user) return

    const { count } = await getUnreadCount()
    setUnreadCount(count)
  }, [session.user])

  // Initial load
  useEffect(() => {
    if (session.user) {
      refreshCount()
    }
  }, [session.user, refreshCount])

  // Subscribe to real-time updates
  useEffect(() => {
    if (!session.user) return

    const subscription = subscribeToNotifications(
      session.user.id,
      () => {
        setUnreadCount((prev) => prev + 1)
      }
    )

    return () => {
      subscription.unsubscribe()
    }
  }, [session.user])

  // Auto-refresh every 30 seconds
  useEffect(() => {
    if (!session.user) return

    const interval = setInterval(refreshCount, 30000)
    return () => clearInterval(interval)
  }, [session.user, refreshCount])

  return {
    unreadCount,
    refreshCount,
  }
}

/**
 * Hook for single notification
 */
export const useNotification = (notificationId: string) => {
  const { notifications, markAsRead, deleteNotification } = useNotifications()
  
  const notification = notifications.find((n) => n.id === notificationId)

  return {
    notification,
    markAsRead: () => markAsRead(notificationId),
    deleteNotification: () => deleteNotification(notificationId),
  }
}
