/* eslint-disable @typescript-eslint/no-unused-vars */
import { create } from 'zustand';
import { Thread, ThreadData, ThreadFilters, CreateThreadForm, Message, Attachment, Participant, ReactionType } from '@/types';
import { useUserStore } from './userStore';
import { calculateThreadExpiration } from '@/lib/utils/utils/helpers/threadHelpers';
import * as threadService from '@/lib/threads/thread-service';
import * as reactionService from '@/lib/threads/reaction-service';
import * as rawRealtime from '@/lib/core/supabase/raw-realtime';
import * as rawDb from '@/lib/core/supabase/raw-db';
// import { supabase } from '@/lib/core/supabase/client';
import type { RealtimeChannel } from '@supabase/supabase-js';

export interface ThreadStore {
  // State
  threads: Thread[];
  currentThread: ThreadData | null;
  filters: ThreadFilters;
  isLoading: boolean;
  error: string | null;
  searchQuery: string;
  page: number;
  limit: number;
  hasMore: boolean;
  messagesSubscription: any | null;
  
  // Actions
  fetchThreads: (append?: boolean, filtersOverride?: Partial<ThreadFilters>) => Promise<void>;
  fetchThreadById: (id: string) => Promise<void>;
  createThread: (threadData: CreateThreadForm) => Promise<string | null>;
  updateThread: (id: string, updates: Partial<ThreadData>) => void;
  deleteThread: (id: string) => Promise<void>;
  likeThread: (id: string) => Promise<void>;
  unlikeThread: (id: string) => Promise<void>;
  voteOnPoll: (threadId: string, optionId: string) => Promise<void>;
  addMessage: (threadId: string, message: Omit<Message, 'id' | 'timestamp' | 'replies'> & { attachments?: Attachment[] }) => Promise<boolean>;
  setFilters: (filters: Partial<ThreadFilters>) => void;
  setSearchQuery: (query: string) => void;
  clearCurrentThread: () => void;
  clearError: () => void;
  fetchGroupThreads: (groupId: string) => Promise<void>;
  subscribeToMessages: (threadId: string) => void;
  unsubscribeFromMessages: () => void;
  reactToMessage: (messageId: string, reactionType: string) => Promise<void>;
  
  // Premium Features
  removeUserFromThread: (threadId: string, userId: string) => Promise<boolean>;
}

