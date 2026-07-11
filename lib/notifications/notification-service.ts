import * as rawDb from '@/lib/core/supabase/raw-db'
import * as rawAuth from '@/lib/core/supabase/raw-auth'
import * as rawRealtime from '@/lib/core/supabase/raw-realtime'

/**
 * Notification Service
 * Handles all notification-related operations (Migrated to use Raw Utils)
 */

export type NotificationType = 
  | 'thread_like'
  | 'thread_message'
  | 'direct_message'
  | 'message_reply'
  | 'mention'
  | 'group_invite'
  | 'thread_invite'
  | 'poll_ending_soon'
  | 'thread_expiring_soon'

export type NotificationCategory = 'all' | 'interactions' | 'system' | 'social'

export interface Notification {
  id: string
  userId: string
  type: NotificationType
  category: NotificationCategory
  title: string
  message: string
  data: Record<string, any>
  isRead: boolean
  createdAt: string
}

export interface NotificationPreferences {
  userId: string
  enableThreadLikes: boolean
  enableMessageReplies: boolean
  enableMentions: boolean
  enableGroupInvites: boolean
  enablePollReminders: boolean
  enableThreadReminders: boolean
  enablePushNotifications: boolean
  enableEmailNotifications: boolean
}

/**
 * Fetch notifications for current user
 */
export const fetchNotifications = async (
  filters?: {
    category?: NotificationCategory
    isRead?: boolean
    limit?: number
    offset?: number
  }
): Promise<{ data: Notification[]; error: string | null; unreadCount: number }> => {
  try {
    const session = rawAuth.getSession();
    const user = session?.user;

    if (!user) {
      return { data: [], error: 'User not authenticated', unreadCount: 0 }
    }

    const queryFilters: Record<string, any> = {
      'user_id': rawDb.filter.eq(user.id)
    };

    // Apply filters
    if (filters?.category && filters.category !== 'all') {
      queryFilters['category'] = rawDb.filter.eq(filters.category);
    }

    if (filters?.isRead !== undefined) {
      queryFilters['is_read'] = rawDb.filter.eq(filters.isRead);
    }

    const { data: notificationsData, error: fetchError } = await rawDb.select<any[]>('notifications', {
      filters: queryFilters,
      order: { column: 'created_at', ascending: false },
      limit: filters?.limit,
      offset: filters?.offset
    });

    if (fetchError) {
      throw fetchError;
    }

    // Get unread count
    const { count: unreadCount } = await rawDb.select<any[]>('notifications', {
        select: 'id', // Just select ID to minimize data
        filters: {
            'user_id': rawDb.filter.eq(user.id),
            'is_read': rawDb.filter.eq(false)
        },
        // TODO: rawDb needs a count generic options? 
        // For now, selecting all IDs and counting locally is okay for small scale, 
        // but rawDb should support COUNT. 
        // Standard select returns DbResponse with count property if requested?
        // rawDb implementation returns DbResponse { count?: number }.
        // But select function implementation doesn't seem to set count unless header applied?
        // rawDb 'select' sets 'Prefer: return=representation'.
        // To get count, we need 'Prefer: count=exact'.
        // raw-db.ts doesn't expose this yet.
        // We will just fetching IDs and counting length for now.
    });
    // Actually, rawDb.select returns data array.
    // If we select('id'), data is array of objects {id: ...}.
    // unreadCount is data.length.
    const actualUnreadCount = unreadCount ? 0 : (await rawDb.select<any[]>('notifications', {
        select: 'id',
        filters: {
            'user_id': rawDb.filter.eq(user.id),
            'is_read': rawDb.filter.eq(false)
        }
    })).data?.length || 0;

    // Transform data to Notification type (camelCase)
    const notifications: Notification[] = (notificationsData || []).map((n: any) => ({
      id: n.id,
      userId: n.user_id,
      type: n.type,
      category: n.category,
      title: n.title,
      message: n.message,
      data: n.data,
      isRead: n.is_read,
      createdAt: n.created_at
    }));

    return { data: notifications, error: null, unreadCount: actualUnreadCount }
  } catch (error: any) {
    console.error('Fetch notifications error:', error)
    return { data: [], error: error.message || 'Failed to fetch notifications', unreadCount: 0 }
  }
}

