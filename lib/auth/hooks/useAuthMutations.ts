'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/lib/react-query/queryKeys'
import {
  signInAnonymously,
  signInWithEmail,
  signUpWithEmail,
  signOut,
  updateUserPreferences,
} from '@/lib/auth/auth-service'
import { User, UserPreferences } from '@/types'

/**
 * Hook for anonymous sign in
 */
export function useAnonymousSignInMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async () => {
      const user = await signInAnonymously()
      return user
    },
    
    onSuccess: (user) => {
      // Set current user in cache
      queryClient.setQueryData(queryKeys.users.current(), user)
    },
  })
}

/**
 * Hook for email/password sign in
 */
export function useSignInMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ email, password }: { email: string; password: string }) => {
      const user = await signInWithEmail(email, password)
      return user
    },
    
    onSuccess: (user) => {
      // Set current user in cache
      queryClient.setQueryData(queryKeys.users.current(), user)
    },
  })
}

/**
 * Hook for email/password sign up
 */
export function useSignUpMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ email, password }: { email: string; password: string }) => {
      const user = await signUpWithEmail(email, password)
      return user
    },
    
    onSuccess: (user) => {
      // Set current user in cache
      queryClient.setQueryData(queryKeys.users.current(), user)
    },
  })
}

/**
 * Hook for sign out
 */
export function useSignOutMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async () => {
      await signOut()
    },
    
    onSuccess: () => {
      // Clear all cached data on sign out
      queryClient.clear()
    },
  })
}

/**
 * Hook for updating user preferences
 */
export function useUpdatePreferencesMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      userId,
      preferences,
    }: {
      userId: string
      preferences: Partial<User['preferences']>
    }) => {
      await updateUserPreferences(userId, preferences)
      return preferences
    },
    
    // Optimistic update
    onMutate: async ({ userId, preferences }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: queryKeys.users.current() })

      // Snapshot previous value
      const previousUser = queryClient.getQueryData<User>(queryKeys.users.current())

      // Optimistically update
      if (previousUser) {
        queryClient.setQueryData<User>(queryKeys.users.current(), {
          ...previousUser,
          preferences: {
            ...previousUser.preferences,
            ...preferences,
          },
        })
      }

      return { previousUser }
    },
    
    // Rollback on error
    onError: (err, variables, context) => {
      if (context?.previousUser) {
        queryClient.setQueryData(queryKeys.users.current(), context.previousUser)
      }
    },
    
    // Refetch on success to confirm
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.users.current() })
    },
  })
}
