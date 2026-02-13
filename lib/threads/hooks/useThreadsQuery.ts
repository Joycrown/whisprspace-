'use client'

import { useQuery, useInfiniteQuery } from '@tanstack/react-query'
import { queryKeys } from '@/lib/react-query/queryKeys'
import { Thread, ThreadFilters } from '@/types'
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
      // If hasMore is true, return next page number
      return lastPage.hasMore ? pages.length + 1 : undefined
    },
    initialPageParam: 1,
    staleTime: 1 * 60 * 1000, // 1 minute
    refetchOnWindowFocus: true,
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
        throw new Error('Failed to fetch thread')
      }
      
      return threadData
    },
    enabled: detailEnabled,
    staleTime: 0, // 0 for Debugging (Always refetch)
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    // Reliability fallback for intermittent realtime dropouts.
    // Keeps active thread timelines fresh without requiring manual reload.
    refetchInterval: detailEnabled ? 5000 : false,
    refetchIntervalInBackground: false,
  })

  return {
    thread: query.data,
    isLoading: query.isLoading,
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
