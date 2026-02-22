'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/lib/react-query/queryKeys'
import { fetchConversationById, Conversation } from '@/lib/messaging/messaging-service'
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

type RealtimePayload = {
  eventType?: 'INSERT' | 'UPDATE' | 'DELETE' | string
  new?: Record<string, unknown> | null
  record?: Record<string, unknown> | null
}

const readStringField = (
  row: Record<string, unknown> | null | undefined,
  keys: string[]
): string | undefined => {
  for (const key of keys) {
    const value = row?.[key]
    if (typeof value === 'string') return value
  }
  return undefined
}

export function useConversationQuery(
  conversationId: string | undefined,
  options: UseConversationQueryOptions = {}
) {
  const queryClient = useQueryClient()
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
    staleTime: 60 * 1000,
    refetchOnWindowFocus: false,
    placeholderData: () => {
      if (!conversationId) return undefined
      const cachedConversations =
        queryClient.getQueryData<Conversation[]>(queryKeys.conversations.lists()) || []
      return cachedConversations.find((conversation) => conversation.id === conversationId)
    },
  })

  const realtimeEnabled = Boolean(enableRealtime && enabled && conversationId)
  const directMessagesFilter = conversationId
    ? `conversation_id=eq.${conversationId}`
    : undefined
  const participantsFilter = conversationId
    ? `conversation_id=eq.${conversationId}`
    : undefined

  useRealtimeSync({
    table: 'direct_messages',
    event: '*',
    queryKey: queryKeys.conversations.detail(conversationId || ''),
    schema: 'public',
    filter: directMessagesFilter,
    invalidateQuery: false,
    enabled: realtimeEnabled,
    onPayload: (payload: unknown) => {
      const realtimePayload = payload as RealtimePayload
      const eventType = realtimePayload.eventType
      if (eventType !== 'INSERT' && eventType !== 'UPDATE') return

      const record = realtimePayload.new || realtimePayload.record
      const recordConversationId = readStringField(record, ['conversation_id', 'conversationId'])
      if (!conversationId || recordConversationId !== conversationId) return

      const createdAt =
        readStringField(record, ['created_at', 'createdAt', 'updated_at', 'updatedAt']) ||
        new Date().toISOString()

      queryClient.setQueryData(
        queryKeys.conversations.detail(conversationId),
        (old: Conversation | undefined) => {
          if (!old) return old
          return {
            ...old,
            lastMessageAt: createdAt,
            updatedAt: createdAt,
          }
        }
      )
    },
  })

  useRealtimeSync({
    table: 'conversation_participants',
    event: 'UPDATE',
    queryKey: queryKeys.conversations.detail(conversationId || ''),
    schema: 'public',
    filter: participantsFilter,
    invalidateQuery: false,
    enabled: realtimeEnabled,
    onPayload: (payload: unknown) => {
      const realtimePayload = payload as RealtimePayload
      const record = realtimePayload.new || realtimePayload.record
      const recordConversationId = readStringField(record, ['conversation_id', 'conversationId'])
      const recordUserId = readStringField(record, ['user_id', 'userId'])
      const lastReadAt = readStringField(record, ['last_read_at', 'lastReadAt'])

      if (!conversationId || recordConversationId !== conversationId || !recordUserId || !lastReadAt) {
        return
      }

      queryClient.setQueryData(
        queryKeys.conversations.detail(conversationId),
        (old: Conversation | undefined) => {
          if (!old?.participants) return old
          return {
            ...old,
            participants: old.participants.map((participant) =>
              participant.userId === recordUserId
                ? { ...participant, lastReadAt }
                : participant
            ),
          }
        }
      )
    },
  })

  return {
    conversation: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
    isFetching: query.isFetching,
  }
}
