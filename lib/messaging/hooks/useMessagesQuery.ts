'use client'

import { useInfiniteQuery } from '@tanstack/react-query'
import { queryKeys } from '@/lib/react-query/queryKeys'
import { fetchMessages, DirectMessage } from '@/lib/messaging/messaging-service'
import { useRealtimeSync } from '@/lib/react-query/realtime'

/**
 * React Query infinite query hook for conversation messages
 * Supports pagination and real-time updates
 * 
 * @param conversationId ID of the conversation
 * @param options Configuration options
 */
interface UseMessagesQueryOptions {
  /** Number of messages per page (default: 50) */
  limit?: number
  
  /** Enable real-time synchronization (default: true) */
  enableRealtime?: boolean
  
  /** Enable query (default: true if conversationId exists) */
  enabled?: boolean
}

export function useMessagesQuery(
  conversationId: string | undefined,
  options: UseMessagesQueryOptions = {}
) {
  const {
    limit = 50,
    enableRealtime = true,
    enabled = true,
  } = options

  const query = useInfiniteQuery({
    queryKey: queryKeys.conversations.messages(conversationId || ''),
    queryFn: async ({ pageParam = 0 }) => {
      if (!conversationId) {
        throw new Error('Conversation ID is required')
      }
      
      const result = await fetchMessages(conversationId, {
        limit,
        offset: pageParam,
      })
      
      if (result.error) {
        throw new Error(result.error)
      }
      
      return {
        messages: result.data,
        nextOffset: result.data.length === limit ? pageParam + limit : undefined,
      }
    },
    getNextPageParam: (lastPage) => lastPage.nextOffset,
    enabled: enabled && !!conversationId,
    staleTime: 10 * 1000, // 10 seconds (messages change frequently)
    refetchOnWindowFocus: true,
    initialPageParam: 0,
  })

  // Set up real-time sync for messages
  if (enableRealtime && conversationId) {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useRealtimeSync({
      table: 'direct_messages',
      event: '*',
      queryKey: queryKeys.conversations.messages(conversationId),
      filter: `conversation_id=eq.${conversationId}`,
      schema: 'public',
    })

    // Also listen for read receipt updates
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useRealtimeSync({
      table: 'message_read_receipts',
      event: '*',
      queryKey: queryKeys.conversations.messages(conversationId),
      schema: 'public',
    })
  }

  // Flatten all pages into single array
  const allMessages = query.data?.pages.flatMap((page) => page.messages) || []

  return {
    messages: allMessages,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    hasNextPage: query.hasNextPage,
    fetchNextPage: query.fetchNextPage,
    isFetchingNextPage: query.isFetchingNextPage,
    refetch: query.refetch,
  }
}
