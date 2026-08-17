'use client'

import { DirectMessage } from '@/lib/messaging'
import { formatNotificationTime } from '@/lib/notifications'
import { useState } from 'react'
import { getAvatarUrl } from '@/lib/utils/avatar'

interface MessageBubbleProps {
  message: DirectMessage
  isOwnMessage: boolean
  showAvatar?: boolean
  onEdit?: (messageId: string, newContent: string) => void
  onDelete?: (messageId: string) => void
}

export default function MessageBubble({
  message,
  isOwnMessage,
  showAvatar = true,
  onEdit,
  onDelete,
}: MessageBubbleProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editContent, setEditContent] = useState(message.content)
  const [showActions, setShowActions] = useState(false)

  const handleEdit = () => {
    if (onEdit && editContent.trim() !== message.content) {
      onEdit(message.id, editContent.trim())
    }
    setIsEditing(false)
  }

  const handleDelete = () => {
    if (onDelete && confirm('Delete this message?')) {
      onDelete(message.id)
    }
  }

  return (
    <div
      className={`flex items-start gap-2 mb-4 ${isOwnMessage ? 'flex-row-reverse' : 'flex-row'}`}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      {/* Avatar */}
      {showAvatar && (
        <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-blue-500 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
          {message.sender?.avatarUrl || message.sender?.anonymousId ? (
            <img
              src={getAvatarUrl(message.sender?.id || message.sender?.anonymousId || 'anonymous')}
              alt={message.sender?.anonymousId || 'User'}
              className="w-full h-full object-cover rounded-full"
            />
          ) : (
            message.sender?.anonymousId?.charAt(0).toUpperCase() || '?'
          )}
        </div>
      )}

      {/* Message Content */}
      <div className={`flex flex-col ${isOwnMessage ? 'items-end' : 'items-start'} max-w-[70%]`}>
        {/* Sender Name */}
        {!isOwnMessage && (
          <span className="text-xs text-gray-500 dark:text-gray-400 mb-1 px-2">
            {message.sender?.anonymousId}
          </span>
        )}

        {/* Message Bubble */}
        <div className="relative group">
          {isEditing ? (
            <div className="flex flex-col gap-2">
              <textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className="px-4 py-2 rounded-2xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white resize-none"
                rows={3}
                autoFocus
              />
              <div className="flex gap-2">
                <button
                  onClick={handleEdit}
                  className="px-3 py-1 bg-purple-600 text-white rounded-lg text-sm hover:bg-purple-700"
                >
                  Save
                </button>
                <button
                  onClick={() => setIsEditing(false)}
                  className="px-3 py-1 bg-gray-300 dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg text-sm hover:bg-gray-400 dark:hover:bg-gray-600"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div
              className={`px-4 py-2 rounded-2xl ${isOwnMessage
                  ? 'bg-purple-600 text-white'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white'
                }`}
            >
              <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>

              {/* Edited Badge */}
              {message.isEdited && (
                <span className="text-xs opacity-70 ml-2">(edited)</span>
              )}
            </div>
          )}

          {/* Actions Menu */}
          {showActions && isOwnMessage && !isEditing && (
            <div className="absolute top-0 right-full mr-2 flex gap-1">
              {onEdit && (
                <button
                  onClick={() => setIsEditing(true)}
                  className="p-1.5 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600"
                  title="Edit"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                    />
                  </svg>
                </button>
              )}
              {onDelete && (
                <button
                  onClick={handleDelete}
                  className="p-1.5 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-200 dark:hover:bg-red-900/50"
                  title="Delete"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                    />
                  </svg>
                </button>
              )}
            </div>
          )}
        </div>

        {/* Timestamp */}
        <span className="text-xs text-gray-500 dark:text-gray-400 mt-1 px-2">
          {formatNotificationTime(message.createdAt)}
        </span>
      </div>
    </div>
  )
}
