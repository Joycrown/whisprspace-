/**
 * Messaging React Query Hooks
 * Exports all messaging-related hooks
 */

// Query hooks
export { useConversationsQuery, useUnreadCountQuery, useUnreadCountQuery as useMessageBadge } from './hooks/useConversationsQuery'
export { useConversationQuery } from './hooks/useConversationQuery'
export { useMessagesQuery } from './hooks/useMessagesQuery'

// Mutation hooks
export {
  useSendMessageMutation,
  useEditMessageMutation,
  useDeleteMessageMutation,
  useMarkConversationReadMutation,
  useGetOrCreateConversationMutation,
  useCreateOneTimeConversationMutation,
} from './hooks/useMessageMutations'

// Re-export types and services for backward compatibility
export * from './messaging-service'
