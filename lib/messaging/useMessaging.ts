import { useState, useEffect, useCallback, useRef } from 'react'
import {
  fetchConversations,
  fetchConversationById,
  fetchMessages,
  sendMessage,
  editMessage,
  deleteMessage,
  markConversationRead,
  createReadReceipt,
  toggleMuteConversation,
  getUnreadCount,
  subscribeToMessages,
  subscribeToConversations,
  getOrCreateConversation,
  Conversation,
  DirectMessage,
  DMMessageType,
} from './messaging-service'
import { useUserStore } from '@/store/userStore'
import { subscribeToTable } from '@/lib/core/supabase/raw-realtime'

/**
 * Hook for managing conversations list
 */
import { useConversationStore } from '@/store/conversationStore'

/**
 * Hook for managing conversations list
 */
export const useConversations = (options?: {
  autoRefresh?: boolean
  enableRealtime?: boolean
}) => {
  const { session } = useUserStore()
  const userId = session.user?.id
  
  // Use global store
  const { 
    conversations, 
    unreadCount, 
    isLoading, 
    error,
    hasLoaded,
    syncConversations, 
    syncUnreadCount,
    reset 
  } = useConversationStore()

  // Load conversations
  const loadConversations = useCallback(async (options?: { silent?: boolean }) => {
    if (!userId) return

    // If we have loaded before, default to silent unless forced otherwise
    // This effectively prevents the spinner on remounts!
    const shouldUseSilent = options?.silent ?? hasLoaded
    
    await syncConversations(shouldUseSilent)
  }, [userId, hasLoaded, syncConversations])

  // Refresh unread count
  const refreshUnreadCount = useCallback(async () => {
    if (!userId) return
    await syncUnreadCount()
  }, [userId, syncUnreadCount])

  // Start conversation with user
  const startConversation = useCallback(async (otherUserId: string) => {
    // ... logic remains similar but triggers store sync
    // We can keep local error state for this specific action if needed, or use store error?
    // Let's keep local error for startConversation specific errors
    
    const { data, error: err } = await getOrCreateConversation(otherUserId)

    if (err) {
      return { data: null, error: err }
    }

    // Refresh conversations list silently
    await loadConversations({ silent: true })

    return { data, error: null }
  }, [loadConversations])

  // Sync on mount / userId change
  useEffect(() => {
    if (userId) {
      // Intelligently load: if store has data, it will be silent (via loadConversations logic)
      // If store is empty, it will show loading.
      loadConversations()
      refreshUnreadCount()
    } else {
      // User logged out or no user - reset store
      reset()
    }
  }, [userId, loadConversations, refreshUnreadCount, reset])

  // Subscribe to real-time updates
  useEffect(() => {
    if (!userId || !options?.enableRealtime) return

    const subscription = subscribeToConversations(
      userId,
      () => {
        // Use silent refresh for real-time updates
        loadConversations({ silent: true })
        refreshUnreadCount()
      }
    )

    return () => {
      subscription.unsubscribe()
    }
  }, [userId, options?.enableRealtime, loadConversations, refreshUnreadCount])

  // Auto-refresh
  useEffect(() => {
    if (!userId || !options?.autoRefresh) return

    const interval = setInterval(() => {
      refreshUnreadCount()
    }, 30000) // Every 30 seconds

    return () => clearInterval(interval)
  }, [userId, options?.autoRefresh, refreshUnreadCount])

  return {
    conversations,
    unreadCount,
    isLoading,
    error,
    loadConversations,
    refreshUnreadCount,
    startConversation,
  }
}

/**
 * Hook for managing a single conversation
 */