/**
 * Get unread notification count
 */
export const getUnreadCount = async (): Promise<{ count: number; error: string | null }> => {
  try {
    const session = rawAuth.getSession();
    const user = session?.user;

    if (!user) {
      return { count: 0, error: 'User not authenticated' }
    }

    const { data: unreadData, error } = await rawDb.select<any[]>('notifications', {
        select: 'id',
        filters: {
            'user_id': rawDb.filter.eq(user.id),
            'is_read': rawDb.filter.eq(false)
        }
    });

    if (error) {
      throw error
    }

    return { count: unreadData?.length || 0, error: null }
  } catch (error: any) {
    console.error('Get unread count error:', error)
    return { count: 0, error: error.message || 'Failed to get unread count' }
  }
}

/**
 * Mark notification as read
 */
export const markAsRead = async (
  notificationId: string
): Promise<{ success: boolean; error: string | null }> => {
  try {
    const { error } = await rawDb.update(
        'notifications',
        { is_read: true },
        { 'id': rawDb.filter.eq(notificationId) }
    );

    if (error) {
      throw error
    }

    return { success: true, error: null }
  } catch (error: any) {
    console.error('Mark as read error:', error)
    return { success: false, error: error.message || 'Failed to mark as read' }
  }
}

/**
 * Mark multiple notifications as read
 */
export const markMultipleAsRead = async (
  notificationIds: string[]
): Promise<{ success: boolean; error: string | null }> => {
  try {
    const { error } = await rawDb.update(
        'notifications',
        { is_read: true },
        { 'id': rawDb.filter.in(notificationIds) }
    );

    if (error) {
      throw error
    }

    return { success: true, error: null }
  } catch (error: any) {
    console.error('Mark multiple as read error:', error)
    return { success: false, error: error.message || 'Failed to mark as read' }
  }
}

/**
 * Mark all notifications as read
 */
export const markAllAsRead = async (): Promise<{ success: boolean; error: string | null }> => {
  try {
    const session = rawAuth.getSession();
    const user = session?.user;

    if (!user) {
      return { success: false, error: 'User not authenticated' }
    }

    const { error } = await rawDb.update(
        'notifications',
        { is_read: true },
        { 
            'user_id': rawDb.filter.eq(user.id),
            'is_read': rawDb.filter.eq(false)
        }
    );

    if (error) {
      throw error
    }

    return { success: true, error: null }
  } catch (error: any) {
    console.error('Mark all as read error:', error)
    return { success: false, error: error.message || 'Failed to mark all as read' }
  }
}

/**
 * Delete notification
 */
export const deleteNotification = async (
  notificationId: string
): Promise<{ success: boolean; error: string | null }> => {
  try {
    const { error } = await rawDb.remove(
        'notifications',
        { 'id': rawDb.filter.eq(notificationId) }
    );

    if (error) {
      throw error
    }

    return { success: true, error: null }
  } catch (error: any) {
    console.error('Delete notification error:', error)
    return { success: false, error: error.message || 'Failed to delete notification' }
  }
}

/**
 * Delete multiple notifications
 */
export const deleteMultipleNotifications = async (
  notificationIds: string[]
): Promise<{ success: boolean; error: string | null }> => {
  try {
    const { error } = await rawDb.remove(
        'notifications',
        { 'id': rawDb.filter.in(notificationIds) }
    );

    if (error) {
      throw error
    }

    return { success: true, error: null }
  } catch (error: any) {
    console.error('Delete multiple notifications error:', error)
    return { success: false, error: error.message || 'Failed to delete notifications' }
  }
}

/**
 * Delete all read notifications
 */
