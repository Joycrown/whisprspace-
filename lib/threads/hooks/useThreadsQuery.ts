'use client'

import { useQuery, useInfiniteQuery } from '@tanstack/react-query'
import { queryKeys } from '@/lib/react-query/queryKeys'
import { ThreadFilters } from '@/types'
import { fetchThreads } from '../thread-service'

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
    queryFn: async ({ pageParam = 1 }) => {
      const result = await fetchThreads(
        filters || {},
        searchQuery || '',
        pageParam,
        10, // limit per page
        userId
      )
      
      return result
    },
    getNextPageParam: (lastPage, pages) => {
      if (!lastPage.hasMore || lastPage.threads.length === 0) {
        return undefined
      }

      // Defensive guard: stop pagination if backend returns duplicate page rows.
      // This prevents an infinite fetch loop when the sentinel stays visible.
      const previousThreadIds = new Set(
        pages
          .slice(0, -1)
          .flatMap((page) => page.threads.map((thread) => thread.id))
      )

      const hasNewThread = lastPage.threads.some((thread) => !previousThreadIds.has(thread.id))
      if (!hasNewThread) {
        return undefined
      }

      return pages.length + 1
    },
    initialPageParam: 1,
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
      
      return threadData
    },
    enabled: detailEnabled,
    staleTime: 30 * 1000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
    // Lightweight reliability fallback for intermittent realtime dropouts.
    refetchInterval: detailEnabled ? 30000 : false,
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