export const useConversation = (conversationId: string, options?: {
  autoMarkRead?: boolean
  enableRealtime?: boolean
}) => {
  const { session } = useUserStore()
  const [conversation, setConversation] = useState<Conversation | null>(null)
  const [messages, setMessages] = useState<DirectMessage[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(true)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Load conversation details
  const loadConversation = useCallback(async () => {
    if (!conversationId) return

    const { data, error: err } = await fetchConversationById(conversationId)

    if (err) {
      setError(err)
    } else {
      setConversation(data)
    }
  }, [conversationId])

  // Load messages
  const loadMessages = useCallback(async (options?: {
    limit?: number
    offset?: number
    append?: boolean
  }) => {
    if (!conversationId) return

    setIsLoading(true)
    setError(null)

    const { data, error: err } = await fetchMessages(conversationId, {
      limit: options?.limit || 50,
      offset: options?.offset || 0,
    })

    if (err) {
      setError(err)
    } else {
      if (options?.append) {
        setMessages((prev) => [...prev, ...data])
      } else {
        setMessages(data.reverse()) // Reverse to show oldest first
      }

      setHasMore(data.length === (options?.limit || 50))
    }

    setIsLoading(false)
  }, [conversationId])

  // Load more messages (pagination)
  const loadMoreMessages = useCallback(async () => {
    if (!hasMore || isLoading) return

    await loadMessages({
      limit: 50,
      offset: messages.length,
      append: true,
    })
  }, [hasMore, isLoading, messages.length, loadMessages])

  // Send message
  const send = useCallback(async (
    content: string,
    messageType: DMMessageType = 'text',
    attachmentUrl?: string
  ) => {
    if (!conversationId) return { success: false, error: 'No conversation ID' }

    setIsSending(true)
    setError(null)

    const { data, error: err } = await sendMessage(
      conversationId,
      content,
      messageType,
      attachmentUrl
    )

    if (err) {
      setError(err)
      setIsSending(false)
      return { success: false, error: err }
    }

    // Message will be added via real-time subscription
    // Or manually add if not using real-time
    if (!options?.enableRealtime && data) {
      setMessages((prev) => [...prev, data])
    }

    setIsSending(false)
    return { success: true, error: null }
  }, [conversationId, options?.enableRealtime])

  // Edit message
  const edit = useCallback(async (messageId: string, newContent: string) => {
    const { success, error: err } = await editMessage(messageId, newContent)

    if (err) {
      setError(err)
    } else if (success) {
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === messageId
            ? { ...msg, content: newContent, isEdited: true }
            : msg
        )
      )
    }

    return { success, error: err }
  }, [])

  // Delete message
  const remove = useCallback(async (messageId: string) => {
    const { success, error: err } = await deleteMessage(messageId)

    if (err) {
      setError(err)
    } else if (success) {
      setMessages((prev) => prev.filter((msg) => msg.id !== messageId))
    }

    return { success, error: err }
  }, [])

  // Mark as read
  const markRead = useCallback(async () => {
    if (!conversationId) return

    await markConversationRead(conversationId)
  }, [conversationId])

  // Toggle mute
  const toggleMute = useCallback(async (isMuted: boolean) => {
    if (!conversationId) return

    const { success, error: err } = await toggleMuteConversation(conversationId, isMuted)

    if (success) {
      setConversation((prev) =>
        prev
          ? {
              ...prev,
              participants: prev.participants?.map((p) =>
                p.userId === session.user?.id ? { ...p, isMuted } : p
              ),
            }
          : null
      )
    }

    return { success, error: err }
  }, [conversationId, session.user])

  // Scroll to bottom
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  // Load conversation and messages on mount
  useEffect(() => {
    if (conversationId) {
      loadConversation()
      loadMessages()
    }
  }, [conversationId, loadConversation, loadMessages])

  // Auto mark as read
  useEffect(() => {
    if (conversationId && options?.autoMarkRead && messages.length > 0) {
      markRead()
    }
  }, [conversationId, options?.autoMarkRead, messages.length, markRead])

  // Subscribe to real-time messages
  useEffect(() => {
    if (!conversationId || !options?.enableRealtime) return

    const subscription = subscribeToMessages(conversationId, (newMessage) => {
      setMessages((prev) => {
        // Avoid duplicates
        if (prev.some((msg) => msg.id === newMessage.id)) {
          return prev
        }
        return [...prev, newMessage]
      })

      // Auto-scroll to new message
      setTimeout(scrollToBottom, 100)

      // Auto-mark as read if not from current user
      if (newMessage.senderId !== session.user?.id && options.autoMarkRead) {
        createReadReceipt(newMessage.id)
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [conversationId, options?.enableRealtime, options?.autoMarkRead, session.user, scrollToBottom])

  // Get other participant (for 1-on-1 chats)
  const otherParticipant = conversation?.participants?.find(
    (p) => p.userId !== session.user?.id
  )

  return {
    conversation,
    messages,
    otherParticipant,
    isLoading,
    isSending,
    hasMore,
    error,
    loadConversation,
    loadMessages,
    loadMoreMessages,
    sendMessage: send,
    editMessage: edit,
    deleteMessage: remove,
    markAsRead: markRead,
    toggleMute,
    scrollToBottom,
    messagesEndRef,
  }
}

/**
 * Hook for unread message badge
 */
export const useMessageBadge = () => {
  const { session } = useUserStore()
  const [unreadCount, setUnreadCount] = useState(0)

  const refreshCount = useCallback(async () => {
    if (!session.user) {
      setUnreadCount(0)
      return
    }

    const { count } = await getUnreadCount()
    setUnreadCount(count || 0)
  }, [session.user])

  // Initial load
  useEffect(() => {
    if (session.user) {
      refreshCount()
    }
  }, [session.user, refreshCount])

  // Subscribe to updates
  useEffect(() => {
    if (!session.user) return

    const subscription = subscribeToConversations(
      session.user.id,
      refreshCount
    )

    const unsubscribeParticipants = subscribeToTable('conversation_participants', {
      event: 'UPDATE',
      schema: 'public',
      onChange: () => {
        refreshCount()
      },
    })

    return () => {
      subscription.unsubscribe()
      unsubscribeParticipants()
    }
  }, [session.user, refreshCount])

  // Auto-refresh
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
