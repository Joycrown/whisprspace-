'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/lib/react-query/queryKeys'
import { 
  addMessage, 
  editThreadMessage,
  deleteThread, 
  likeThread, 
  unlikeThread, 
  updateThread, 
  createThread,
  likeMessage,
  unlikeMessage,
  addMessageReaction,
  removeMessageReaction,
  voteOnPoll,
  joinThread,
  leaveThread,
  removeThreadParticipant
} from '@/lib/threads/thread-service'
import { uploadService } from '@/lib/utils/upload-service'
import { CreateThreadForm, Thread, Message, ThreadData } from '@/types'
import { useUserStore } from '@/store/userStore'
import { useToastHelpers } from '@/components/ui/Toast'



/**
 * Hook for creating a new thread
 */
export function useCreateThreadMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: CreateThreadForm) => {
      // We need userId here. Assuming it's passed or available in context, 
      // but createThread in service expects userId.
      // Ideally the mutation hook should be used where userId is known.
      // For now, let's assume the hook caller will pass data augmented with userId 
      // OR we fetch current user here?
      
      // Since useCreateThreadMutation is usually called from components where user is known,
      // let's update local usage or fetch user here if needed. 
      // BUT createThreadForm doesn't have userId.
      
      // Let's rely on the service to handle it or update signature.
      // Wait, the previous implementation used api.threads.createThread(data) which seemingly used 'current_user' mock.
      // Now we need real userId.
      // We can get it from supabase.auth.getUser() inside the mutation or pass it.
      
      // Updated approach: Pass userId from variables.
      // But we can't easily change the hook signature without breaking calls if we don't know where it's called.
      // Let's fetch user inside.
      
      const { getSession } = await import('@/lib/core/supabase/raw-auth');
      const session = getSession();
      if (!session) throw new Error('User not authenticated');
      
      const result = await createThread(data, session.user.id);
      
      if (!result) {
        throw new Error('Failed to create thread')
      }
      
      return result
    },
    
    onSuccess: () => {
      // Invalidate threads list
      queryClient.invalidateQueries({ queryKey: queryKeys.threads.all })
    },
  })
}

/**
 * Hook for updating a thread
 */
export function useUpdateThreadMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ threadId, updates }: { threadId: string; updates: Partial<Thread> }) => {
      const { getSession } = await import('@/lib/core/supabase/raw-auth');
      const session = getSession();
      if (!session) throw new Error('User not authenticated');
      
      const result = await updateThread(threadId, updates, session.user.id);
      
      if (!result) {
        throw new Error('Failed to update thread')
      }
      
      return result
    },
    
    onSuccess: (_, variables) => {
      // Invalidate specific thread and lists
      queryClient.invalidateQueries({ queryKey: queryKeys.threads.detail(variables.threadId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.threads.lists() })
    },
  })
}

/**
 * Hook for deleting a thread
 */
export function useDeleteThreadMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ threadId, userId }: { threadId: string; userId: string }) => {
      const success = await deleteThread(threadId, userId)
      
      if (!success) {
        throw new Error('Failed to delete thread')
      }
      
      return null
    },
    
    onSuccess: () => {
      // Invalidate all thread queries
      queryClient.invalidateQueries({ queryKey: queryKeys.threads.all })
    },
  })
}

/**
 * Hook for liking/unliking a thread
 */
export function useLikeThreadMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ threadId, userId, isLiked }: { threadId: string; userId: string; isLiked: boolean }) => {
      // Toggle like based on current state
      const success = isLiked 
        ? await unlikeThread(threadId, userId)
        : await likeThread(threadId, userId)
      
      if (!success) {
        throw new Error('Failed to toggle thread like')
      }
      
      return { success }
    },
    
    // Optimistic update
    onMutate: async ({ threadId, isLiked }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: queryKeys.threads.detail(threadId) })

      // Snapshot previous value
      const previousThread = queryClient.getQueryData<Thread>(queryKeys.threads.detail(threadId))

      // Optimistically update like status
      if (previousThread) {
        queryClient.setQueryData<Thread>(queryKeys.threads.detail(threadId), {
          ...previousThread,
          hasLiked: !isLiked,
          likes: (previousThread.likes || 0) + (isLiked ? -1 : 1),
        })
      }

      return { previousThread }
    },
    
    onError: (err, { threadId }, context) => {
      // Rollback on error
      if (context?.previousThread) {
        queryClient.setQueryData(queryKeys.threads.detail(threadId), context.previousThread)
      }
    },
    
    onSuccess: (_, { threadId }) => {
      // Refetch to get accurate data
      queryClient.invalidateQueries({ queryKey: queryKeys.threads.detail(threadId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.threads.lists() })
    },
  })
}

