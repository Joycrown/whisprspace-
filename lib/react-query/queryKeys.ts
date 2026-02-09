/**
 * Centralized Query Key Factory
 * Provides type-safe, consistent query keys for React Query
 * 
 * Benefits:
 * - Easy cache invalidation
 * - Type safety
 * - Prevents typos
 * - Hierarchical structure for granular invalidation
 */

export const queryKeys = {
  /**
   * User-related queries
   */
  users: {
    // All user queries
    all: ['users'] as const,
    
    // User lists (if needed)
    lists: () => ['users', 'list'] as const,
    
    // Single user by ID (UUID)
    detail: (userId: string) => ['users', 'detail', userId] as const,
    
    // User profile by anonymous ID (public profile view)
    profile: (anonymousId: string) => ['users', 'profile', anonymousId] as const,
    
    // Current authenticated user
    current: () => ['users', 'current'] as const,
  },

  /**
   * Conversation/Messaging queries
   */
  conversations: {
    // All conversation queries
    all: ['conversations'] as const,
    
    // Conversation list for current user
    lists: () => ['conversations', 'list'] as const,
    
    // Single conversation detail
    detail: (conversationId: string) => ['conversations', 'detail', conversationId] as const,
    
    // Messages in a conversation (for infinite query)
    messages: (conversationId: string) => ['conversations', conversationId, 'messages'] as const,
    
    // Unread message count
    unreadCount: () => ['conversations', 'unread-count'] as const,
  },

  /**
   * Thread queries
   */
  threads: {
    // All thread queries
    all: ['threads'] as const,
    
    // Thread lists with optional filters
    lists: (filters?: Record<string, unknown>) => 
      filters ? ['threads', 'list', filters] as const : ['threads', 'list'] as const,
    
    // Single thread detail
    detail: (threadId: string) => ['threads', 'detail', threadId] as const,
    
    // Messages in a thread
    messages: (threadId: string) => ['threads', threadId, 'messages'] as const,
    
    // Thread reactions
    reactions: (threadId: string) => ['threads', threadId, 'reactions'] as const,
  },

  /**
   * Group queries
   */
  groups: {
    // All group queries
    all: ['groups'] as const,
    
    // Group lists
    lists: () => ['groups', 'list'] as const,
    
    // Single group detail
    detail: (groupId: string) => ['groups', 'detail', groupId] as const,
    
    // Group members
    members: (groupId: string) => ['groups', groupId, 'members'] as const,
    
    // Group threads
    threads: (groupId: string) => ['groups', groupId, 'threads'] as const,
  },

  /**
   * Notification queries
   */
  notifications: {
    // All notification queries
    all: ['notifications'] as const,
    
    // Notification list
    lists: () => ['notifications', 'list'] as const,
    
    // Unread notification count
    unreadCount: () => ['notifications', 'unread-count'] as const,
  },

  /**
   * Anonymous message queries
   */
  anonymousMessages: {
    // All anonymous message queries
    all: ['anonymous-messages'] as const,
    
    // Anonymous message list
    lists: () => ['anonymous-messages', 'list'] as const,
    
    // Single anonymous message
    detail: (messageId: string) => ['anonymous-messages', 'detail', messageId] as const,
  },

} as const

/**
 * Type helper for query keys
 */
export type QueryKeys = typeof queryKeys
