import { QueryClient, DefaultOptions } from '@tanstack/react-query'
import { PostgrestError } from '@supabase/supabase-js'

/**
 * Default options for React Query
 * Optimized for WhisprSpace's Supabase data fetching patterns
 */
const queryConfig: DefaultOptions = {
  queries: {
    // Time until data is considered stale
    staleTime: 60 * 1000, // 60 seconds (query-level hooks can override)
    
    // Time until inactive queries are garbage collected
    gcTime: 5 * 60 * 1000, // 5 minutes (formerly cacheTime)
    
    // Retry failed requests
    retry: (failureCount, error) => {
      // Don't retry on authentication errors
      if (error && typeof error === 'object' && 'code' in error) {
        const pgError = error as PostgrestError
        if (pgError.code === 'PGRST301' || pgError.code === '42501') {
          return false
        }
      }
      // Retry up to 3 times for other errors
      return failureCount < 3
    },
    
    // Retry delay with exponential backoff
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    
    // Avoid noisy global focus refetches. Opt in per-query where needed.
    refetchOnWindowFocus: false,
    
    // Don't refetch on reconnect by default (real-time handles this)
    refetchOnReconnect: false,
    
    // Don't refetch on mount if data exists and isn't stale
    refetchOnMount: false,
  },
  mutations: {
    // Retry mutations once on failure
    retry: 1,
    
    // Don't retry on network errors immediately
    retryDelay: 1000,
  },
}

/**
 * Create a new QueryClient instance
 * This should be called once per app instance (client-side only)
 */
export function createQueryClient() {
  return new QueryClient({
    defaultOptions: queryConfig,
  })
}

/**
 * Singleton QueryClient for use in server components and API routes
 * Note: For client components, use the QueryProvider instead
 */
let browserQueryClient: QueryClient | undefined = undefined

export function getQueryClient() {
  // Server: always create a new QueryClient
  if (typeof window === 'undefined') {
    return createQueryClient()
  }
  
  // Browser: reuse existing QueryClient or create new one
  if (!browserQueryClient) {
    browserQueryClient = createQueryClient()
  }
  
  return browserQueryClient
}