/**
 * Hook for adding a message to a thread
 */

export function useCreateThreadMessageMutation() {
  const queryClient = useQueryClient()
  const toast = useToastHelpers()

  return useMutation({
    mutationFn: async ({ 
      threadId, 
      content, 
      userId,
      type,
      attachments,
      replyToId 
    }: { 
      threadId: string; 
      content: string; 
      userId: string;
      type?: string;
      attachments?: any[];
      replyToId?: string;
    }) => {

      
      let finalAttachments = attachments;
      let finalType = type;

      // Handle file uploads if attachments are Files
      if (attachments && attachments.length > 0 && attachments[0] instanceof File) {

        try {
          // Upload files to 'thread-attachments' bucket
          const uploadedFiles = await uploadService.uploadFiles(
            attachments as File[], 
            'thread-attachments', 
            `messages/${threadId}`
          );

          
          finalAttachments = uploadedFiles.map(file => ({
            type: file.type.startsWith('image/') ? 'image' : 'file',
            url: file.url,
            fileName: file.name,
            fileType: file.type,
            size: file.size
          }));

          if (!finalType || finalType === 'text') {
             finalType = finalAttachments.some(a => a.type === 'image') ? 'image' : 'file';
          }
        } catch (uploadError: any) {
          console.error('🔶 [Mutation] ⚠️ Attachment upload failed:', uploadError);
          // We don't throw - we still want the message to send
        }
      } 


      
      const message = await addMessage(
        threadId,
        content,
        userId,
        (finalType as any) || 'text',
        finalAttachments,
        replyToId
      );


      return message;
    },

    // Restored Optimistic Updates
    onMutate: async (newMsg) => {
      const optimisticId = `optimistic-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
      // Create an optimistic message
      const optimisticMessage: Message = {
        id: optimisticId,
        threadId: newMsg.threadId,
        authorId: newMsg.userId,
        // Mock sender - UI handles basic display
        sender: { 
           id: newMsg.userId, 
           name: 'You', 
           anonymousId: 'You', 
           avatar: '',
           status: 'online'
        },
        authorName: 'You',
        content: newMsg.content,
        timestamp: new Date().toISOString(),
        type: (newMsg.type as any) || 'text',
        likes: 0,
        hasLiked: false,
        replyToId: newMsg.replyToId,
        attachments: newMsg.attachments,
        status: 'sending'
      };

      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: queryKeys.threads.detail(newMsg.threadId) });

      // Snapshot previous value
      const previousThread = queryClient.getQueryData<ThreadData>(queryKeys.threads.detail(newMsg.threadId));

      // Optimistically update
      if (previousThread) {
        queryClient.setQueryData<ThreadData>(queryKeys.threads.detail(newMsg.threadId), {
          ...previousThread,
          messages: [...(previousThread.messages || []), optimisticMessage],
        });
      }

      return { previousThread, optimisticId };
    },

    onSuccess: (serverMessage, variables, context) => {
      // Manual Cache Reconciliation: Replace the optimistic message with the real one
      queryClient.setQueryData<ThreadData>(
        queryKeys.threads.detail(variables.threadId),
        (oldData) => {
          if (!oldData) return oldData;
          const existingMessages = oldData.messages || []
          let replaced = false

          const nextMessages = existingMessages.map((msg) => {
            const shouldReplace = context?.optimisticId
              ? msg.id === context.optimisticId
              : (msg.id.startsWith('optimistic-') && msg.content === serverMessage.content)

            if (!shouldReplace) return msg
            replaced = true

            return {
              ...serverMessage,
              sender: msg.sender,
            }
          })

          return {
            ...oldData,
            messages: replaced ? nextMessages : [...nextMessages, serverMessage],
          };
        }
      );
    },

    onError: (err, newMsg, context) => {
      const isBlocked = err?.message === 'CONTENT_BLOCKED'
      toast.error(
        isBlocked
          ? 'This space protects honest expression — not harm. Please rephrase.'
          : `Failed to send: ${err.message}`
      )
      // Rollback
      if (context?.previousThread) {
        queryClient.setQueryData(queryKeys.threads.detail(newMsg.threadId), context.previousThread);
      }
    },
  })
}

/**
 * Hook for editing a message in a thread
 */
export function useEditThreadMessageMutation() {
  const queryClient = useQueryClient()
  const toast = useToastHelpers()

  return useMutation({
    mutationFn: async ({
      threadId,
      messageId,
      content,
      userId,
    }: {
      threadId: string
      messageId: string
      content: string
      userId: string
    }) => {
      const message = await editThreadMessage(messageId, content, userId)
      return { threadId, message }
    },
    onMutate: async ({ threadId, messageId, content }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.threads.detail(threadId) })
      const previousThread = queryClient.getQueryData<ThreadData>(queryKeys.threads.detail(threadId))

      queryClient.setQueryData<ThreadData>(queryKeys.threads.detail(threadId), (old) => {
        if (!old) return old
        const nextMessages = (old.messages || []).map((msg) =>
          msg.id === messageId
            ? {
                ...msg,
                content,
                isEdited: true,
                editedAt: new Date().toISOString(),
              }
            : msg
        )
        return { ...old, messages: nextMessages }
      })

      return { previousThread }
    },
    onError: (error: any, variables, context) => {
      if (context?.previousThread) {
        queryClient.setQueryData(queryKeys.threads.detail(variables.threadId), context.previousThread)
      }
      toast.error(error?.message || 'Failed to edit message')
    },
    onSuccess: ({ threadId, message }) => {
      queryClient.setQueryData<ThreadData>(queryKeys.threads.detail(threadId), (old) => {
        if (!old) return old
        const nextMessages = (old.messages || []).map((msg) =>
          msg.id === message.id ? { ...msg, ...message } : msg
        )
        return { ...old, messages: nextMessages }
      })
    },
  })
}

/**
 * Hook for liking a message
 */
export function useLikeMessageMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      messageId,
      userId,
      isLiked,
      threadId,
    }: {
      messageId: string
      userId: string
      isLiked: boolean
      threadId?: string
    }) => {
      const success = isLiked
        ? await unlikeMessage(messageId, userId)
        : await likeMessage(messageId, userId)
      
      if (!success) {
        throw new Error('Failed to toggle message like')
      }
      
      return { success, threadId }
    },
    
    onSuccess: (_, variables) => {
      if (variables.threadId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.threads.detail(variables.threadId) })
        queryClient.invalidateQueries({ queryKey: queryKeys.threads.lists() })
        return
      }
      queryClient.invalidateQueries({ queryKey: queryKeys.threads.all })
    },
  })
}

/**
 * Hook for adding/removing a message reaction
 */
export function useMessageReactionMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ 
      messageId, 
      userId, 
      reaction, 
      action,
      threadId,
    }: { 
      messageId: string; 
      userId: string; 
      reaction: string; 
      action: 'add' | 'remove'
      threadId?: string
    }) => {
      const success = action === 'add'
        ? await addMessageReaction(messageId, userId, reaction)
        : await removeMessageReaction(messageId, userId, reaction)
      
      if (!success) {
        throw new Error(`Failed to ${action} reaction`)
      }
      
      return { success, threadId }
    },
    
    onSuccess: (_, variables) => {
      if (variables.threadId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.threads.detail(variables.threadId) })
        return
      }
      queryClient.invalidateQueries({ queryKey: queryKeys.threads.all })
    },
  })
}

/**
 * Hook for voting on a poll
 */
export function useVoteOnPollMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ 
      pollId, 
      optionId, 
      userId,
      threadId
    }: { 
      pollId: string; 
      optionId: string; 
      userId: string;
      threadId: string;
    }) => {
      const success = await voteOnPoll(pollId, optionId, userId)
      
      if (!success) {
        throw new Error('Failed to submit vote')
      }
      
      return { success, threadId }
    },
    
    onSuccess: (_, variables) => {
      // Invalidate the specific thread to refresh poll results
      queryClient.invalidateQueries({ queryKey: queryKeys.threads.detail(variables.threadId) })
    },
  })
}

/**
 * Hook for joining a thread
 */
export function useJoinThreadMutation() {
  const queryClient = useQueryClient()
  const { session } = useUserStore()
  const toast = useToastHelpers()

  return useMutation({
    mutationFn: async ({ threadId, userId }: { threadId: string; userId: string }) => {
      const success = await joinThread(threadId, userId)
      if (!success) throw new Error('Failed to join thread')
      return { success, threadId }
    },
    onMutate: async ({ threadId, userId }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.threads.detail(threadId) })

      const previousThread = queryClient.getQueryData<ThreadData>(queryKeys.threads.detail(threadId))

      queryClient.setQueryData<ThreadData>(queryKeys.threads.detail(threadId), (old) => {
        if (!old) return old
        const existing = Array.isArray(old.participants) ? old.participants : []
        if (existing.some(p => p.id === userId)) return old

        const isSelf = session.user?.id === userId
        const anonymousId = isSelf
          ? session.user?.anonymousId || `ANON_${userId.substring(0, 8)}`
          : `ANON_${userId.substring(0, 8)}`

        const newParticipant = {
          id: userId,
          anonymousId,
          name: anonymousId,
          avatar: isSelf ? (session.user as any)?.avatar || '#cccccc' : '#cccccc',
          status: 'online' as const,
          isPremium: isSelf ? session.user?.isPremium : false,
          messageCount: 0,
          reportCount: 0,
        }

        const nextParticipants = [...existing, newParticipant]
        return {
          ...old,
          participants: nextParticipants,
          participantCount: nextParticipants.length,
        }
      })

      queryClient.setQueriesData({ queryKey: queryKeys.threads.lists() }, (old: any) => {
        if (!old || !old.pages) return old
        return {
          ...old,
          pages: old.pages.map((page: any) => ({
            ...page,
            threads: page.threads.map((t: any) => {
              if (t.id !== threadId) return t
              const current = typeof t.participantCount === 'number' ? t.participantCount : 0
              return { ...t, participantCount: current + 1 }
            }),
          })),
        }
      })

      return { previousThread }
    },
    onError: (err: any, { threadId }, context) => {
      if (context?.previousThread) {
        queryClient.setQueryData(queryKeys.threads.detail(threadId), context.previousThread)
      }
      const message = err?.message || 'Failed to join thread'
      toast.error(message)
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.threads.detail(variables.threadId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.threads.all })
    }
  })
}

/**
 * Hook for leaving a thread
 */
export function useLeaveThreadMutation() {
  const queryClient = useQueryClient()
  const toast = useToastHelpers()

  return useMutation({
    mutationFn: async ({ threadId, userId }: { threadId: string; userId: string }) => {
      const success = await leaveThread(threadId, userId)
      if (!success) throw new Error('Failed to leave thread')
      return { success, threadId }
    },
    onMutate: async ({ threadId, userId }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.threads.detail(threadId) })

      const previousThread = queryClient.getQueryData<ThreadData>(queryKeys.threads.detail(threadId))

      queryClient.setQueryData<ThreadData>(queryKeys.threads.detail(threadId), (old) => {
        if (!old) return old
        const existing = Array.isArray(old.participants) ? old.participants : []
        const nextParticipants = existing.filter(p => p.id !== userId)
        if (nextParticipants.length === existing.length) return old

        return {
          ...old,
          participants: nextParticipants,
          participantCount: nextParticipants.length,
        }
      })

      queryClient.setQueriesData({ queryKey: queryKeys.threads.lists() }, (old: any) => {
        if (!old || !old.pages) return old
        return {
          ...old,
          pages: old.pages.map((page: any) => ({
            ...page,
            threads: page.threads.map((t: any) => {
              if (t.id !== threadId) return t
              const current = typeof t.participantCount === 'number' ? t.participantCount : 0
              return { ...t, participantCount: Math.max(0, current - 1) }
            }),
          })),
        }
      })

      return { previousThread }
    },
    onError: (err: any, { threadId }, context) => {
      if (context?.previousThread) {
        queryClient.setQueryData(queryKeys.threads.detail(threadId), context.previousThread)
      }
      toast.error(err?.message || 'Failed to leave thread')
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.threads.detail(variables.threadId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.threads.all })
    }
  })
}

/**
 * Hook for removing a participant (creator only)
 */
export function useRemoveParticipantMutation() {
  const queryClient = useQueryClient()
  const toast = useToastHelpers()

  return useMutation({
    mutationFn: async ({ threadId, participantId, reason }: { threadId: string; participantId: string; reason?: string }) => {
      const result = await removeThreadParticipant(threadId, participantId, reason)
      if (!result.success) {
        throw new Error(result.error || 'Failed to remove participant')
      }
      return { threadId, participantId }
    },
    onMutate: async ({ threadId, participantId }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.threads.detail(threadId) })
      const previousThread = queryClient.getQueryData<ThreadData>(queryKeys.threads.detail(threadId))

      queryClient.setQueryData<ThreadData>(queryKeys.threads.detail(threadId), (old) => {
        if (!old) return old
        const existing = Array.isArray(old.participants) ? old.participants : []
        const nextParticipants = existing.filter(p => p.id !== participantId)
        if (nextParticipants.length === existing.length) return old
        return {
          ...old,
          participants: nextParticipants,
          participantCount: nextParticipants.length,
        }
      })

      return { previousThread }
    },
    onError: (err: any, { threadId }, context) => {
      if (context?.previousThread) {
        queryClient.setQueryData(queryKeys.threads.detail(threadId), context.previousThread)
      }
      toast.error(err?.message || 'Failed to remove participant')
    },
    onSuccess: ({ threadId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.threads.detail(threadId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.threads.all })
      toast.success('Participant removed and blacklisted')
    }
  })
}
