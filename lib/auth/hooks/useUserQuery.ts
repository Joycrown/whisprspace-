'use client'

import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/lib/react-query/queryKeys'
import * as rawAuth from '@/lib/core/supabase/raw-auth'
import * as rawDb from '@/lib/core/supabase/raw-db'
import { User } from '@/types'

/**
 * Hook for fetching current authenticated user
 * Integrates with Supabase auth
 */
export function useCurrentUserQuery() {
  const query = useQuery({
    queryKey: queryKeys.users.current(),
    queryFn: async () => {
      // Get current auth user
      const session = rawAuth.getSession()
      const authUser = session?.user
      
      if (!authUser) {
        return null
      }

      // Fetch full user profile from users table
      const { data: userData, error } = await rawDb.select<any>('users', {
        select: '*',
        filters: { 'id': rawDb.filter.eq(authUser.id) },
        single: true
      })

      if (error) {
        throw new Error(error.message)
      }

      if (!userData) {
        return null
      }

      // Map to User type
      const user: User = {
        id: userData.id,
        anonymousId: userData.anonymous_id,
        isAnonymous: userData.is_anonymous,
        joinedAt: userData.created_at,
        lastActiveAt: userData.last_active_at,
        preferences: userData.preferences,
        isPremium: userData.is_premium,
        premiumExpiresAt: userData.premium_expires_at,
        premiumProvider: userData.premium_provider,
        premiumLastTxRef: userData.premium_last_tx_ref,
      }

      return user
    },
    // Long stale time since user data changes infrequently
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    refetchOnWindowFocus: true,
  })

  return {
    user: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  }
}

/**
 * Hook for fetching user profile by ID or anonymous ID
 * Used for public profile views
 * 
 * @param userId User ID (UUID) or anonymous ID (string)
 */
export function useUserProfileQuery(userId: string | undefined) {
  const query = useQuery({
    queryKey: queryKeys.users.profile(userId || ''),
    queryFn: async () => {
      if (!userId) {
        throw new Error('User ID is required')
      }

      // Check if it's a UUID or anonymous ID
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)

      let userData
      let error

      // Try anonymous_id first (most common for profile routes)
      const { data: dataByAnonymousId, error: errorByAnonymousId } = await rawDb.select<any>('users', {
        select: '*',
        filters: { 'anonymous_id': rawDb.filter.eq(userId) },
        single: true
      })

      userData = dataByAnonymousId
      error = errorByAnonymousId

      // Fallback to UUID if not found and userId is a valid UUID
      if (!userData && isUuid) {
        const { data: dataById, error: errorById } = await rawDb.select<any>('users', {
          select: '*',
          filters: { 'id': rawDb.filter.eq(userId) },
          single: true
        })
        
        userData = dataById
        error = errorById
      }

      if (error || !userData) {
        throw new Error(error?.message || 'User not found')
      }

      // Map to User type
      const user: User = {
        id: userData.id,
        anonymousId: userData.anonymous_id,
        isAnonymous: userData.is_anonymous,
        joinedAt: userData.created_at,
        lastActiveAt: userData.last_active_at,
        preferences: userData.preferences,
        isPremium: userData.is_premium,
        premiumExpiresAt: userData.premium_expires_at,
        premiumProvider: userData.premium_provider,
        premiumLastTxRef: userData.premium_last_tx_ref,
      }

      return user
    },
    enabled: !!userId,
    // Medium stale time for other user profiles
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false, // Don't refetch other users on focus
  })

  return {
    user: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  }
}

