import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useUserStore } from '@/store/userStore'
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
  const detailInvalidateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const listInvalidateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)



  const buildParticipantFallback = (userId: string) => {
    const isSelf = session.user?.id === userId;
    const anonymousId = isSelf
      ? session.user?.anonymousId || `ANON_${userId.substring(0, 8)}`
      : `ANON_${userId.substring(0, 8)}`;
    const displayName = anonymousId;

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
        editedAt: record.edited_at ?? record.updated_at ?? currentMessage.editedAt,
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
    const likeThreadId = payload?.new?.thread_id || payload?.old?.thread_id
    if (likeThreadId !== threadId) return
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

  const hydratedSendersRef = useRef<Set<string>>(new Set())

  const hydrateSender = (senderId: string | null | undefined) => {
    if (!threadId || !senderId || hydratedSendersRef.current.has(senderId)) return
    const cached: any = queryClient.getQueryData(queryKeys.threads.detail(threadId))
    const known = (cached?.participants || []).some((p: any) => p.id === senderId && p.anonymousId && !String(p.anonymousId).startsWith('ANON_' + senderId.substring(0, 8)))
    if (known) return
    hydratedSendersRef.current.add(senderId)
    import('@/lib/core/supabase/raw-db')
      .then(({ select }) => select<any[]>('users', {
        select: 'id,anonymous_id,avatar_url,is_premium',
        filters: { id: `eq.${senderId}` },
        limit: 1,
      }))
      .then(({ data }) => {
        const user = Array.isArray(data) ? data[0] : null
        if (!user) return
        queryClient.setQueryData(queryKeys.threads.detail(threadId), (oldData: any) => {
          if (!oldData) return oldData
          const participant = {
            id: user.id,
            anonymousId: user.anonymous_id,
            name: user.anonymous_id,
            avatar: user.avatar_url || '#cccccc',
            status: 'online' as const,
            isPremium: Boolean(user.is_premium),
            messageCount: 0,
          }
          const participants = Array.isArray(oldData.participants) ? oldData.participants : []
          const nextParticipants = participants.some((p: any) => p.id === user.id)
            ? participants.map((p: any) => (p.id === user.id ? { ...p, ...participant, messageCount: p.messageCount } : p))
            : participants
          const messages = Array.isArray(oldData.messages) ? oldData.messages : []
          return {
            ...oldData,
            participants: nextParticipants,
            messages: messages.map((message: any) =>
              message.authorId === user.id
                ? {
                    ...message,
                    authorName: user.anonymous_id,
                    sender: { ...message.sender, anonymousId: user.anonymous_id, name: user.anonymous_id, avatar: user.avatar_url || message.sender?.avatar, isPremium: Boolean(user.is_premium) },
                  }
                : message
            ),
          }
        })
      })
      .catch(() => {
        hydratedSendersRef.current.delete(senderId)
      })
  }

  const patchListThread = (patch: (thread: any) => any) => {
    if (!threadId) return
    queryClient.setQueriesData({ queryKey: queryKeys.threads.lists() }, (old: any) => {
      if (!old || !old.pages) return old
      return {
        ...old,
        pages: old.pages.map((page: any) => ({
          ...page,
          threads: page.threads.map((thread: any) => (thread.id === threadId ? patch(thread) : thread)),
        })),
      }
    })
  }

  const applyThreadRowUpdate = (payload: any) => {
    if (!threadId) return
    const row = payload?.new
    if (!row || row.id !== threadId) return
    if (row.deleted_at || (row.moderation_status && row.moderation_status !== 'visible')) {
      scheduleThreadDetailRefresh(0)
      return
    }
    queryClient.setQueryData(queryKeys.threads.detail(threadId), (oldData: any) => {
      if (!oldData) return oldData
      return {
        ...oldData,
        title: row.title ?? oldData.title,
        content: row.content ?? oldData.content,
        likes: typeof row.likes_count === 'number' ? row.likes_count : oldData.likes,
        messageCount: typeof row.message_count === 'number' ? row.message_count : oldData.messageCount,
        isLocked: typeof row.is_locked === 'boolean' ? row.is_locked : oldData.isLocked,
        privacy: row.privacy ?? oldData.privacy,
        isSaved: typeof row.is_saved === 'boolean' ? row.is_saved : oldData.isSaved,
        expiresAt: row.expires_at !== undefined ? row.expires_at : oldData.expiresAt,
        lastMessageAt: row.last_message_at ?? oldData.lastMessageAt,
        reportCount: typeof row.report_count === 'number' ? row.report_count : oldData.reportCount,
      }
    })
  }

  const applyPollVote = (payload: any) => {
    if (!threadId) return
    const optionId = payload?.new?.option_id
    const voterId = payload?.new?.user_id
    if (!optionId) return
    queryClient.setQueryData(queryKeys.threads.detail(threadId), (oldData: any) => {
      if (!oldData || !Array.isArray(oldData.pollOptions)) return oldData
      if (!oldData.pollOptions.some((option: any) => option.id === optionId)) return oldData
      const options = oldData.pollOptions.map((option: any) => ({
        ...option,
        votes: option.id === optionId ? (option.votes || 0) + 1 : option.votes || 0,
        hasVoted: option.hasVoted || (option.id === optionId && voterId === session.user?.id),
      }))
      const total = options.reduce((sum: number, option: any) => sum + option.votes, 0)
      return {
        ...oldData,
        pollOptions: options.map((option: any) => ({ ...option, percentage: total > 0 ? Math.round((option.votes / total) * 100) : 0 })),
      }
    })
  }

  const scheduleThreadDetailRefresh = (delayMs = 300) => {
    if (!threadId || detailInvalidateTimerRef.current) return
    detailInvalidateTimerRef.current = setTimeout(() => {
      detailInvalidateTimerRef.current = null
      queryClient.invalidateQueries({ queryKey: queryKeys.threads.detail(threadId), refetchType: 'active' })
    }, delayMs)
  }

  const scheduleThreadListRefresh = (delayMs = 300) => {
    if (listInvalidateTimerRef.current) return
    listInvalidateTimerRef.current = setTimeout(() => {
      listInvalidateTimerRef.current = null
      queryClient.invalidateQueries({ queryKey: queryKeys.threads.lists(), refetchType: 'active' })
    }, delayMs)
  }

  useEffect(() => {

    if (!threadId) {
      return;
    }

    // === LIVE SUBSCRIPTION ENABLED ===
    const unsubscribers: Array<() => void> = [];

    // Handle visibility changes to ensure connection is alive
    let hiddenAt: number | null = null
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        hiddenAt = Date.now()
        return
      }
      if (hiddenAt !== null && Date.now() - hiddenAt > 60_000) {
        scheduleThreadDetailRefresh(0)
      }
      hiddenAt = null
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    unsubscribers.push(() => document.removeEventListener('visibilitychange', handleVisibilityChange));



    try {
      const unsubThreadEvents = realtimeService.subscribeToThreadEvents({
        threadId,
        onMessageInsert: (payload) => {
          if (payload?.new?.thread_id && payload.new.thread_id !== threadId) return
          upsertRealtimeMessage(payload)
          hydrateSender(payload?.new?.sender_id)
          patchListThread((thread) => ({ ...thread, messageCount: (thread.messageCount || 0) + 1, lastMessageAt: payload?.new?.created_at ?? thread.lastMessageAt }))
        },
        onMessageUpdate: (payload) => {
          if (payload?.new?.thread_id && payload.new.thread_id !== threadId) return
          patchRealtimeMessage(payload)
        },

        onThreadUpdate: (payload) => {
          applyThreadRowUpdate(payload)
        },

        onMessageLikeInsert: (payload) => {
          applyMessageLikeCache(payload, 'insert')
        },

        onMessageReactionInsert: (payload) => {
          applyMessageReactionCache(payload, 'insert')
        },

        onLikeInsert: (payload) => {
          applyThreadLikeCache(payload, 'insert')
        },

        onParticipantInsert: (payload) => {
          if (payload?.new?.thread_id !== threadId) return
          const participantId = payload?.new?.user_id;
          if (participantId) {
            updateParticipantCache(participantId, 'add');
            hydrateSender(participantId);
          }
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
        onPollVote: (payload: any) => {
          applyPollVote(payload)
        }
      });
      unsubscribers.push(unsubThreadEvents);
    } catch (err) {
      console.error('[useRealtimeThread] 💥 Fatal error in subscription setup:', err);
    }

    return () => {
      if (detailInvalidateTimerRef.current) {
        clearTimeout(detailInvalidateTimerRef.current)
        detailInvalidateTimerRef.current = null
      }
      if (listInvalidateTimerRef.current) {
        clearTimeout(listInvalidateTimerRef.current)
        listInvalidateTimerRef.current = null
      }
      unsubscribers.forEach((unsub) => unsub());
    }
    // Subscription should only rebuild when thread identity or current user changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threadId, pollId, session.user?.id])

  const typingUsersList = useMemo(() => Array.from(typingUsers), [typingUsers])

  return {
    onlineUsers,
    typingUsers: typingUsersList,
    onlineCount: onlineUsers.length,
  }
}

/**
 * Hook to subscribe to real-time feed updates (all threads)
 */
export const useRealtimeFeed = (enabled = true) => {
  const queryClient = useQueryClient()
  const [newThreadCount, setNewThreadCount] = useState(0)

  useEffect(() => {
    if (!enabled) return

    const unsubThreads = realtimeService.subscribeToAllThreads((payload) => {
      const row = (payload as { new?: { story_id?: string | null; moderation_status?: string } }).new
      if (row?.story_id || (row?.moderation_status && row.moderation_status !== 'visible')) return
      setNewThreadCount((count) => count + 1)
    })

    return () => {
      unsubThreads()
    }
  }, [enabled])

  const showNewThreads = useCallback(() => {
    setNewThreadCount(0)
    const lists = queryClient.getQueriesData<{ pages: unknown[]; pageParams: unknown[] }>({ queryKey: queryKeys.threads.lists() })
    for (const [key, data] of lists) {
      if (!data?.pages) continue
      queryClient.setQueryData(key, { pages: data.pages.slice(0, 1), pageParams: data.pageParams.slice(0, 1) })
    }
    queryClient.invalidateQueries({ queryKey: queryKeys.threads.lists(), refetchType: 'active' })
  }, [queryClient])

  return { newThreadCount, showNewThreads }
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
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current)
        typingTimeoutRef.current = null
      }
      if (threadId && session.user?.id) {
        realtimeService.broadcastTyping(threadId, session.user.id, false)
      }
    }
  }, [threadId, session.user?.id])

  const startTyping = () => {
    if (!threadId || !session.user?.id) return

    if (!isTyping) {
      realtimeService.broadcastTyping(threadId, session.user.id, true)
      setIsTyping(true)
    }

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current)
    }

    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false)
      if (threadId && session.user?.id) {
        realtimeService.broadcastTyping(threadId, session.user.id, false)
      }
      typingTimeoutRef.current = null
    }, 1500)
  }

  const stopTyping = () => {
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current)
      typingTimeoutRef.current = null
    }
    setIsTyping(false)
    if (threadId && session.user?.id) {
      realtimeService.broadcastTyping(threadId, session.user.id, false)
    }
  }

  return { startTyping, stopTyping, isTyping }
}