export const useThreadStore = create<ThreadStore>()((set, get) => ({
  // Initial state
  threads: [],
  currentThread: null,
  filters: {
    sortBy: 'newest',
    category: 'all',
    type: 'all',
  },
  isLoading: false,
  error: null,
  searchQuery: '',
  page: 1,
  limit: 10,
  hasMore: true,
  messagesSubscription: null,

  // Actions
  fetchThreads: async (append = false, filtersOverride?: Partial<ThreadFilters>) => {
    set({ isLoading: true, error: null });
    
    try {
      const { filters, searchQuery, page, limit } = get();
      const effectiveFilters = filtersOverride ? { ...filters, ...filtersOverride } : filters;
      const userId = useUserStore.getState().session.user?.id;
      
      console.log('Store: fetchThreads called', { append, filters: effectiveFilters, page, limit, userId });
      
      const { threads: newThreads, hasMore } = await threadService.fetchThreads(
        effectiveFilters,
        searchQuery,
        page,
        limit,
        userId
      );
      
      console.log('Store: Received threads', newThreads.length);
      
      set(state => ({
        threads: append 
          ? Array.from(new Map(
              [...state.threads, ...newThreads].filter(t => t.id).map(thread => [thread.id, thread])
            ).values())
          : newThreads.filter(t => t.id),
        hasMore,
        isLoading: false,
      }));
    } catch (error) {
      console.error('Store: fetchThreads error', error);
      set({ 
        error: error instanceof Error ? error.message : 'Failed to fetch threads', 
        isLoading: false 
      });
    }
  },

  fetchThreadById: async (id: string) => {
    set({ isLoading: true, error: null });
    
    try {
      const userId = useUserStore.getState().session.user?.id;
      const thread = await threadService.fetchThreadById(id, userId);
      set({ currentThread: thread, isLoading: false });
    } catch (error) {
      set({ 
        error: 'Failed to fetch thread', 
        isLoading: false 
      });
    }
  },

  createThread: async (threadData: CreateThreadForm) => {
    set({ isLoading: true, error: null });
    
    try {
      const userId = useUserStore.getState().session.user?.id;
      console.log('Store: Creating thread', { userId, threadData });
      
      if (!userId) {
        throw new Error('Must be authenticated to create thread');
      }
      
      const threadId = await threadService.createThread(threadData, userId);
      console.log('Store: Thread created with ID:', threadId);
      
      if (!threadId) {
        throw new Error('Thread creation returned null');
      }
      
      set({ isLoading: false });
      
      // Reset pagination and fetch threads to include the new one
      get().setFilters({});
      
      return threadId;
    } catch (error) {
      console.error('Store: createThread error', error);
      set({ 
        error: error instanceof Error ? error.message : 'Failed to create thread', 
        isLoading: false 
      });
      return null;
    }
  },

  updateThread: (id: string, updates: Partial<ThreadData>) => {
    set(state => {
      const { currentThread, threads } = state;
      let updatedCurrentThread = currentThread;
      let updatedThreads = [...threads];

      // Update current thread if it matches
      if (updatedCurrentThread && updatedCurrentThread.id === id) {
        updatedCurrentThread = {
          ...updatedCurrentThread,
          ...updates,
        };
      }

      // Update the thread in the main list
      updatedThreads = updatedThreads.map(thread => 
        thread.id === id ? { ...thread, ...updates } as Thread : thread
      );

      return { 
        currentThread: updatedCurrentThread,
        threads: updatedThreads,
      };
    });
  },

  deleteThread: async (id: string) => {
    const userId = useUserStore.getState().session.user?.id;
    if (!userId) return;
    
    const success = await threadService.deleteThread(id, userId);
    if (success) {
      const { threads } = get();
      set({
        threads: threads.filter(thread => thread.id !== id),
        currentThread: get().currentThread?.id === id ? null : get().currentThread,
      });
    }
  },

  likeThread: async (id: string) => {
    const userId = useUserStore.getState().session.user?.id;
    if (!userId) return;
    
    const success = await threadService.likeThread(id, userId);
    if (success) {
      set(state => {
        const { threads, currentThread } = state;
        let updatedThreads = [...threads];
        let updatedCurrentThread = currentThread;

        updatedThreads = updatedThreads.map(thread => {
          if (thread.id === id && !thread.hasLiked) {
            return { ...thread, likes: thread.likes + 1, hasLiked: true };
          }
          return thread;
        });

        if (updatedCurrentThread && updatedCurrentThread.id === id && !updatedCurrentThread.hasLiked) {
          updatedCurrentThread = { ...updatedCurrentThread, likes: updatedCurrentThread.likes + 1, hasLiked: true };
        }

        return { threads: updatedThreads, currentThread: updatedCurrentThread };
      });
    }
  },

  unlikeThread: async (id: string) => {
    const userId = useUserStore.getState().session.user?.id;
    if (!userId) return;
    
    const success = await threadService.unlikeThread(id, userId);
    if (success) {
      set(state => {
        const { threads, currentThread } = state;
        let updatedThreads = [...threads];
        let updatedCurrentThread = currentThread;

        updatedThreads = updatedThreads.map(thread => {
          if (thread.id === id && thread.hasLiked) {
            return { ...thread, likes: Math.max(0, thread.likes - 1), hasLiked: false };
          }
          return thread;
        });

        if (updatedCurrentThread && updatedCurrentThread.id === id && updatedCurrentThread.hasLiked) {
          updatedCurrentThread = { ...updatedCurrentThread, likes: Math.max(0, updatedCurrentThread.likes - 1), hasLiked: false };
        }

        return { threads: updatedThreads, currentThread: updatedCurrentThread };
      });
    }
  },

  voteOnPoll: async (threadId: string, optionId: string) => {
    const userId = useUserStore.getState().session.user?.id;
    if (!userId) return;
    
    const { currentThread } = get();
    if (!currentThread || currentThread.type !== 'poll') return;
    
    // Get poll ID from current thread
    const pollId = currentThread.pollOptions?.[0]?.id; // This will need adjustment based on your data structure
    if (!pollId) return;
    
    const success = await threadService.voteOnPoll(pollId, optionId, userId);
    if (!success) return;
    set(state => {
      const { currentThread } = state;
      if (!currentThread || currentThread.id !== threadId || currentThread.type !== 'poll') {
        return state; // No change if not the current thread, or not a poll
      }

      // Check if user has already voted
      const hasAlreadyVoted = currentThread.pollOptions?.some(option => option.hasVoted);
      if (hasAlreadyVoted) {
        console.warn('User has already voted on this poll.');
        return state; // Prevent multiple votes
      }

      const updatedPollOptions = currentThread.pollOptions?.map(option => {
        if (option.id === optionId) {
          return {
            ...option,
            votes: option.votes + 1,
            hasVoted: true,
          };
        }
        return option;
      });

      const totalVotes = (updatedPollOptions || []).reduce((sum, option) => sum + option.votes, 0);

      const pollOptionsWithPercentages = updatedPollOptions?.map(option => ({
        ...option,
        percentage: totalVotes > 0 ? (option.votes / totalVotes) * 100 : 0,
      }));

      return {
        ...state,
        currentThread: {
          ...currentThread,
          pollOptions: pollOptionsWithPercentages,
        },
      };
    });
  },

  addMessage: async (threadId: string, messageData: Omit<Message, 'id' | 'timestamp' | 'replies'> & { attachments?: Attachment[] }) => {
    const user = useUserStore.getState().session.user;
    if (!user) return false;
    const userId = user.id;
    
    console.log('Adding message:', { threadId, content: messageData.content, replyToId: messageData.replyToId });
    
    // Optimistic Update
    const tempId = `temp-${Date.now()}`;
    const authorName = user.username || user.anonymousId || 'You';
    const optimisticMessage: Message = {
      ...messageData,
      id: tempId,
      threadId,
      authorId: userId,
      authorName,
      sender: {
        id: userId,
        anonymousId: user.anonymousId || 'anonymous',
        name: authorName,
        avatar: '#cccccc',
        isPremium: user.isPremium,
        status: 'online',
      },
      content: messageData.content,
      type: messageData.type || 'text',
      timestamp: new Date().toISOString(),
      likes: 0,
      hasLiked: false,
      replies: [],
      reactions: {},
      attachments: messageData.attachments || [],
      status: 'sending'
    };

    set(state => {
      const { currentThread } = state;
      if (!currentThread || currentThread.id !== threadId) return state;

      return {
        currentThread: {
          ...currentThread,
          messages: [...currentThread.messages, optimisticMessage],
        }
      };
    });

    const success = await threadService.addMessage(
      threadId,
      messageData.content,
      userId,
      messageData.type,
      messageData.attachments,
      messageData.replyToId
    );
    
    if (!success) {
      console.error('Failed to add message');
      // Revert optimistic update
      set(state => {
        const { currentThread } = state;
        if (!currentThread || currentThread.id !== threadId) return state;

        return {
          currentThread: {
            ...currentThread,
            messages: currentThread.messages.filter(m => m.id !== tempId),
          }
        };
      });
      return false;
    }
    
    console.log('Message added successfully to database');
    return true;
  },

  setFilters: (newFilters: Partial<ThreadFilters>) => {
    const isPageUpdate = newFilters.page !== undefined && Object.keys(newFilters).length === 1;
    
    if (isPageUpdate) {
      // Just update the page number for infinite scroll
      set(state => ({
        filters: { ...state.filters, ...newFilters },
        page: newFilters.page!,
      }));
      // Fetch more threads (append mode)
      get().fetchThreads(true);
    } else {
      // Full filter update - reset and fetch
      set(state => ({
        filters: { ...state.filters, ...newFilters },
        page: 1,
        threads: [],
        hasMore: true,
      }));
      // Fetch fresh threads
      get().fetchThreads();
    }
  },

  setSearchQuery: (query: string) => {
    set(state => ({
      searchQuery: query,
      page: 1,
    }));
  },

  fetchGroupThreads: async (groupId: string) => {
    set({ isLoading: true, error: null });
    try {
      const userId = useUserStore.getState().session.user?.id;
      const { threads, hasMore } = await threadService.fetchThreads(
        { groupId, sortBy: 'newest' },
        '',
        1,
        50,
        userId
      );
      set({ threads: threads.filter(t => t.id), hasMore, isLoading: false });
    } catch (error) {
      set({ 
        error: 'Failed to fetch group threads',
        isLoading: false
      });
    }
  },

  clearCurrentThread: () => {
    set({ currentThread: null });
  },

  clearError: () => {
    set({ error: null });
  },

  removeUserFromThread: async (threadId: string, userId: string) => {
    const { canRemoveUserFromThread } = await import('@/lib/utils/utils/helpers/threadHelpers');
    const currentUser = useUserStore.getState().session.user;
    const { currentThread, threads } = get();
    
    // Find the thread
    const thread = currentThread?.id === threadId ? currentThread : threads.find(t => t.id === threadId);
    
    if (!thread) {
      console.error('Thread not found');
      return false;
    }
    
    // Check if user can remove the target user
    const { canRemove, reason } = canRemoveUserFromThread(thread, currentUser, userId);
    
    if (!canRemove) {
      console.error(`Cannot remove user: ${reason}`);
      return false;
    }
    
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Update the thread to add user to removed list
    const removedUsers = [...(thread.removedUsers || []), userId];
    const participants = 'participants' in thread 
      ? (thread as ThreadData).participants.filter((p: any) => p.id !== userId)
      : [];
    
    const updates: Partial<ThreadData> = {
      removedUsers,
      participants,
      participantCount: Math.max(0, (thread.participantCount || 1) - 1),
    };
    
    get().updateThread(threadId, updates);
    console.log(`User ${userId} removed from thread ${threadId}`);
    
    return true;
  },



  subscribeToMessages: (threadId: string) => {
    const { messagesSubscription } = get();
    const userId = useUserStore.getState().session.user?.id;
    
    // Unsubscribe from previous subscription if exists
    if (messagesSubscription) {
      messagesSubscription.unsubscribe();
    }
    
    console.log('Subscribing to messages and reactions for thread:', threadId);
    
    
    const channel = rawRealtime.createChannel({
      channelName: `thread-${threadId}`,
      config: {
        presence: { key: userId || 'anonymous' },
        postgres_changes: [
          {
            event: 'INSERT',
            schema: 'public',
            table: 'messages',
            filter: `thread_id=eq.${threadId}`,
          },
          {
            event: '*',
            schema: 'public',
            table: 'message_reactions',
          }
        ]
      },
      onPostgresChange: async (change: any) => {
        // Handle Message INSERT
        if (change.table === 'messages' && change.type === 'INSERT') {
          console.log('New message received:', change);
          
          // Fetch the complete message with sender info using rawDb
          const { data: messageData, error } = await rawDb.select<any>('messages', {
            select: `
              *,
              sender:users!messages_sender_id_fkey(id, username, anonymous_id, is_premium, avatar_url),
              message_likes(user_id),
              parent_message:messages!parent_message_id(
                id,
                content,
                sender:users!messages_sender_id_fkey(id, username, anonymous_id, is_premium, avatar_url)
              )
            `.replace(/\s+/g, ''),
            filters: { 'id': rawDb.filter.eq(change.record.id) },
            single: true
          });
          
          if (error) {
            console.error('Error fetching new message:', error);
            return;
          }
          
          const message = messageData;
          if (!message) return;
          
          const { currentThread } = get();
          if (!currentThread || currentThread.id !== threadId) return;
          
          // Check if message already exists (avoid duplicates)
          const messageExists = currentThread.messages.some(m => m.id === message.id);
          if (messageExists) return;
          
          // Transform to Message type
          const senderName = message.sender.username || message.sender.anonymous_id;
          const newMessage: Message = {
            id: message.id,
            threadId: message.thread_id,
            authorId: message.sender.id,
            authorName: senderName,
            sender: {
              id: message.sender.id,
              anonymousId: message.sender.anonymous_id,
              name: senderName,
              avatar: message.sender.avatar_url || '#cccccc', // Use avatar from DB
              isPremium: message.sender.is_premium,
              status: 'online' as const,
            },
            content: message.content,
            type: message.type,
            timestamp: message.created_at,
            likes: message.likes_count || 0,
            hasLiked: userId ? message.message_likes?.some((like: any) => like.user_id === userId) : false,
            replyToId: message.parent_message_id,
            repliedMessage: message.parent_message ? {
              id: message.parent_message.id,
              content: message.parent_message.content,
              sender: message.parent_message.sender ? {
                 id: message.parent_message.sender.id,
                 anonymousId: message.parent_message.sender.anonymous_id,
                 name: message.parent_message.sender.username || message.parent_message.sender.anonymous_id,
                 avatar: message.parent_message.sender.avatar_url || '#cccccc',
                 status: 'offline' as const, // Default status for replied message sender
              } : {
                 id: 'deleted',
                 anonymousId: 'Deleted User',
                 name: 'Deleted User',
                 avatar: '#cccccc',
                 status: 'offline' as const,
              }
            } : undefined,
            replies: [],
            reactions: {},
            attachments: message.attachments || [],
          };
          
          console.log('Adding message to state:', newMessage);

          // Update participants
          let updatedParticipants = [...(currentThread.participants || [])];
          const senderId = newMessage.sender.id;
          const participantIndex = updatedParticipants.findIndex(p => p.id === senderId);

          if (participantIndex >= 0) {
            // Update existing participant
            updatedParticipants[participantIndex] = {
              ...updatedParticipants[participantIndex],
              messageCount: (updatedParticipants[participantIndex].messageCount || 0) + 1,
              // Update avatar/name if changed (optional, but good for consistency)
              avatar: newMessage.sender.avatar || updatedParticipants[participantIndex].avatar,
              name: newMessage.sender.name || updatedParticipants[participantIndex].name,
            };
          } else {
            // Add new participant
            updatedParticipants.push({
              ...newMessage.sender,
              messageCount: 1,
              reportCount: 0,
            });
          }
          
          // Check for optimistic message match (same content and author, temp ID)
          const optimisticMatchIndex = currentThread.messages.findIndex(m => 
            m.id.startsWith('temp-') && 
            m.content === newMessage.content && 
            m.authorId === newMessage.authorId
          );

          let updatedMessages;
          if (optimisticMatchIndex !== -1) {
            console.log('Replacing optimistic message with real one');
            updatedMessages = [...currentThread.messages];
            updatedMessages[optimisticMatchIndex] = newMessage;
          } else {
            updatedMessages = [...currentThread.messages, newMessage];
          }

          set({
            currentThread: {
              ...currentThread,
              messages: updatedMessages,
              participants: updatedParticipants,
              participantCount: updatedParticipants.length,
              messageCount: (currentThread.messageCount || 0) + 1,
              latestMessage: newMessage.content.substring(0, 100),
              updatedAt: new Date().toISOString(),
            },
          });
        }
        
        // Handle Reaction Changes
        if (change.table === 'message_reactions') {
          console.log('⚡ Real-time reaction:', change.type);
          
          const messageId = change.record?.message_id || change.old_record?.message_id;
          if (!messageId) return;
          
          const { currentThread } = get();
          if (!currentThread) return;
          
          // Check if this message belongs to current thread
          const messageIndex = currentThread.messages.findIndex(m => m.id === messageId);
          if (messageIndex === -1) return;
          
          // Fast update: Fetch only this message's reactions
          // We can use the reactionService (which now uses raw-db)
          const reactions = await reactionService.getMessageReactions(messageId, userId);
          
          // Batch update to avoid multiple re-renders
          const updatedMessages = [...currentThread.messages];
          updatedMessages[messageIndex] = {
            ...updatedMessages[messageIndex],
            reactions: Object.entries(reactions).reduce((acc, [key, value]) => {
              acc[key as any] = {
                count: value.count,
                users: value.users,
              };
              return acc;
            }, {} as any),
          };
          
          set({
            currentThread: {
              ...currentThread,
              messages: updatedMessages,
            },
          });
          
          console.log('✅ Reaction synced');
        }
      }
    });

    // Best-effort realtime — a join timeout must not surface as an unhandled
    // rejection. The socket auto-rejoins in the background.
    channel.subscribe().catch((err) => {
      console.warn('[ThreadStore] messages channel subscribe failed (non-fatal):', err);
    });

    set({ messagesSubscription: channel });
  },

  unsubscribeFromMessages: () => {
    const { messagesSubscription } = get();
    
    if (messagesSubscription) {
      console.log('Unsubscribing from messages');
      messagesSubscription.unsubscribe();
      set({ messagesSubscription: null });
    }
  },

  reactToMessage: async (messageId: string, reactionType: string) => {
    const userId = useUserStore.getState().session.user?.id;
    if (!userId) {
      console.error('No user ID found');
      return;
    }

    console.log('🎭 Reacting to message:', { messageId, reactionType, userId });

    const { currentThread } = get();
    if (!currentThread) {
      console.error('No current thread');
      return;
    }

    // Find message
    const messageIndex = currentThread.messages.findIndex(m => m.id === messageId);
    if (messageIndex === -1) return;

    const message = currentThread.messages[messageIndex];
    const currentReactions = { ...(message.reactions || {}) };

    // OPTIMISTIC UPDATE: Update UI immediately
    const type = reactionType as ReactionType;
    const userAlreadyReacted = currentReactions[type]?.users?.includes(userId);
    
    if (userAlreadyReacted) {
      // Remove reaction optimistically
      const newUsers = currentReactions[type]!.users.filter(id => id !== userId);
      if (newUsers.length === 0) {
        delete currentReactions[type];
      } else {
        currentReactions[type] = {
          count: newUsers.length,
          users: newUsers,
        };
      }
    } else {
      // Add reaction optimistically
      // Remove any other reactions from this user first
      (Object.keys(currentReactions) as ReactionType[]).forEach(t => {
        if (currentReactions[t]?.users.includes(userId)) {
          const newUsers = currentReactions[t]!.users.filter(id => id !== userId);
          if (newUsers.length === 0) {
            delete currentReactions[t];
          } else {
            currentReactions[t] = {
              count: newUsers.length,
              users: newUsers,
            };
          }
        }
      });
      
      // Add new reaction
      currentReactions[type] = {
        count: (currentReactions[type]?.count || 0) + 1,
        users: [...(currentReactions[type]?.users || []), userId],
      };
    }

    // Update state immediately (optimistic)
    const updatedMessages = [...currentThread.messages];
    updatedMessages[messageIndex] = {
      ...updatedMessages[messageIndex],
      reactions: currentReactions,
    };

    set({
      currentThread: {
        ...currentThread,
        messages: updatedMessages,
      },
    });

    console.log('⚡ Optimistic update applied');

    // Then save to database (background)
    const success = await reactionService.addMessageReaction(messageId, userId, reactionType);
    
    if (!success) {
      console.error('❌ Failed to save reaction, reverting...');
      // Revert optimistic update
      const revertedMessages = [...currentThread.messages];
      revertedMessages[messageIndex] = message; // Restore original
      set({
        currentThread: {
          ...get().currentThread!,
          messages: revertedMessages,
        },
      });
      return;
    }

    console.log('✅ Reaction saved to database');
  },
}));



