'use client'

import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/core/supabase/client'
import { RealtimeChannel } from '@supabase/supabase-js'

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
  } = options

  useEffect(() => {
    // Create unique channel name
    const channelName = `react-query-sync:${table}:${JSON.stringify(queryKey)}`
    
    let channel: RealtimeChannel
    
    // Set up subscription
    channel = supabase.channel(channelName)
    
    const subscriptionConfig: any = {
      event,
      schema,
      table,
      ...(filter && { filter }),
    }
    
    channel
      .on('postgres_changes' as any, subscriptionConfig, (payload: any) => {
        // Custom payload handler
        if (onPayload) {
          onPayload(payload)
        }
        
        // Invalidate queries to trigger refetch
        queryClient.invalidateQueries({ queryKey })
      })
      .subscribe()

    // Cleanup on unmount
    return () => {
      supabase.removeChannel(channel)
    }
  }, [table, event, schema, filter, queryKey, queryClient, onPayload])
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
