'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/lib/react-query/queryKeys'
import {
  sendMessage,
  editMessage,
  deleteMessage,
  markConversationRead,
  getOrCreateConversation,
  createOneTimeConversation,
  DirectMessage,
  DMMessageType,
} from '@/lib/messaging/messaging-service'

/**
 * Hook for sending messages with optimistic updates
 */
export function useSendMessageMutation(conversationId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      content,
      messageType = 'text',
      attachmentUrl,
    }: {
      content: string
      messageType?: DMMessageType
      attachmentUrl?: string
    }) => {
      const result = await sendMessage(conversationId, content, messageType, attachmentUrl)
      
      if (result.error || !result.data) {
        throw new Error(result.error || 'Failed to send message')
      }
      
      return result.data
    },
    
    // Optimistic update
    onMutate: async (variables) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({
        queryKey: queryKeys.conversations.messages(conversationId),
      })

      // Snapshot previous value
      const previousMessages = queryClient.getQueryData(
        queryKeys.conversations.messages(conversationId)
      )

      // Resolve current user id for proper optimistic alignment
      let currentUserId = 'current-user'
      try {
        const { getSession } = await import('@/lib/core/supabase/raw-auth')
        const session = getSession()
        if (session?.user?.id) {
          currentUserId = session.user.id
        }
      } catch {
        // Keep fallback
      }

      // Optimistically add message
      const optimisticMessage: DirectMessage = {
        id: `temp-${Date.now()}`,
        conversationId,
        senderId: currentUserId,
        content: variables.content,
        messageType: variables.messageType || 'text',
        attachmentUrl: variables.attachmentUrl,
        isEdited: false,
        isDeleted: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }

      // Update cache optimistically
      queryClient.setQueryData(
        queryKeys.conversations.messages(conversationId),
        (old: any) => {
          if (!old) return { pages: [{ messages: [optimisticMessage], nextOffset: undefined }], pageParams: [0] }
          
          const newPages = [...old.pages]
          if (newPages[0]) {
            newPages[0] = {
              ...newPages[0],
              messages: [optimisticMessage, ...newPages[0].messages],
            }
          }
          
          return { ...old, pages: newPages }
        }
      )

      return { previousMessages }
    },
    
    // Rollback on error
    onError: (err, variables, context) => {
      if (context?.previousMessages) {
        queryClient.setQueryData(
          queryKeys.conversations.messages(conversationId),
          context.previousMessages
        )
      }
    },
    
    // Reconcile optimistic row with server row for instant delivery UX
    onSuccess: (serverMessage) => {
      queryClient.setQueryData(
        queryKeys.conversations.messages(conversationId),
        (old: any) => {
          if (!old?.pages) {
            return { pages: [{ messages: [serverMessage], nextOffset: undefined }], pageParams: [0] }
          }

          const pages = old.pages.map((page: any) => ({
            ...page,
            messages: [...(page.messages || [])],
          }))

          for (const page of pages) {
            const existingServerIndex = page.messages.findIndex((message: DirectMessage) => message.id === serverMessage.id)
            if (existingServerIndex !== -1) {
              page.messages[existingServerIndex] = {
                ...page.messages[existingServerIndex],
                ...serverMessage,
              }
              return { ...old, pages }
            }
          }

          const firstPage = pages[0]
          if (!firstPage) {
            return { ...old, pages: [{ messages: [serverMessage], nextOffset: undefined }], pageParams: old.pageParams || [0] }
          }

          const optimisticIndex = firstPage.messages.findIndex(
            (message: DirectMessage) =>
              message.id.startsWith('temp-') &&
              message.senderId === serverMessage.senderId &&
              message.content === serverMessage.content &&
              message.messageType === serverMessage.messageType
          )

          if (optimisticIndex !== -1) {
            firstPage.messages[optimisticIndex] = serverMessage
          } else {
            firstPage.messages.unshift(serverMessage)
          }

          return { ...old, pages }
        }
      )

      queryClient.invalidateQueries({
        queryKey: queryKeys.conversations.detail(conversationId),
      })
      queryClient.invalidateQueries({
        queryKey: queryKeys.conversations.lists(),
      })
      queryClient.invalidateQueries({
        queryKey: queryKeys.conversations.unreadCount(),
      })
    },
  })
}

/**
 * Hook for editing messages
 */
export function useEditMessageMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      messageId,
      newContent,
    }: {
      messageId: string
      newContent: string
    }) => {
      const result = await editMessage(messageId, newContent)
      
      if (result.error) {
        throw new Error(result.error)
      }
      
      return result
    },
    
    onSuccess: () => {
      // Invalidate all conversation messages
      queryClient.invalidateQueries({
        queryKey: queryKeys.conversations.all,
      })
    },
  })
}

/**
 * Hook for deleting messages
 */
export function useDeleteMessageMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (messageId: string) => {
      const result = await deleteMessage(messageId)
      
      if (result.error) {
        throw new Error(result.error)
      }
      
      return result
    },
    
    onSuccess: () => {
      // Invalidate all conversation queries
      queryClient.invalidateQueries({
        queryKey: queryKeys.conversations.all,
      })
    },
  })
}

/**
 * Hook for marking conversation as read
 */
export function useMarkConversationReadMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (conversationId: string) => {
      const result = await markConversationRead(conversationId)
      
      if (result.error) {
        throw new Error(result.error)
      }
      
      return result
    },
    
    onSuccess: (_, conversationId) => {
      // Invalidate conversation detail and unread count
      queryClient.invalidateQueries({
        queryKey: queryKeys.conversations.detail(conversationId),
      })
      queryClient.invalidateQueries({
        queryKey: queryKeys.conversations.unreadCount(),
      })
      queryClient.invalidateQueries({
        queryKey: queryKeys.conversations.lists(),
      })
    },
  })
}

/**
 * Hook for creating or getting a conversation
 */
export function useGetOrCreateConversationMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (otherUserId: string) => {
      const result = await getOrCreateConversation(otherUserId)
      
      if (result.error || !result.data) {
        throw new Error(result.error || 'Failed to create conversation')
      }
      
      return result.data
    },
    
    onSuccess: () => {
      // Invalidate conversations list
      queryClient.invalidateQueries({
        queryKey: queryKeys.conversations.lists(),
      })
    },
  })
}

/**
 * Hook for creating a one-time message conversation
 */
export function useCreateOneTimeConversationMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (recipientId: string) => {
      const result = await createOneTimeConversation(recipientId)
      
      if (result.error || !result.data) {
        throw new Error(result.error || 'Failed to create one-time conversation')
      }
      
      return result.data
    },
    
    onSuccess: () => {
      // Invalidate conversations list
      queryClient.invalidateQueries({
        queryKey: queryKeys.conversations.lists(),
      })
    },
  })
}
