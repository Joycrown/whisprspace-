'use client'

import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/lib/react-query/queryKeys'
import { fetchConversationById } from '@/lib/messaging/messaging-service'
import { useRealtimeSync } from '@/lib/react-query/realtime'

/**
 * React Query hook for fetching a single conversation
 * 
 * @param conversationId ID of the conversation to fetch
 * @param options Configuration options
 */
interface UseConversationQueryOptions {
  /** Enable real-time synchronization (default: true) */
  enableRealtime?: boolean
  
  /** Enable query (default: true if conversationId exists) */
  enabled?: boolean
}

export function useConversationQuery(
  conversationId: string | undefined,
  options: UseConversationQueryOptions = {}
) {
  const {
    enableRealtime = true,
    enabled = true,
  } = options

  const query = useQuery({
    queryKey: queryKeys.conversations.detail(conversationId || ''),
    queryFn: async () => {
      if (!conversationId) {
        throw new Error('Conversation ID is required')
      }
      
      const result = await fetchConversationById(conversationId)
      
      if (result.error) {
        throw new Error(result.error)
      }
      
      if (!result.data) {
        throw new Error('Conversation not found')
      }
      
      return result.data
    },
    enabled: enabled && !!conversationId,
    staleTime: 30 * 1000, // 30 seconds
    refetchOnWindowFocus: true,
  })

  const realtimeEnabled = Boolean(enableRealtime && enabled && conversationId)

  useRealtimeSync({
    table: 'direct_messages',
    event: '*',
    queryKey: queryKeys.conversations.detail(conversationId || ''),
    filter: conversationId ? `conversation_id=eq.${conversationId}` : undefined,
    schema: 'public',
    enabled: realtimeEnabled,
  })

  return {
    conversation: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  }
}
