import { useEffect, useState } from 'react'
import { useUserStore } from '@/store/userStore'
import { useThreadStore } from '@/store/threadStore'
import * as realtimeService from './realtime-service'
import { useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/lib/react-query/queryKeys'
import { transformMessage } from '@/lib/threads/thread-service'

/**
 * Hook to subscribe to real-time updates for a single thread
 */
export const useRealtimeThread = (threadId: string | null, pollId?: string | null) => {
  const { session } = useUserStore()
  const { updateThread } = useThreadStore()
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
          // 🛡️ CRITICAL FILTER: Ignore own messages received via realtime


          
          // For other users, we invalidate to fetch the full rich message (with joins)
          queryClient.invalidateQueries({ queryKey: queryKeys.threads.detail(threadId!) });
        },
        
        onThreadUpdate: (payload) => {
          queryClient.invalidateQueries({ queryKey: queryKeys.threads.detail(threadId!) });
        },

        onLikeInsert: () => {
          queryClient.invalidateQueries({ queryKey: queryKeys.threads.detail(threadId!) });
        },
        onLikeDelete: () => {
          queryClient.invalidateQueries({ queryKey: queryKeys.threads.detail(threadId!) });
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
        onPollVote: (payload) => {
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
      (payload) => {
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
  }, [queryClient])
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
      (payload) => {
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