export const deleteAllRead = async (): Promise<{ success: boolean; error: string | null }> => {
  try {
    const session = rawAuth.getSession();
    const user = session?.user;

    if (!user) {
      return { success: false, error: 'User not authenticated' }
    }

    const { error } = await rawDb.remove(
        'notifications',
        { 
            'user_id': rawDb.filter.eq(user.id),
            'is_read': rawDb.filter.eq(true)
        }
    );

    if (error) {
      throw error
    }

    return { success: true, error: null }
  } catch (error: any) {
    console.error('Delete all read error:', error)
    return { success: false, error: error.message || 'Failed to delete all read notifications' }
  }
}

/**
 * Create manual notification (for testing or admin use)
 */
export const createNotification = async (
  notification: {
    userId: string
    type: NotificationType
    category: NotificationCategory
    title: string
    message: string
    data?: Record<string, any>
  }
): Promise<{ data: Notification | null; error: string | null }> => {
  try {
    const { data: resultData, error } = await rawDb.insert(
        'notifications',
        {
            user_id: notification.userId,
            type: notification.type,
            category: notification.category,
            title: notification.title,
            message: notification.message,
            data: notification.data || {},
        },
        { returning: true }
    );

    if (error) {
      throw error
    }

    const created = resultData && resultData[0];
    const data: Notification | null = created ? {
        id: created.id,
        userId: created.user_id,
        type: created.type,
        category: created.category,
        title: created.title,
        message: created.message,
        data: created.data,
        isRead: created.is_read,
        createdAt: created.created_at
    } : null;

    return { data, error: null }
  } catch (error: any) {
    console.error('Create notification error:', error)
    return { data: null, error: error.message || 'Failed to create notification' }
  }
}

/**
 * Subscribe to real-time notifications
 */
export const subscribeToNotifications = (
  userId: string,
  callback: (notification: Notification) => void
) => {
  const channel = rawRealtime.createChannel({
      channelName: `notifications:${userId}`,
      config: {
          postgres_changes: [{
              event: 'INSERT',
              schema: 'public',
              table: 'notifications',
              filter: `user_id=eq.${userId}`
          }]
      },
      onPostgresChange: (change) => {
          if (change.type === 'INSERT' && change.record) {
              const n = change.record;
              callback({
                  id: n.id,
                  userId: n.user_id,
                  type: n.type,
                  category: n.category,
                  title: n.title,
                  message: n.message,
                  data: n.data,
                  isRead: n.is_read,
                  createdAt: n.created_at
              });
          }
      }
  });

  channel.subscribe();

  return {
    unsubscribe: () => {
      channel.unsubscribe()
    },
  }
}

/**
 * Get notification icon based on type
 */
export const getNotificationIcon = (type: NotificationType): string => {
  switch (type) {
    case 'thread_like':
      return '\u{2764}\u{FE0F}'
    case 'thread_message':
      return '\u{1F4E8}'
    case 'direct_message':
      return '\u{1F4E8}'
    case 'message_reply':
      return '\u{1F4AC}'
    case 'mention':
      return '\u{1F44B}'
    case 'group_invite':
      return '\u{1F3AB}'
    case 'thread_invite':
      return '\u{1F3AB}'
    case 'poll_ending_soon':
      return '\u{23F0}'
    case 'thread_expiring_soon':
      return '\u{231B}'
    default:
      return '\u{1F514}'
  }
}

/**
 * Get notification color based on type
 */
export const getNotificationColor = (type: NotificationType): string => {
  switch (type) {
    case 'thread_like':
      return 'text-red-500'
    case 'thread_message':
      return 'text-blue-500'
    case 'direct_message':
      return 'text-blue-500'
    case 'message_reply':
      return 'text-blue-500'
    case 'mention':
      return 'text-purple-500'
    case 'group_invite':
      return 'text-green-500'
    case 'thread_invite':
      return 'text-purple-500'
    case 'poll_ending_soon':
      return 'text-orange-500'
    case 'thread_expiring_soon':
      return 'text-orange-500'
    default:
      return 'text-gray-500'
  }
}

/**
 * Format notification time (relative)
 */
export const formatNotificationTime = (createdAt: string): string => {
  const now = new Date()
  const created = new Date(createdAt)
  const diffMs = now.getTime() - created.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  
  return created.toLocaleDateString()
}






