'use client'

import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/lib/react-query/queryKeys'
import { fetchMessages, DirectMessage, createDeliveryReceipt } from '@/lib/messaging/messaging-service'
import { useRealtimeSync } from '@/lib/react-query/realtime'
import { getSession } from '@/lib/core/supabase/raw-auth'

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

const mapRealtimeMessage = (row: any): DirectMessage => ({
  id: row.id,
  conversationId: row.conversation_id ?? row.conversationId,
  senderId: row.sender_id ?? row.senderId,
  content: row.content ?? '',
  messageType: row.message_type ?? row.messageType ?? 'text',
  attachmentUrl: row.attachment_url ?? row.attachmentUrl,
  isEdited: row.is_edited ?? row.isEdited ?? false,
  isDeleted: row.is_deleted ?? row.isDeleted ?? false,
  createdAt: row.created_at ?? row.createdAt ?? new Date().toISOString(),
  updatedAt: row.updated_at ?? row.updatedAt ?? row.created_at ?? new Date().toISOString(),
  readReceipts: Array.isArray(row.message_read_receipts)
    ? row.message_read_receipts.map((receipt: any) => ({
        messageId: receipt.message_id ?? receipt.messageId,
        userId: receipt.user_id ?? receipt.userId,
        readAt: receipt.read_at ?? receipt.readAt,
      }))
    : undefined,
  deliveryReceipts: Array.isArray(row.message_delivery_receipts)
    ? row.message_delivery_receipts.map((receipt: any) => ({
        messageId: receipt.message_id ?? receipt.messageId,
        userId: receipt.user_id ?? receipt.userId,
        deliveredAt: receipt.delivered_at ?? receipt.deliveredAt,
      }))
    : undefined,
})

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
      queryKey: messagesQueryKey,
      filter: `conversation_id=eq.${conversationId}`,
      schema: 'public',
      invalidateQuery: false,
      onPayload: (payload) => {
        const eventType = payload?.eventType
        const record = payload?.new || payload?.record
        const oldRecord = payload?.old || payload?.old_record

        if (eventType === 'INSERT' && record?.id) {
          const currentUserId = getSession()?.user?.id
          if (currentUserId && record.sender_id !== currentUserId) {
            void createDeliveryReceipt(record.id)
          }

          queryClient.setQueryData(messagesQueryKey, (old: InfiniteMessagesCache | undefined) =>
            upsertMessageInCache(old, mapRealtimeMessage(record), true)
          )
          return
        }

        if (eventType === 'UPDATE' && record?.id) {
          queryClient.setQueryData(messagesQueryKey, (old: InfiniteMessagesCache | undefined) =>
            upsertMessageInCache(old, mapRealtimeMessage(record), false)
          )
          return
        }

        if (eventType === 'DELETE') {
          const messageId = oldRecord?.id || record?.id
          if (!messageId) return
          queryClient.setQueryData(messagesQueryKey, (old: InfiniteMessagesCache | undefined) =>
            removeMessageFromCache(old, messageId)
          )
        }
      },
    })

    // Listen for delivery receipt updates
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useRealtimeSync({
      table: 'message_delivery_receipts',
      event: '*',
      queryKey: messagesQueryKey,
      schema: 'public',
      invalidateQuery: false,
      onPayload: (payload) => {
        const eventType = payload?.eventType
        if (eventType !== 'INSERT' && eventType !== 'UPDATE') return

        const record = payload?.new || payload?.record
        if (!record?.message_id || !record?.user_id) return

        queryClient.setQueryData(messagesQueryKey, (old: InfiniteMessagesCache | undefined) =>
          addDeliveryReceiptToCache(old, {
            messageId: record.message_id,
            userId: record.user_id,
            deliveredAt: record.delivered_at || new Date().toISOString(),
          })
        )
      },
    })

    // Also listen for read receipt updates
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useRealtimeSync({
      table: 'message_read_receipts',
      event: '*',
      queryKey: messagesQueryKey,
      schema: 'public',
      invalidateQuery: false,
      onPayload: (payload) => {
        const eventType = payload?.eventType
        if (eventType !== 'INSERT' && eventType !== 'UPDATE') return

        const record = payload?.new || payload?.record
        if (!record?.message_id || !record?.user_id) return

        queryClient.setQueryData(messagesQueryKey, (old: InfiniteMessagesCache | undefined) =>
          addReadReceiptToCache(old, {
            messageId: record.message_id,
            userId: record.user_id,
            readAt: record.read_at || new Date().toISOString(),
          })
        )
      },
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
