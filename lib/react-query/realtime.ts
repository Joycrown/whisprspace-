'use client'

import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { subscribeToTable } from '@/lib/core/supabase/raw-realtime'

/**
 * Real-time Sync Utility
 * Synchronizes Supabase real-time subscriptions with React Query cache
 * 
 * Usage:
 * ```tsx
 * useRealtimeSync({
 *   table: 'conversations',
 *   event: '*',
 *   queryKey: queryKeys.conversations.lists(),
 *   schema: 'public'
 * })
 * ```
 */
interface RealtimeSyncOptions {
  /** Database table to subscribe to */
  table: string
  
  /** Event type: 'INSERT' | 'UPDATE' | 'DELETE' | '*' */
  event: 'INSERT' | 'UPDATE' | 'DELETE' | '*'
  
  /** Query key to invalidate when changes occur */
  queryKey: readonly unknown[]
  
  /** Optional filter (e.g., 'user_id=eq.123') */
  filter?: string
  
  /** Database schema (default: 'public') */
  schema?: string
  
  /** Custom callback for handling payload */
  onPayload?: (payload: any) => void

  /** Invalidate query automatically after each realtime payload (default: true) */
  invalidateQuery?: boolean
}

export function useRealtimeSync(options: RealtimeSyncOptions) {
  const queryClient = useQueryClient()
  const {
    table,
    event,
    queryKey,
    filter,
    schema = 'public',
    onPayload,
    invalidateQuery = true,
  } = options
  const queryKeyHash = JSON.stringify(queryKey)

  useEffect(() => {
    const unsubscribe = subscribeToTable(table, {
      event,
      schema,
      filter,
      onChange: (change) => {
        if (onPayload) {
          onPayload({
            eventType: change.type,
            schema: change.schema,
            table: change.table,
            new: change.record,
            old: change.old_record,
            record: change.record,
            old_record: change.old_record,
          })
        }

        if (invalidateQuery) {
          queryClient.invalidateQueries({ queryKey })
        }
      },
    })

    return () => {
      unsubscribe()
    }
    // NOTE: use JSON hash to avoid resubscribing every render from unstable array identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table, event, schema, filter, queryKeyHash, queryClient, onPayload, invalidateQuery])
}

/**
 * Hook to sync multiple tables at once
 */
export function useMultiTableRealtimeSync(configs: RealtimeSyncOptions[]) {
  configs.forEach((config) => {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useRealtimeSync(config)
  })
}

/**
 * Optimistic update helper
 * Provides utilities for optimistic mutations
 */
export function useOptimisticUpdate<TData = unknown>(queryKey: readonly unknown[]) {
  const queryClient = useQueryClient()
  
  return {
    /**
     * Set optimistic data in cache
     */
    setOptimistic: (updater: (old: TData | undefined) => TData) => {
      queryClient.setQueryData(queryKey, updater)
    },
    
    /**
     * Rollback to previous data
     */
    rollback: (previousData: TData) => {
      queryClient.setQueryData(queryKey, previousData)
    },
    
    /**
     * Invalidate query to refetch
     */
    invalidate: () => {
      queryClient.invalidateQueries({ queryKey })
    },
  }
}
