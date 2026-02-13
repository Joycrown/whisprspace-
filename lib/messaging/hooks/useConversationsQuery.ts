'use client'

import { useQuery, UseQueryOptions } from '@tanstack/react-query'
import { queryKeys } from '@/lib/react-query/queryKeys'
import { fetchConversations, Conversation } from '@/lib/messaging/messaging-service'
import { useRealtimeSync } from '@/lib/react-query/realtime'
import { useUserStore } from '@/store/userStore'

/**
 * React Query hook for fetching conversations list
 * 
 * Features:
 * - Automatic caching with 30s stale time
 * - Background refetching on window focus
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

export function useConversationsQuery(options: UseConversationsQueryOptions = {}) {
  const { session } = useUserStore()
  const isAuthed = Boolean(session.user)
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
    // Conversations are relatively dynamic, keep stale time short
    staleTime: 30 * 1000, // 30 seconds
    refetchOnWindowFocus: true,
    refetchInterval: autoRefreshInterval,
    enabled: queryEnabled,
    ...restQueryOptions,
  })

  useRealtimeSync({
    table: 'direct_messages',
    event: '*',
    queryKey: queryKeys.conversations.lists(),
    schema: 'public',
    enabled: enableRealtime && queryEnabled,
  })

  useRealtimeSync({
    table: 'conversation_participants',
    event: '*',
    queryKey: queryKeys.conversations.lists(),
    schema: 'public',
    enabled: enableRealtime && queryEnabled,
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
export function useUnreadCountQuery() {
  const { session } = useUserStore()
  const isAuthed = Boolean(session.user)

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
    staleTime: 15 * 1000, // 15 seconds
    refetchInterval: 30 * 1000, // Refetch every 30 seconds
    enabled: isAuthed,
  })

  // Real-time sync for unread count
  useRealtimeSync({
    table: 'direct_messages',
    event: 'INSERT',
    queryKey: queryKeys.conversations.unreadCount(),
    schema: 'public',
    enabled: isAuthed,
  })

  // Also refresh unread count when read state changes
  useRealtimeSync({
    table: 'conversation_participants',
    event: 'UPDATE',
    queryKey: queryKeys.conversations.unreadCount(),
    schema: 'public',
    enabled: isAuthed,
  })

  return {
    unreadCount: query.data || 0,
    isLoading: query.isLoading,
    refetch: query.refetch,
  }
}
