'use client'

import { useCallback } from 'react'
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query'
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

type InfiniteMessagesCache = {
  pages: Array<{ messages: DirectMessage[]; nextOffset?: number }>
  pageParams: unknown[]
}

type RealtimePayload = {
  eventType?: 'INSERT' | 'UPDATE' | 'DELETE' | string
  new?: Record<string, unknown> | null
  record?: Record<string, unknown> | null
  old?: Record<string, unknown> | null
  old_record?: Record<string, unknown> | null
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

const mapRealtimeMessage = (row: Record<string, unknown>): DirectMessage => {
  const now = new Date().toISOString()
  const messageType = readStringField(row, ['message_type', 'messageType'])

  const mapped: DirectMessage = {
    id: readStringField(row, ['id']) || '',
    conversationId: readStringField(row, ['conversation_id', 'conversationId']) || '',
    senderId: readStringField(row, ['sender_id', 'senderId']) || '',
    content: readStringField(row, ['content']) || '',
    messageType: (
      messageType === 'text' ||
      messageType === 'image' ||
      messageType === 'file' ||
      messageType === 'system'
    ) ? messageType : 'text',
    attachmentUrl: readStringField(row, ['attachment_url', 'attachmentUrl']),
    isEdited: row['is_edited'] === true || row['isEdited'] === true,
    isDeleted: row['is_deleted'] === true || row['isDeleted'] === true,
    createdAt: readStringField(row, ['created_at', 'createdAt']) || now,
    updatedAt: readStringField(row, ['updated_at', 'updatedAt', 'created_at']) || now,
  }

  const readReceipts = row['message_read_receipts']
  if (Array.isArray(readReceipts)) {
    mapped.readReceipts = readReceipts.map((receipt) => {
      const receiptRow = receipt as Record<string, unknown>
      return {
        messageId: readStringField(receiptRow, ['message_id', 'messageId']) || '',
        userId: readStringField(receiptRow, ['user_id', 'userId']) || '',
        readAt: readStringField(receiptRow, ['read_at', 'readAt']) || now,
      }
    })
  }

  const deliveryReceipts = row['message_delivery_receipts']
  if (Array.isArray(deliveryReceipts)) {
    mapped.deliveryReceipts = deliveryReceipts.map((receipt) => {
      const receiptRow = receipt as Record<string, unknown>
      return {
        messageId: readStringField(receiptRow, ['message_id', 'messageId']) || '',
        userId: readStringField(receiptRow, ['user_id', 'userId']) || '',
        deliveredAt: readStringField(receiptRow, ['delivered_at', 'deliveredAt']) || now,
      }
    })
  }

  return mapped
}

const upsertMessageInCache = (
  old: InfiniteMessagesCache | undefined,
  incoming: DirectMessage,
  allowInsert: boolean
): InfiniteMessagesCache => {
  const base: InfiniteMessagesCache = old && Array.isArray(old.pages)
    ? {
        ...old,
        pages: old.pages.map((page) => ({
          ...page,
          messages: [...(page.messages || [])],
        })),
      }
    : {
        pages: [{ messages: [], nextOffset: undefined }],
        pageParams: [0],
      }

  for (const page of base.pages) {
    const existingIndex = page.messages.findIndex((message) => message.id === incoming.id)
    if (existingIndex !== -1) {
      page.messages[existingIndex] = { ...page.messages[existingIndex], ...incoming }
      return base
    }
  }

  if (!allowInsert) return base

  const firstPage = base.pages[0]
  if (!firstPage) {
    return {
      ...base,
      pages: [{ messages: [incoming], nextOffset: undefined }],
      pageParams: base.pageParams.length > 0 ? base.pageParams : [0],
    }
  }

  const optimisticIndex = firstPage.messages.findIndex(
    (message) =>
      message.id.startsWith('temp-') &&
      message.senderId === incoming.senderId &&
      message.content === incoming.content &&
      message.messageType === incoming.messageType
  )

  if (optimisticIndex !== -1) {
    firstPage.messages[optimisticIndex] = incoming
    return base
  }

  firstPage.messages.unshift(incoming)
  return base
}

const removeMessageFromCache = (
  old: InfiniteMessagesCache | undefined,
  messageId: string
): InfiniteMessagesCache | undefined => {
  if (!old?.pages) return old

  return {
    ...old,
    pages: old.pages.map((page) => ({
      ...page,
      messages: (page.messages || []).filter((message) => message.id !== messageId),
    })),
  }
}

const addReadReceiptToCache = (
  old: InfiniteMessagesCache | undefined,
  receipt: { messageId: string; userId: string; readAt: string }
): InfiniteMessagesCache | undefined => {
  if (!old?.pages) return old

  let changed = false
  const nextPages = old.pages.map((page) => {
    const nextMessages = (page.messages || []).map((message) => {
      if (message.id !== receipt.messageId) return message

      changed = true
      const existing = message.readReceipts || []
      const withoutCurrentUser = existing.filter((entry) => entry.userId !== receipt.userId)
      return {
        ...message,
        readReceipts: [
          ...withoutCurrentUser,
          {
            messageId: receipt.messageId,
            userId: receipt.userId,
            readAt: receipt.readAt,
          },
        ],
      }
    })

    return { ...page, messages: nextMessages }
  })

  if (!changed) return old
  return { ...old, pages: nextPages }
}

const addDeliveryReceiptToCache = (
  old: InfiniteMessagesCache | undefined,
  receipt: { messageId: string; userId: string; deliveredAt: string }
): InfiniteMessagesCache | undefined => {
  if (!old?.pages) return old

  let changed = false
  const nextPages = old.pages.map((page) => {
    const nextMessages = (page.messages || []).map((message) => {
      if (message.id !== receipt.messageId) return message

      changed = true
      const existing = message.deliveryReceipts || []
      const withoutCurrentUser = existing.filter((entry) => entry.userId !== receipt.userId)
      return {
        ...message,
        deliveryReceipts: [
          ...withoutCurrentUser,
          {
            messageId: receipt.messageId,
            userId: receipt.userId,
            deliveredAt: receipt.deliveredAt,
          },
        ],
      }
    })

    return { ...page, messages: nextMessages }
  })

  if (!changed) return old
  return { ...old, pages: nextPages }
}

export function useMessagesQuery(
  conversationId: string | undefined,
  options: UseMessagesQueryOptions = {}
) {
  const queryClient = useQueryClient()
  const {
    limit = 50,
    enableRealtime = true,
    enabled = true,
  } = options
  const messagesQueryKey = queryKeys.conversations.messages(conversationId || '')
  const realtimeEnabled = Boolean(enableRealtime && enabled && conversationId)
  const directMessagesFilter = conversationId
    ? `conversation_id=eq.${conversationId}`
    : undefined

  const query = useInfiniteQuery({
    queryKey: messagesQueryKey,
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
    staleTime: 20 * 1000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
    // Realtime is primary source; keep a lightweight fallback poll.
    refetchInterval: realtimeEnabled ? 30000 : 15000,
    refetchIntervalInBackground: false,
    placeholderData: (previousData) => previousData,
    initialPageParam: 0,
  })

  const belongsToConversation = useCallback(
    (row: Record<string, unknown> | null | undefined) => {
      const rowConversationId = readStringField(row, ['conversation_id', 'conversationId'])
      return Boolean(conversationId && rowConversationId === conversationId)
    },
    [conversationId]
  )

  const handleMessageRealtimePayload = useCallback((payload: unknown) => {
    const realtimePayload = payload as RealtimePayload
    const eventType = realtimePayload.eventType
    const record = realtimePayload.new || realtimePayload.record
    const oldRecord = realtimePayload.old || realtimePayload.old_record
    const recordId = readStringField(record, ['id'])

    if ((eventType === 'INSERT' || eventType === 'UPDATE') && !belongsToConversation(record)) {
      return
    }

    if (eventType === 'INSERT' && record && recordId) {
      queryClient.setQueryData(messagesQueryKey, (old: InfiniteMessagesCache | undefined) =>
        upsertMessageInCache(old, mapRealtimeMessage(record), true)
      )
      return
    }

    if (eventType === 'UPDATE' && record && recordId) {
      queryClient.setQueryData(messagesQueryKey, (old: InfiniteMessagesCache | undefined) =>
        upsertMessageInCache(old, mapRealtimeMessage(record), false)
      )
      return
    }

    if (eventType === 'DELETE') {
      if (!belongsToConversation(oldRecord) && !belongsToConversation(record)) return
      const messageId = readStringField(oldRecord, ['id']) || recordId
      if (!messageId) return
      queryClient.setQueryData(messagesQueryKey, (old: InfiniteMessagesCache | undefined) =>
        removeMessageFromCache(old, messageId)
      )
    }
  }, [belongsToConversation, messagesQueryKey, queryClient])

  const handleDeliveryReceiptPayload = useCallback((payload: unknown) => {
    const realtimePayload = payload as RealtimePayload
    const eventType = realtimePayload.eventType
    if (eventType !== 'INSERT' && eventType !== 'UPDATE') return

    const record = realtimePayload.new || realtimePayload.record
    const messageId = readStringField(record, ['message_id', 'messageId'])
    const userId = readStringField(record, ['user_id', 'userId'])
    if (!messageId || !userId) return

    queryClient.setQueryData(messagesQueryKey, (old: InfiniteMessagesCache | undefined) =>
      addDeliveryReceiptToCache(old, {
        messageId,
        userId,
        deliveredAt: readStringField(record, ['delivered_at', 'deliveredAt']) || new Date().toISOString(),
      })
    )
  }, [messagesQueryKey, queryClient])

  const handleReadReceiptPayload = useCallback((payload: unknown) => {
    const realtimePayload = payload as RealtimePayload
    const eventType = realtimePayload.eventType
    if (eventType !== 'INSERT' && eventType !== 'UPDATE') return

    const record = realtimePayload.new || realtimePayload.record
    const messageId = readStringField(record, ['message_id', 'messageId'])
    const userId = readStringField(record, ['user_id', 'userId'])
    if (!messageId || !userId) return

    queryClient.setQueryData(messagesQueryKey, (old: InfiniteMessagesCache | undefined) =>
      addReadReceiptToCache(old, {
        messageId,
        userId,
        readAt: readStringField(record, ['read_at', 'readAt']) || new Date().toISOString(),
      })
    )
  }, [messagesQueryKey, queryClient])

  useRealtimeSync({
    table: 'direct_messages',
    event: '*',
    queryKey: messagesQueryKey,
    schema: 'public',
    filter: directMessagesFilter,
    invalidateQuery: false,
    enabled: realtimeEnabled,
    onPayload: handleMessageRealtimePayload,
  })

  useRealtimeSync({
    table: 'message_delivery_receipts',
    event: '*',
    queryKey: messagesQueryKey,
    schema: 'public',
    invalidateQuery: false,
    enabled: realtimeEnabled,
    onPayload: handleDeliveryReceiptPayload,
  })

  useRealtimeSync({
    table: 'message_read_receipts',
    event: '*',
    queryKey: messagesQueryKey,
    schema: 'public',
    invalidateQuery: false,
    enabled: realtimeEnabled,
    onPayload: handleReadReceiptPayload,
  })

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
