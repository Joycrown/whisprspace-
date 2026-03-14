'use client'

import { useCallback, useEffect, useRef } from 'react'
import { useQuery, UseQueryOptions } from '@tanstack/react-query'
import { queryKeys } from '@/lib/react-query/queryKeys'
import { fetchConversations, Conversation } from '@/lib/messaging/messaging-service'
import { useRealtimeSync } from '@/lib/react-query/realtime'
import { useUserStore } from '@/store/userStore'

/**
 * React Query hook for fetching conversations list
 * 
 * Features:
 * - Automatic caching with sensible stale time
 * - Realtime-first refresh strategy
 * - Optional real-time sync
 * 
 * @param options Configuration options
 * @returns Query result with conversations data
 */
interface UseConversationsQueryOptions {
  /** Enable real-time synchronization (default: true) */
  enableRealtime?: boolean
  
  /** Auto refresh interval in ms (default: none) */
  autoRefreshInterval?: number
  
  /** Additional React Query options */
  queryOptions?: Omit<UseQueryOptions<Conversation[], Error>, 'queryKey' | 'queryFn'>
}

interface UseUnreadCountQueryOptions {
  enabled?: boolean
  enableRealtime?: boolean
  enableDirectMessagesRealtime?: boolean
  refetchInterval?: number | false
}

export function useConversationsQuery(options: UseConversationsQueryOptions = {}) {
  const { session } = useUserStore()
  const isAuthed = Boolean(session.user)
  const userId = session.user?.id
  const {
    enableRealtime = true,
    autoRefreshInterval,
    queryOptions = {},
  } = options
  const { enabled: queryOptionsEnabled = true, ...restQueryOptions } = queryOptions
  const queryEnabled = Boolean(queryOptionsEnabled && isAuthed)

  // Fetch conversations using React Query
  const query = useQuery({
    queryKey: queryKeys.conversations.lists(),
    queryFn: async () => {
      const result = await fetchConversations()
      
      if (result.error) {
        throw new Error(result.error)
      }
      
      return result.data
    },
    // Realtime keeps this fresh; avoid aggressive refetch churn.
    staleTime: 10 * 1000, // 10 seconds is plenty for a list that is shared across pages.
    refetchOnWindowFocus: false,
    refetchInterval: enableRealtime ? false : autoRefreshInterval,
    placeholderData: (previousData) => previousData,
    enabled: queryEnabled,
    ...restQueryOptions,
  })
  const refetchConversations = query.refetch

  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const scheduleRealtimeRefresh = useCallback(() => {
    if (refreshTimerRef.current) return
    refreshTimerRef.current = setTimeout(() => {
      refreshTimerRef.current = null
      refetchConversations()
    }, 120)
  }, [refetchConversations])

  useEffect(() => {
    return () => {
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current)
        refreshTimerRef.current = null
      }
    }
  }, [])

  useRealtimeSync({
    table: 'direct_messages',
    event: '*',
    queryKey: queryKeys.conversations.lists(),
    schema: 'public',
    invalidateQuery: false,
    enabled: enableRealtime && queryEnabled,
    onPayload: () => {
      scheduleRealtimeRefresh()
    },
  })

  useRealtimeSync({
    table: 'conversation_participants',
    event: '*',
    queryKey: queryKeys.conversations.lists(),
    schema: 'public',
    filter: userId ? `user_id=eq.${userId}` : undefined,
    invalidateQuery: false,
    enabled: enableRealtime && queryEnabled,
    onPayload: () => {
      scheduleRealtimeRefresh()
    },
  })

  return {
    conversations: query.data || [],
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
    isFetching: query.isFetching,
  }
}

/**
 * Hook for fetching unread conversation count
 */
export function useUnreadCountQuery(options: UseUnreadCountQueryOptions = {}) {
  const { session } = useUserStore()
  const userId = session.user?.id
  const isAuthed = Boolean(session.user)
  const queryEnabled = Boolean(options.enabled ?? true) && isAuthed
  const enableRealtime = options.enableRealtime ?? false
  const enableDirectMessagesRealtime = options.enableDirectMessagesRealtime ?? false
  const refetchInterval = options.refetchInterval ?? 30000

  const query = useQuery({
    queryKey: queryKeys.conversations.unreadCount(),
    queryFn: async () => {
      // Import dynamically to avoid circular dependency
      const { getUnreadCount } = await import('@/lib/messaging/messaging-service')
      const result = await getUnreadCount()
      
      if (result.error) {
        throw new Error(result.error)
      }
      
      return result.count
    },
    staleTime: 10 * 1000,
    refetchOnWindowFocus: false,
    refetchInterval,
    enabled: queryEnabled,
  })

  // Real-time sync for unread count
  useRealtimeSync({
    table: 'direct_messages',
    event: 'INSERT',
    queryKey: queryKeys.conversations.unreadCount(),
    schema: 'public',
    enabled: queryEnabled && enableRealtime && enableDirectMessagesRealtime,
  })

  // Also refresh unread count when read state changes
  useRealtimeSync({
    table: 'conversation_participants',
    event: 'UPDATE',
    queryKey: queryKeys.conversations.unreadCount(),
    schema: 'public',
    filter: userId ? `user_id=eq.${userId}` : undefined,
    enabled: queryEnabled && enableRealtime && !!userId,
  })

  return {
    unreadCount: query.data || 0,
    isLoading: query.isLoading,
    refetch: query.refetch,
  }
}
