/**
 * Auth React Query Hooks
 * Exports all authentication-related hooks
 */

// Query hooks
export {
  useCurrentUserQuery,
  useUserProfileQuery,
} from './hooks/useUserQuery'

// Mutation hooks
export {
  useAnonymousSignInMutation,
  useSignInMutation,
  useSignUpMutation,
  useSignOutMutation,
  useUpdatePreferencesMutation,
} from './hooks/useAuthMutations'

// Re-export services for backward compatibility
export * from './auth-service'
