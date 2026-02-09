'use client'

import { useConversations } from '@/lib/messaging'
import { formatNotificationTime } from '@/lib/notifications'
import { useRouter } from 'next/navigation'

interface ConversationsListProps {
  onSelectConversation?: (conversationId: string) => void
  selectedConversationId?: string
}

export default function ConversationsList({
  onSelectConversation,
  selectedConversationId,
}: ConversationsListProps) {
  const router = useRouter()
  const { conversations, unreadCount, isLoading, startConversation } = useConversations({
    enableRealtime: true,
    autoRefresh: true,
  })

  const handleSelect = (conversationId: string) => {
    if (onSelectConversation) {
      onSelectConversation(conversationId)
    } else {
      router.push(`/messages/${conversationId}`)
    }
  }

  if (isLoading && conversations.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-gray-500 dark:text-gray-400">Loading conversations...</div>
      </div>
    )
  }

  if (conversations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center">
        <svg
          className="w-16 h-16 text-gray-400 dark:text-gray-600 mb-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
          />
        </svg>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          No conversations yet
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Start a conversation with someone from a thread!
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">
          Messages
          {unreadCount > 0 && (
            <span className="ml-2 px-2 py-0.5 text-xs bg-red-500 text-white rounded-full">
              {unreadCount}
            </span>
          )}
        </h2>
      </div>

      {/* Conversations List */}
      <div className="flex-1 overflow-y-auto">
        {conversations.map((conversation) => {
          const otherParticipant = conversation.participants?.find(
            (p) => p.userId !== conversation.participants?.[0]?.userId
          )
          const isUnread = (conversation.unreadCount || 0) > 0
          const isSelected = conversation.id === selectedConversationId

          return (
            <div
              key={conversation.id}
              onClick={() => handleSelect(conversation.id)}
              className={`p-4 border-b border-gray-200 dark:border-gray-700 cursor-pointer transition-colors ${
                isSelected
                  ? 'bg-purple-50 dark:bg-purple-900/20'
                  : 'hover:bg-gray-50 dark:hover:bg-gray-800'
              } ${isUnread ? 'bg-blue-50 dark:bg-blue-900/10' : ''}`}
            >
              <div className="flex items-start gap-3">
                {/* Avatar */}
                <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-blue-500 rounded-full flex items-center justify-center text-white text-lg font-bold flex-shrink-0">
                  {otherParticipant?.user?.avatarUrl ? (
                    <img
                      src={otherParticipant.user.avatarUrl}
                      alt={otherParticipant.user.anonymousId}
                      className="w-full h-full object-cover rounded-full"
                    />
                  ) : (
                    otherParticipant?.user?.anonymousId?.charAt(0).toUpperCase() || '?'
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <h3 className="font-semibold text-gray-900 dark:text-white truncate">
                      {otherParticipant?.user?.anonymousId || 'Anonymous User'}
                    </h3>
                    {conversation.lastMessage && (
                      <span className="text-xs text-gray-500 dark:text-gray-400 flex-shrink-0">
                        {formatNotificationTime(conversation.lastMessage.createdAt)}
                      </span>
                    )}
                  </div>

                  {conversation.lastMessage && (
                    <div className="flex items-center justify-between gap-2">
                      <p
                        className={`text-sm truncate ${
                          isUnread
                            ? 'text-gray-900 dark:text-white font-medium'
                            : 'text-gray-500 dark:text-gray-400'
                        }`}
                      >
                        {conversation.lastMessage.senderId === conversation.participants?.[0]?.userId
                          ? 'You: '
                          : ''}
                        {conversation.lastMessage.content}
                      </p>
                      {isUnread && (
                        <span className="flex-shrink-0 w-2 h-2 bg-blue-500 rounded-full" />
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
