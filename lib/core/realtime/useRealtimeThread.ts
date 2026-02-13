import { useEffect, useState } from 'react'
import { useUserStore } from '@/store/userStore'
import { useThreadStore } from '@/store/threadStore'
import * as realtimeService from './realtime-service'
import { useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/lib/react-query/queryKeys'
import { transformMessage } from '@/lib/threads/thread-service'
import { ReactionType } from '@/types'

const VALID_REACTION_TYPES: ReactionType[] = ['like', 'love', 'laugh', 'angry', 'sad', 'wow']

const isReactionType = (value: string): value is ReactionType =>
  VALID_REACTION_TYPES.includes(value as ReactionType)

/**
 * Hook to subscribe to real-time updates for a single thread
 */
export const useRealtimeThread = (threadId: string | null, pollId?: string | null) => {
  const { session } = useUserStore()
  const queryClient = useQueryClient()
  const [onlineUsers, setOnlineUsers] = useState<any[]>([])
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set())



  const buildParticipantFallback = (userId: string) => {
    const isSelf = session.user?.id === userId;
    const anonymousId = isSelf
      ? session.user?.anonymousId || `ANON_${userId.substring(0, 8)}`
      : `ANON_${userId.substring(0, 8)}`;
    const displayName = isSelf
      ? (session.user?.username || anonymousId)
      : anonymousId;

    return {
      id: userId,
      anonymousId,
      name: displayName,
      avatar: session.user?.id === userId ? (session.user as any)?.avatar || '#cccccc' : '#cccccc',
      status: 'online' as const,
      isPremium: isSelf ? session.user?.isPremium : false,
      messageCount: 0,
      reportCount: 0,
    };
  };

  const updateParticipantCache = (userId: string, action: 'add' | 'remove') => {
    if (!threadId) return;

    // Update thread detail cache (participants array)
    queryClient.setQueryData(queryKeys.threads.detail(threadId), (oldData: any) => {
      if (!oldData) return oldData;
      const existing = Array.isArray(oldData.participants) ? oldData.participants : [];

      if (action === 'add') {
        if (existing.some((p: any) => p.id === userId)) {
          return oldData;
        }
        const nextParticipants = [...existing, buildParticipantFallback(userId)];
        return {
          ...oldData,
          participants: nextParticipants,
          participantCount: nextParticipants.length,
        };
      }

      // remove
      const nextParticipants = existing.filter((p: any) => p.id !== userId);
      if (nextParticipants.length === existing.length) return oldData;
      return {
        ...oldData,
        participants: nextParticipants,
        participantCount: nextParticipants.length,
      };
    });

    // Update thread lists cache (participantCount only)
    queryClient.setQueriesData({ queryKey: queryKeys.threads.lists() }, (old: any) => {
      if (!old || !old.pages) return old;
      return {
        ...old,
        pages: old.pages.map((page: any) => ({
          ...page,
          threads: page.threads.map((t: any) => {
            if (t.id !== threadId) return t;
            const current = typeof t.participantCount === 'number' ? t.participantCount : 0;
            const nextCount = action === 'add' ? current + 1 : Math.max(0, current - 1);
            return { ...t, participantCount: nextCount };
          }),
        })),
      };
    });
  };

  const upsertRealtimeMessage = (payload: any) => {
    if (!threadId) return
    const rawIncoming = payload?.new
    if (!rawIncoming?.id) return

    queryClient.setQueryData(queryKeys.threads.detail(threadId), (oldData: any) => {
      if (!oldData) return oldData

      const existingMessages = Array.isArray(oldData.messages) ? oldData.messages : []
      if (existingMessages.some((message: any) => message.id === rawIncoming.id)) {
        return oldData
      }

      const senderId = rawIncoming.sender_id
      const participant = (oldData.participants || []).find((p: any) => p.id === senderId)
      const senderFallback = senderId
        ? {
            id: senderId,
            username: participant?.name || (session.user?.id === senderId ? session.user?.username : undefined),
            anonymous_id: participant?.anonymousId || (session.user?.id === senderId ? session.user?.anonymousId : `ANON_${senderId.substring(0, 8)}`),
            avatar_url: participant?.avatar || '#cccccc',
            is_premium: participant?.isPremium ?? (session.user?.id === senderId ? session.user?.isPremium : false),
          }
        : undefined

      const transformedIncoming = transformMessage(
        {
          ...rawIncoming,
          sender: rawIncoming.sender || senderFallback,
          message_likes: rawIncoming.message_likes || [],
          message_reactions: rawIncoming.message_reactions || [],
        },
        session.user?.id
      )

      const optimisticIndex = existingMessages.findIndex(
        (message: any) =>
          message.id?.startsWith('optimistic-') &&
          message.authorId === transformedIncoming.authorId &&
          message.content === transformedIncoming.content
      )

      const nextMessages = [...existingMessages]
      if (optimisticIndex !== -1) {
        nextMessages[optimisticIndex] = {
          ...nextMessages[optimisticIndex],
          ...transformedIncoming,
          status: 'sent',
        }
      } else {
        nextMessages.push({
          ...transformedIncoming,
          status: 'sent',
        })
      }

      const currentCount = typeof oldData.messageCount === 'number' ? oldData.messageCount : 0
      return {
        ...oldData,
        messages: nextMessages,
        messageCount: Math.max(currentCount, nextMessages.length),
      }
    })
  }

  const patchRealtimeMessage = (payload: any) => {
    if (!threadId) return
    const record = payload?.new
    if (!record?.id) return

    queryClient.setQueryData(queryKeys.threads.detail(threadId), (oldData: any) => {
      if (!oldData) return oldData
      const existingMessages = Array.isArray(oldData.messages) ? oldData.messages : []
      const messageIndex = existingMessages.findIndex((message: any) => message.id === record.id)
      if (messageIndex === -1) return oldData

      const currentMessage = existingMessages[messageIndex]
      const nextMessage = {
        ...currentMessage,
        content: typeof record.content === 'string' ? record.content : currentMessage.content,
        attachments: record.attachments ?? currentMessage.attachments,
        isEdited: record.is_edited ?? currentMessage.isEdited,
        editedAt: record.updated_at ?? currentMessage.editedAt,
        replyToId: record.parent_message_id ?? currentMessage.replyToId,
      }

      const nextMessages = [...existingMessages]
      nextMessages[messageIndex] = nextMessage

      return {
        ...oldData,
        messages: nextMessages,
      }
    })
  }

  const removeRealtimeMessage = (payload: any) => {
    if (!threadId) return
    const removedMessageId = payload?.old?.id || payload?.new?.id
    if (!removedMessageId) return

    queryClient.setQueryData(queryKeys.threads.detail(threadId), (oldData: any) => {
      if (!oldData) return oldData
      const existingMessages = Array.isArray(oldData.messages) ? oldData.messages : []
      const nextMessages = existingMessages.filter((message: any) => message.id !== removedMessageId)
      if (nextMessages.length === existingMessages.length) return oldData

      return {
        ...oldData,
        messages: nextMessages,
        messageCount: Math.max(0, (oldData.messageCount || 0) - 1),
      }
    })
  }

  const applyThreadLikeCache = (payload: any, action: 'insert' | 'delete') => {
    if (!threadId) return
    const actorId = payload?.new?.user_id || payload?.old?.user_id
    const currentUserId = session.user?.id

    queryClient.setQueryData(queryKeys.threads.detail(threadId), (oldData: any) => {
      if (!oldData) return oldData
      const delta = action === 'insert' ? 1 : -1
      const nextLikes = Math.max(0, (oldData.likes || 0) + delta)

      return {
        ...oldData,
        likes: nextLikes,
        hasLiked: actorId && currentUserId === actorId ? action === 'insert' : oldData.hasLiked,
      }
    })

    queryClient.setQueriesData({ queryKey: queryKeys.threads.lists() }, (old: any) => {
      if (!old || !old.pages) return old
      const delta = action === 'insert' ? 1 : -1
      return {
        ...old,
        pages: old.pages.map((page: any) => ({
          ...page,
          threads: page.threads.map((thread: any) => {
            if (thread.id !== threadId) return thread
            return {
              ...thread,
              likes: Math.max(0, (thread.likes || 0) + delta),
            }
          }),
        })),
      }
    })
  }

  const applyMessageLikeCache = (payload: any, action: 'insert' | 'delete') => {
    if (!threadId) return
    const messageId = payload?.new?.message_id || payload?.old?.message_id
    const actorId = payload?.new?.user_id || payload?.old?.user_id
    if (!messageId) return

    queryClient.setQueryData(queryKeys.threads.detail(threadId), (oldData: any) => {
      if (!oldData) return oldData
      const existingMessages = Array.isArray(oldData.messages) ? oldData.messages : []
      const messageIndex = existingMessages.findIndex((message: any) => message.id === messageId)
      if (messageIndex === -1) return oldData

      const currentMessage = existingMessages[messageIndex]
      const delta = action === 'insert' ? 1 : -1
      const nextMessage = {
        ...currentMessage,
        likes: Math.max(0, (currentMessage.likes || 0) + delta),
        hasLiked: actorId && actorId === session.user?.id ? action === 'insert' : currentMessage.hasLiked,
      }

      const nextMessages = [...existingMessages]
      nextMessages[messageIndex] = nextMessage

      return {
        ...oldData,
        messages: nextMessages,
      }
    })
  }

  const applyMessageReactionCache = (payload: any, action: 'insert' | 'delete') => {
    if (!threadId) return
    const messageId = payload?.new?.message_id || payload?.old?.message_id
    const actorId = payload?.new?.user_id || payload?.old?.user_id
    const reaction = payload?.new?.reaction_type || payload?.old?.reaction_type
    if (!messageId || !actorId || typeof reaction !== 'string' || !isReactionType(reaction)) return

    queryClient.setQueryData(queryKeys.threads.detail(threadId), (oldData: any) => {
      if (!oldData) return oldData
      const existingMessages = Array.isArray(oldData.messages) ? oldData.messages : []
      const messageIndex = existingMessages.findIndex((message: any) => message.id === messageId)
      if (messageIndex === -1) return oldData

      const currentMessage = existingMessages[messageIndex]
      const currentReactions = { ...(currentMessage.reactions || {}) }
      const existingReaction = currentReactions[reaction] || { count: 0, users: [] }
      const users = Array.isArray(existingReaction.users) ? [...existingReaction.users] : []

      if (action === 'insert') {
        if (!users.includes(actorId)) users.push(actorId)
      } else {
        const userIndex = users.indexOf(actorId)
        if (userIndex !== -1) users.splice(userIndex, 1)
      }

      if (users.length > 0) {
        currentReactions[reaction] = { count: users.length, users }
      } else {
        delete currentReactions[reaction]
      }

      const nextMessages = [...existingMessages]
      nextMessages[messageIndex] = {
        ...currentMessage,
        reactions: currentReactions,
      }

      return {
        ...oldData,
        messages: nextMessages,
      }
    })
  }

  useEffect(() => {

    if (!threadId) {
      return;
    }

    // === LIVE SUBSCRIPTION ENABLED ===
    const unsubscribers: Array<() => void> = [];

    // Handle visibility changes to ensure connection is alive
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {

        // The underlying supabase client handles auto-reconnects, but invalidating queries helps sync state
        queryClient.invalidateQueries({ queryKey: queryKeys.threads.detail(threadId!) });
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    unsubscribers.push(() => document.removeEventListener('visibilitychange', handleVisibilityChange));



    try {
      const unsubThreadEvents = realtimeService.subscribeToThreadEvents({
        threadId,
        onMessageInsert: (payload) => {
          // Apply message immediately, then hydrate richer fields from backend.
          upsertRealtimeMessage(payload)
          queryClient.invalidateQueries({ queryKey: queryKeys.threads.detail(threadId!), refetchType: 'active' });
          queryClient.invalidateQueries({ queryKey: queryKeys.threads.lists() });
        },
        onMessageUpdate: (payload) => {
          patchRealtimeMessage(payload)
        },
        onMessageDelete: (payload) => {
          removeRealtimeMessage(payload)
          queryClient.invalidateQueries({ queryKey: queryKeys.threads.lists() });
        },
        
        onThreadUpdate: () => {
          queryClient.invalidateQueries({ queryKey: queryKeys.threads.detail(threadId!) });
        },

        onMessageLikeInsert: (payload) => {
          applyMessageLikeCache(payload, 'insert')
        },
        onMessageLikeDelete: (payload) => {
          applyMessageLikeCache(payload, 'delete')
        },

        onMessageReactionInsert: (payload) => {
          applyMessageReactionCache(payload, 'insert')
        },
        onMessageReactionDelete: (payload) => {
          applyMessageReactionCache(payload, 'delete')
        },

        onLikeInsert: (payload) => {
          applyThreadLikeCache(payload, 'insert')
        },
        onLikeDelete: (payload) => {
          applyThreadLikeCache(payload, 'delete')
        },

        onParticipantInsert: (payload) => {

          const participantId = payload?.new?.user_id;
          if (participantId) {
            updateParticipantCache(participantId, 'add');
          }
          queryClient.invalidateQueries({ queryKey: queryKeys.threads.detail(threadId!) });
          queryClient.invalidateQueries({ queryKey: queryKeys.threads.all });
        },
        onParticipantDelete: (payload) => {

          const participantId = payload?.old?.user_id || payload?.new?.user_id;
          if (participantId) {
            updateParticipantCache(participantId, 'remove');
          }
          queryClient.invalidateQueries({ queryKey: queryKeys.threads.detail(threadId!) });
          queryClient.invalidateQueries({ queryKey: queryKeys.threads.all });
        },

        onTyping: (payload) => {
          const { user_id, is_typing } = payload.payload;
          if (user_id === session.user?.id) return;

          setTypingUsers((prev) => {
            const next = new Set(prev);
            if (is_typing) next.add(user_id);
            else next.delete(user_id);
            return next;
          });

          if (is_typing) {
            setTimeout(() => {
              setTypingUsers((prev) => {
                const next = new Set(prev);
                next.delete(user_id);
                return next;
              });
            }, 3000);
          }
        },

        presence: session.user ? {
          userId: session.user.id,
          userInfo: {
            anonymousId: session.user.anonymousId,
            isPremium: session.user.isPremium,
          },
          onSync: (state) => {
            const users = Object.values(state).flat();
            setOnlineUsers(users);
          }
        } : undefined,

        pollId: pollId || undefined,
        onPollVote: () => {
          queryClient.invalidateQueries({ queryKey: queryKeys.threads.detail(threadId!) });
        }
      });
      unsubscribers.push(unsubThreadEvents);
    } catch (err) {
      console.error('[useRealtimeThread] 💥 Fatal error in subscription setup:', err);
    }

    return () => {
      unsubscribers.forEach((unsub) => unsub());
    }
    // Subscription should only rebuild when thread identity or current user changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threadId, pollId, session.user?.id])

  return {
    onlineUsers,
    typingUsers: Array.from(typingUsers),
    onlineCount: onlineUsers.length,
  }
}

/**
 * Hook to subscribe to real-time feed updates (all threads)
 */
export const useRealtimeFeed = () => {
  const { fetchThreads } = useThreadStore()
  const queryClient = useQueryClient()

  useEffect(() => {
    // Subscribe to new threads
    const unsubThreads = realtimeService.subscribeToAllThreads(
      () => {
        // New thread created - refresh feed

        fetchThreads()
        queryClient.invalidateQueries({ queryKey: queryKeys.threads.lists() });
      }
    )

    // Subscribe to participant changes across all threads
    const unsubParticipants = realtimeService.subscribeToAllParticipantChanges(() => {

      queryClient.invalidateQueries({ queryKey: queryKeys.threads.lists() });
      // Also invalidate detail queries to be safe
      queryClient.invalidateQueries({ queryKey: queryKeys.threads.all });
    });

    return () => {
      unsubThreads()
      unsubParticipants()
    }
  }, [fetchThreads, queryClient])
}

/**
 * Hook to subscribe to user notifications
 */
export const useRealtimeNotifications = () => {
  const { session } = useUserStore()
  const [newNotificationCount, setNewNotificationCount] = useState(0)

  useEffect(() => {
    if (!session.user?.id) return

    const unsubscribe = realtimeService.subscribeToUserNotifications(
      session.user.id,
      () => {
        // New notification received

        setNewNotificationCount((prev) => prev + 1)

        // Optional: Show toast notification
        // toast.info(payload.new.title)
      }
    )

    return () => {
      unsubscribe()
    }
  }, [session.user?.id])

  const clearNotificationCount = () => setNewNotificationCount(0)

  return {
    newNotificationCount,
    clearNotificationCount,
  }
}

/**
 * Hook to broadcast typing status
 */
export const useTypingIndicator = (threadId: string | null) => {
  const { session } = useUserStore()
  const [isTyping, setIsTyping] = useState(false)

  useEffect(() => {
    if (!threadId || !session.user?.id || !isTyping) return

    // Broadcast typing status
    realtimeService.broadcastTyping(threadId, session.user.id, true)

    // Auto-clear typing after 3 seconds of inactivity
    const timeout = setTimeout(() => {
      setIsTyping(false)
      if (session.user?.id) {
        realtimeService.broadcastTyping(threadId, session.user.id, false)
      }
    }, 3000)

    return () => {
      clearTimeout(timeout)
      if (threadId && session.user?.id) {
        realtimeService.broadcastTyping(threadId, session.user.id, false)
      }
    }
  }, [threadId, session.user?.id, isTyping])

  const startTyping = () => setIsTyping(true)
  const stopTyping = () => {
    setIsTyping(false)
    if (threadId && session.user?.id) {
      realtimeService.broadcastTyping(threadId, session.user.id, false)
    }
  }

  return { startTyping, stopTyping, isTyping }
}
