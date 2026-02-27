'use client'

import { Notification, getNotificationIcon, formatNotificationTime } from '@/lib/notifications'
import { useRouter } from 'next/navigation'
import { buildThreadPath } from '@/lib/threads/thread-url'

interface NotificationItemProps {
  notification: Notification
  onMarkAsRead?: () => void
  onDelete?: () => void
}

export default function NotificationItem({
  notification,
  onMarkAsRead,
  onDelete,
}: NotificationItemProps) {
  const router = useRouter()

  const handleClick = () => {
    // Mark as read if unread
    if (!notification.isRead && onMarkAsRead) {
      onMarkAsRead()
    }

    // Navigate based on notification type
    const data = (notification.data || {}) as Record<string, unknown>
    const conversationId =
      (typeof data.conversation_id === 'string' && data.conversation_id) ||
      (typeof data.conversationId === 'string' && data.conversationId) ||
      null
    const threadId = typeof data.thread_id === 'string' ? data.thread_id : null
    const threadTitle =
      (typeof data.thread_title === 'string' && data.thread_title) ||
      (typeof data.threadTitle === 'string' && data.threadTitle) ||
      undefined
    const groupId = typeof data.group_id === 'string' ? data.group_id : null

    if (threadId) {
      router.push(buildThreadPath({ id: threadId, title: threadTitle }))
    } else if (conversationId) {
      router.push(`/inbox?conversationId=${encodeURIComponent(conversationId)}`)
    } else if (groupId) {
      router.push(`/groups/${groupId}`)
    }
  }

  return (
    <div
      className={`p-4 border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors cursor-pointer ${
        !notification.isRead ? 'bg-blue-50 dark:bg-blue-900/10' : ''
      }`}
      onClick={handleClick}
    >
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className="flex-shrink-0 text-2xl mt-0.5">
          {getNotificationIcon(notification.type)}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
              {notification.title}
            </h4>
            {!notification.isRead && (
              <span className="flex-shrink-0 w-2 h-2 bg-blue-500 rounded-full mt-1.5" />
            )}
          </div>

          <p className="mt-1 text-sm text-gray-600 dark:text-gray-300 line-clamp-2">
            {notification.message}
          </p>

          <div className="mt-2 flex items-center justify-between">
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {formatNotificationTime(notification.createdAt)}
            </span>

            {/* Actions */}
            <div className="flex items-center gap-2">
              {!notification.isRead && onMarkAsRead && (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    onMarkAsRead()
                  }}
                  className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                >
                  Mark as read
                </button>
              )}

              {onDelete && (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    onDelete()
                  }}
                  className="text-xs text-red-600 dark:text-red-400 hover:underline"
                >
                  Delete
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
