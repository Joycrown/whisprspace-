'use client'

import { useCallback, useState } from 'react'
import { useQuery, useInfiniteQuery, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/lib/react-query/queryKeys'
import { ThreadData, ThreadFilters } from '@/types'
import { fetchOlderThreadMessages, fetchThreads } from '../thread-service'

const FEED_PAGE_SIZE = 20

/**
 * Hook for fetching threads list with infinite scroll support
 * 
 * @param filters Optional filters for thread list
 * @param searchQuery Search query string
 * @param userId Current user ID for personalized results
 */
export function useThreadsQuery(filters?: ThreadFilters, searchQuery?: string, userId?: string) {
  const query = useInfiniteQuery({
    queryKey: queryKeys.threads.lists({
      ...(filters as Record<string, unknown>),
      searchQuery: searchQuery || '',
      userId: userId || '',
    }),
    queryFn: async ({ pageParam }) => {
      return fetchThreads(
        filters || {},
        searchQuery || '',
        1,
        FEED_PAGE_SIZE,
        userId,
        { cursor: pageParam }
      )
    },
    getNextPageParam: (lastPage) => (lastPage.hasMore && lastPage.nextCursor ? lastPage.nextCursor : undefined),
    initialPageParam: null as string | null,
    staleTime: 2 * 60 * 1000,
    retry: 1,
    refetchOnWindowFocus: false,
    placeholderData: (previousData) => previousData,
  })

  return query
}

/**
 * Hook for fetching a single thread
 * 
 * @param threadId Thread ID to fetch
 * @param enabled Enable query (default: true if threadId exists)
 */
export function useThreadQuery(threadId: string | undefined, enabled = true) {
  const detailEnabled = enabled && !!threadId
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: queryKeys.threads.detail(threadId || ''),
    queryFn: async () => {
      if (!threadId) {
        throw new Error('Thread ID is required')
      }
      
      const { getSession } = await import('@/lib/core/supabase/raw-auth');
      const session = getSession();
      const user = session?.user;
      
      const threadData = await import('../thread-service').then(m => m.fetchThreadById(threadId, user?.id))
      
      if (!threadData) {
        const statusResponse = await fetch(`/api/threads/${threadId}/status`, {
          method: 'GET',
          cache: 'no-store',
        }).catch(() => null)

        if (statusResponse) {
          const statusPayload = await statusResponse.json().catch(() => null) as {
            code?: string
            message?: string
          } | null

          if (statusPayload?.message) {
            const enrichedError = new Error(statusPayload.message) as Error & { code?: string }
            enrichedError.code = statusPayload.code || 'THREAD_FETCH_FAILED'
            throw enrichedError
          }
        }

        const fallbackError = new Error('Failed to fetch thread') as Error & { code?: string }
        fallbackError.code = 'THREAD_FETCH_FAILED'
        throw fallbackError
      }
      
      const previous = queryClient.getQueryData<ThreadData>(queryKeys.threads.detail(threadId))
      const fresh = threadData.messages || []
      if (previous?.messages?.length && fresh.length) {
        const oldestFresh = fresh[0].timestamp
        const freshIds = new Set(fresh.map((message) => message.id))
        const olderLoaded = previous.messages.filter(
          (message) => !freshIds.has(message.id) && !message.id.startsWith('optimistic-') && message.timestamp < oldestFresh
        )
        if (olderLoaded.length) {
          return { ...threadData, messages: [...olderLoaded, ...fresh] }
        }
      }

      return threadData
    },
    enabled: detailEnabled,
    staleTime: 30 * 1000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
    refetchInterval: detailEnabled ? 5 * 60 * 1000 : false,
    refetchIntervalInBackground: false,
    placeholderData: (previousData) => previousData,
  })

  return {
    thread: query.data,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isFetchedAfterMount: query.isFetchedAfterMount,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  }
}

/**
 * Hook for fetching thread messages (integrated with thread query)
 * Note: Messages are typically fetched as part of the thread data
 * This hook is maintained for backward compatibility
 * 
 * @param threadId Thread ID
 */
export function useThreadMessagesQuery(threadId: string | undefined) {
  const { thread, isLoading, isError, error, refetch } = useThreadQuery(threadId)

  return {
    messages: thread?.messages || [],
    isLoading,
    isError,
    error,
    refetch,
  }
}

export function useOlderThreadMessages(threadId: string | undefined, userId?: string) {
  const queryClient = useQueryClient()
  const [isLoadingOlder, setIsLoadingOlder] = useState(false)
  const [exhaustedFor, setExhaustedFor] = useState<string | null>(null)

  const thread = threadId ? queryClient.getQueryData<ThreadData>(queryKeys.threads.detail(threadId)) : undefined
  const loadedCount = thread?.messages?.length ?? 0
  const hasOlder = Boolean(
    threadId &&
    exhaustedFor !== threadId &&
    loadedCount >= 50 &&
    (thread?.messageCount ?? 0) > loadedCount
  )

  const loadOlder = useCallback(async () => {
    if (!threadId || isLoadingOlder) return
    const key = queryKeys.threads.detail(threadId)
    const current = queryClient.getQueryData<ThreadData>(key)
    const oldest = current?.messages?.find((message) => !message.id.startsWith('optimistic-'))
    if (!oldest) return

    setIsLoadingOlder(true)
    try {
      const { messages, hasMore } = await fetchOlderThreadMessages(threadId, { createdAt: oldest.timestamp, id: oldest.id }, userId)
      if (!hasMore) setExhaustedFor(threadId)
      if (!messages.length) return
      queryClient.setQueryData<ThreadData>(key, (old) => {
        if (!old) return old
        const existing = new Set((old.messages || []).map((message) => message.id))
        return { ...old, messages: [...messages.filter((message) => !existing.has(message.id)), ...(old.messages || [])] }
      })
    } finally {
      setIsLoadingOlder(false)
    }
  }, [threadId, userId, isLoadingOlder, queryClient])

  return { hasOlder, isLoadingOlder, loadOlder }
}
