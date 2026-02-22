import * as rawDb from '@/lib/core/supabase/raw-db';
import * as rawAuth from '@/lib/core/supabase/raw-auth';
import { Thread, ThreadData, ThreadFilters, CreateThreadForm, Participant, Message, AccessCode, CHARACTER_LIMITS } from '@/types';
import { calculateThreadExpiration } from '../utils/utils/helpers/threadHelpers';
import { uploadService } from '@/lib/utils/upload-service';
import { MESSAGE_CONFIG } from '@/lib/core/constants';

export interface ThreadInviteItem {
  inviteId: string;
  status: string;
  createdAt: string;
  thread: Thread;
}

/**
 * Fetch threads with filters, search, and pagination
 */
export const fetchThreads = async (
  filters: ThreadFilters,
  searchQuery: string,
  page: number,
  limit: number,
  userId?: string
): Promise<{ threads: Thread[]; hasMore: boolean }> => {
  try {
    // Build filter object for rawDb
    const queryFilters: Record<string, string> = {};
    
    // Select string
    const selectStr = '*,thread_likes(user_id),creator:users!threads_creator_id_fkey(id,username,anonymous_id,is_premium,avatar_url),thread_participants(user_id)';
    
    // Deleted check
    queryFilters['deleted_at'] = 'is.null';

    const sanitizeSearch = (value: string) =>
      value.replace(/[(),]/g, ' ').trim();

    const savedOrConditions = userId
      ? `is_saved.is.null,is_saved.eq.false,and(is_saved.eq.true,creator_id.eq.${userId})`
      : 'is_saved.is.null,is_saved.eq.false';

    const nowIso = new Date().toISOString();
    const expirationMode = filters.expiration ?? 'active';
    const expirationLogic =
      expirationMode === 'active'
        ? `or(expires_at.is.null,expires_at.gt.${nowIso})`
        : expirationMode === 'expired'
          ? `and(expires_at.not.is.null,expires_at.lte.${nowIso})`
          : null;

    // Search + visibility + expiration are composed as grouped logical expressions.
    if (searchQuery) {
      const safeSearch = sanitizeSearch(searchQuery);
      const savedLogic = `or(${savedOrConditions})`;
      const searchLogic = `or(title.ilike.*${safeSearch}*,content.ilike.*${safeSearch}*)`;
      const andConditions = [savedLogic, searchLogic];
      if (expirationLogic) {
        andConditions.push(expirationLogic);
      }
      queryFilters['and'] = `(${andConditions.join(',')})`;
    } else if (expirationLogic) {
      queryFilters['and'] = `(or(${savedOrConditions}),${expirationLogic})`;
    } else {
      // Saved/Visibility logic using horizontal filtering (OR)
      queryFilters['or'] = `(${savedOrConditions})`;
    }

    // Category
    if (filters.category && filters.category !== 'all') {
      queryFilters['category'] = `eq.${filters.category}`;
    }

    // Type
    if (filters.type && filters.type !== 'all') {
      queryFilters['type'] = `eq.${filters.type}`;
    }

    // Group
    if (filters.groupId) {
      queryFilters['group_id'] = `eq.${filters.groupId}`;
    }

    // Premium
    if (filters.isPremium !== undefined) {
      queryFilters['is_premium'] = `eq.${filters.isPremium}`;
    }

    // Privacy
    if (filters.privacy && filters.privacy !== 'all') {
      if (filters.privacy === 'public') {
        queryFilters['privacy'] = 'eq.public';
      } else {
        queryFilters['privacy'] = `eq.${filters.privacy}`;
      }
    } else if (!filters.privacy) {
      queryFilters['privacy'] = 'eq.public';
    }

    // Sorting
    let orderBy = 'created_at';
    let ascending = false;

    switch (filters.sortBy) {
      case 'newest':
        orderBy = 'created_at';
        break;
      case 'popular':
        orderBy = 'likes_count';
        break;
      case 'trending':
        orderBy = 'message_count';
        break;
      case 'oldest':
        orderBy = 'created_at';
        ascending = true;
        break;
      default:
        orderBy = 'created_at';
    }

    const { data, error } = await rawDb.select<any[]>('threads', {
      select: selectStr,
      filters: queryFilters,
      order: { column: orderBy, ascending },
      limit: limit,
      offset: (page - 1) * limit
    });

    if (error) {
      console.error('RawDb query error:', error)
      throw error
    }

    const threadRows = data || []
    const threadIds = threadRows.map((thread: any) => thread.id).filter(Boolean)
    let purchasedThreadIds = new Set<string>()

    if (userId && threadIds.length > 0) {
      const { data: purchases, error: purchaseError } = await rawDb.select<any[]>('thread_purchases', {
        select: 'thread_id',
        filters: {
          'user_id': rawDb.filter.eq(userId),
          'thread_id': rawDb.filter.in(threadIds),
        },
      })

      if (purchaseError) {
        console.warn('Failed to fetch thread purchases for access checks:', purchaseError)
      } else {
        purchasedThreadIds = new Set((purchases || []).map((row: any) => row.thread_id))
      }
    }

    // Transform database records to Thread type
    const threads: Thread[] = threadRows.map(thread => transformThread(thread, userId, purchasedThreadIds))

    // Check if there are more threads
    const hasMore = (data || []).length === limit

    return { threads, hasMore }


  } catch (error) {
    console.error('fetchThreads error:', error)
    throw error
  }
}

/**
 * Fetch a single thread by ID with all details
 */
export const fetchThreadById = async (
  threadId: string,
  userId?: string
): Promise<ThreadData | null> => {
  try {
    const select = `
      *,
      creator:users!threads_creator_id_fkey(id, username, anonymous_id, is_premium, avatar_url),
      thread_likes(user_id),
      thread_participants(user_id, user:users(id, username, anonymous_id, is_premium, avatar_url)),
      messages!messages_thread_id_fkey(
        *,
        sender:users!messages_sender_id_fkey(id, username, anonymous_id, is_premium, avatar_url),
        message_likes(user_id),
        parent_message:messages!parent_message_id(
          id,
          content,
          sender:users!messages_sender_id_fkey(id, username, anonymous_id, avatar_url, is_premium)
        ),
        message_reactions(reaction_type, user_id)
      ),
      
      poll:polls(
        id,
        question,
        duration_hours,
        allow_multiple_votes,
        expires_at,
        poll_options(id, text, vote_count, order_index),
        poll_votes(user_id, option_id)
      )
    `.replace(/\s+/g, '');

    const { data, error } = await rawDb.select<any>('threads', {
      select,
      filters: {
        'id': rawDb.filter.eq(threadId),
        'deleted_at': 'is.null',
        // Nested ordering/limits for messages
        'messages.order': 'created_at.desc',
        'messages.limit': 50
      },
      single: true
    });

    if (error) throw error
    if (!data) return null

    let purchasedThreadIds: Set<string> | undefined;
    if (userId) {
      const { data: purchases, error: purchaseError } = await rawDb.select<any[]>('thread_purchases', {
        select: 'thread_id',
        filters: {
          'thread_id': rawDb.filter.eq(threadId),
          'user_id': rawDb.filter.eq(userId),
        },
      });

      if (purchaseError) {
        console.warn('Failed to fetch thread purchase access for detail view:', purchaseError);
      } else {
        purchasedThreadIds = new Set((purchases || []).map((row: any) => row.thread_id));
      }
    }

    return transformThreadData(data, userId, purchasedThreadIds)
  } catch (error) {
    console.error('fetchThreadById error:', error)
    return null
  }
}

/**
 * Create a new thread
 */
export const createThread = async (
  threadData: CreateThreadForm,
  userId: string
): Promise<string | null> => {
  try {
      console.log('Service: Creating thread', { threadData, userId });

      const title = threadData.title?.trim() || '';
      const content = threadData.content?.trim() || '';

      if (!title) {
        throw new Error('Thread title is required');
      }

      if (title.length > CHARACTER_LIMITS.title) {
        throw new Error(`Thread title must be ${CHARACTER_LIMITS.title} characters or fewer.`);
      }

      if (!content) {
        throw new Error('Thread content is required');
      }

      if (content.length > CHARACTER_LIMITS.content) {
        throw new Error(`Thread content must be ${CHARACTER_LIMITS.content} characters or fewer.`);
      }
    
    // Get user's premium status
    const { data: userData } = await rawDb.select('users', {
      select: 'is_premium',
      filters: { 'id': rawDb.filter.eq(userId) },
      single: true
    });
    
      const isUserPremium = (userData as any)?.is_premium || false;

      const isPremiumThread = threadData.type === 'premium' || threadData.isPremium === true;

      if (isPremiumThread) {
        const price = Number(threadData.price);
        if (!price || Number.isNaN(price) || price <= 0) {
          throw new Error('Premium threads require a valid price');
        }

        const minPrice = 1.0;
        const maxPrice = isUserPremium ? 4.99 : 2.99;
        if (price < minPrice) {
          throw new Error(`Minimum price is $${minPrice.toFixed(2)} for premium threads.`);
        }

        if (price > maxPrice) {
          throw new Error(
            `Maximum price for ${isUserPremium ? 'premium' : 'free'} creators is $${maxPrice.toFixed(2)}.`
          );
        }
      }

      if (threadData.type === 'poll' && !isUserPremium) {
        const now = new Date();
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

        const { data: recentPolls, error: recentError } = await rawDb.select<any[]>('threads', {
          select: 'id',
          filters: {
            'creator_id': rawDb.filter.eq(userId),
            'type': rawDb.filter.eq('poll'),
            'deleted_at': 'is.null',
            'created_at': rawDb.filter.gte(weekAgo),
          },
          limit: 2,
        });

        if (recentError) {
          throw new Error('Failed to validate poll limits');
        }

        if ((recentPolls || []).length >= 2) {
          throw new Error('Free users can create up to 2 polls per week. Upgrade to Premium for unlimited polls.');
        }

        const { data: activePolls, error: activeError } = await rawDb.select<any[]>('threads', {
          select: 'id',
          filters: {
            'creator_id': rawDb.filter.eq(userId),
            'type': rawDb.filter.eq('poll'),
            'deleted_at': 'is.null',
            'expires_at': rawDb.filter.gt(now.toISOString()),
          },
          limit: 2,
        });

        if (activeError) {
          throw new Error('Failed to validate active poll limits');
        }

        if ((activePolls || []).length >= 2) {
          throw new Error('Free users can have at most 2 active polls at a time. Upgrade to Premium for unlimited polls.');
        }
      }

    // Create the thread
    const { data: threadDataResult, error: threadError } = await rawDb.insert('threads', {
      creator_id: userId,
      title,
      content,
      type: threadData.type,
      category: threadData.category,
      privacy: threadData.privacy || 'public',
      member_limit: threadData.privacy === 'invite_only'
        ? (threadData.memberLimit ?? 10)
        : null,
      is_premium: threadData.isPremium || false,
      price: threadData.price,
      expires_at: threadData.type === 'poll' 
        ? new Date(Date.now() + (threadData.pollDuration || 24) * 60 * 60 * 1000).toISOString()
        : calculateThreadExpiration(threadData.isPremium || false), // Use thread premium status
    });

    const thread = threadDataResult?.[0]; // Insert returns array

    if (threadError) {
      console.error('Service: Thread creation error:', threadError);
      throw new Error(`Failed to create thread: ${threadError.message}`);
    }
    if (!thread) throw new Error('Thread creation failed - no data returned')

    console.log('Service: Thread created', thread.id);

    // Auto-join creator to thread_participants
    await rawDb.insert('thread_participants', {
      thread_id: thread.id,
      user_id: userId
    }, { returning: false }).catch(err => {
      console.warn('⚠️ Service: Failed to auto-join creator:', err);
    });

      // If it's a poll, create poll and options
      if (threadData.type === 'poll' && threadData.pollOptions) {
        console.log('Service: Creating poll for thread', thread.id);
      const { data: pollData, error: pollError } = await rawDb.insert('polls', {
        thread_id: thread.id,
        question: threadData.title,
        duration_hours: threadData.pollDuration || 24,
        allow_multiple_votes: false,
        expires_at: new Date(Date.now() + (threadData.pollDuration || 24) * 60 * 60 * 1000).toISOString(),
      });

      const poll = pollData?.[0];

      if (pollError) throw pollError
      if (!poll) throw new Error('Poll creation failed')

      // Create poll options
      const options = threadData.pollOptions
        .filter(opt => opt.trim())
        .map((text, index) => ({
          poll_id: poll.id,
          text,
          order_index: index,
        }))

      if (options.length > 0) {
        const { error: optionsError } = await rawDb.insert('poll_options', options);

        if (optionsError) throw optionsError
      }
    }

    return thread.id
  } catch (error) {
    console.error('createThread error:', error)
    throw error
  }
}

/**
 * Get poll creation stats for a user (weekly + active)
 */
export const getUserPollStats = async (
  userId: string
): Promise<{ weeklyCount: number; activeCount: number }> => {
  try {
    const now = new Date()
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()

    const { data: weeklyPolls, error: weeklyError } = await rawDb.select<any[]>('threads', {
      select: 'id',
      filters: {
        'creator_id': rawDb.filter.eq(userId),
        'type': rawDb.filter.eq('poll'),
        'deleted_at': 'is.null',
        'created_at': rawDb.filter.gte(weekAgo),
      },
      limit: 100,
    })

    if (weeklyError) {
      throw weeklyError
    }

    const { data: activePolls, error: activeError } = await rawDb.select<any[]>('threads', {
      select: 'id',
      filters: {
        'creator_id': rawDb.filter.eq(userId),
        'type': rawDb.filter.eq('poll'),
        'deleted_at': 'is.null',
        'expires_at': rawDb.filter.gt(now.toISOString()),
      },
      limit: 100,
    })

    if (activeError) {
      throw activeError
    }

    return {
      weeklyCount: (weeklyPolls || []).length,
      activeCount: (activePolls || []).length,
    }
  } catch (error) {
    console.error('getUserPollStats error:', error)
    return { weeklyCount: 0, activeCount: 0 }
  }
}



/**
 * Like a thread
 */
export const likeThread = async (threadId: string, userId: string): Promise<boolean> => {
  try {
    const { error } = await rawDb.insert('thread_likes', {
      thread_id: threadId,
      user_id: userId,
    }, { returning: false });

    if (error) throw error

    return true
  } catch (error) {
    console.error('likeThread error:', error)
    return false
  }
}

/**
 * Unlike a thread
 */
export const unlikeThread = async (threadId: string, userId: string): Promise<boolean> => {
  try {
    const { error } = await rawDb.remove('thread_likes', {
      'thread_id': rawDb.filter.eq(threadId),
      'user_id': rawDb.filter.eq(userId)
    });

    if (error) throw error
    return true
  } catch (error) {
    console.error('unlikeThread error:', error)
    return false
  }
}

/**
 * Like a message
 */
export const likeMessage = async (messageId: string, userId: string): Promise<boolean> => {
  try {
    const { error } = await rawDb.insert('message_likes', {
      message_id: messageId,
      user_id: userId,
    }, { returning: false });

    if (error) throw error

    return true
  } catch (error) {
    console.error('likeMessage error:', error)
    return false
  }
}

/**
 * Unlike a message
 */
export const unlikeMessage = async (messageId: string, userId: string): Promise<boolean> => {
  try {
    const { error } = await rawDb.remove('message_likes', {
      'message_id': rawDb.filter.eq(messageId),
      'user_id': rawDb.filter.eq(userId)
    });

    if (error) throw error
    return true
  } catch (error) {
    console.error('unlikeMessage error:', error)
    return false
  }
}

/**
 * Add a reaction to a message
 */
export const addMessageReaction = async (
  messageId: string,
  userId: string,
  reaction: string
): Promise<boolean> => {
  try {
    const { error } = await rawDb.insert('message_reactions', {
      message_id: messageId,
      user_id: userId,
      reaction_type: reaction,
    }, { returning: false });

    if (error) {
      const errorMsg = error.message || '';
      // Ignore unique constraint violations (user already reacted with this emoji)
      if (errorMsg.includes('23505') || errorMsg.includes('duplicate key')) return true;
      throw error;
    }

    
    return true
  } catch (error) {
    console.error('addMessageReaction error:', error)
    return false
  }
}

/**
 * Remove a reaction from a message
 */
export const removeMessageReaction = async (
  messageId: string,
  userId: string,
  reaction: string
): Promise<boolean> => {
  try {
    const { error } = await rawDb.remove('message_reactions', {
      'message_id': rawDb.filter.eq(messageId),
      'user_id': rawDb.filter.eq(userId),
      'reaction_type': rawDb.filter.eq(reaction)
    });

    if (error) throw error
    return true
  } catch (error) {
    console.error('removeMessageReaction error:', error)
    return false
  }
}

/**
 * Vote on a poll
 */
export const voteOnPoll = async (
  pollId: string,
  optionId: string,
  userId: string
): Promise<boolean> => {
  try {
    const { error } = await rawDb.insert('poll_votes', {
      poll_id: pollId,
      option_id: optionId,
      user_id: userId,
    }, { returning: false });

    if (error) throw error

    return true
  } catch (error) {
    console.error('voteOnPoll error:', error)
    return false
  }
}

/**
 * Add a message to a thread
 */
/**
 * Add a message to a thread
 */
export const addMessage = async (
  threadId: string,
  content: string,
  userId: string,
  type: 'text' | 'voice' | 'image' | 'file' | 'link' = 'text',
  attachments?: unknown[],
  replyToId?: string
): Promise<Message> => {
  const { data: insertedData, error: insertError } = await rawDb.insert('messages', {
    thread_id: threadId,
    sender_id: userId,
    content,
    type,
    attachments: attachments || [],
    parent_message_id: replyToId || null,
  }, { returning: true });

  const inserted = insertedData?.[0];

  if (insertError) {
    throw insertError;
  }

  if (!inserted?.id) {
    throw new Error('Message entry created but no ID returned');
  }

  return transformMessage(
    {
      ...inserted,
      sender: {
        id: userId,
        username: 'You',
        anonymous_id: 'You',
        avatar_url: '#cccccc',
        is_premium: false,
      },
      message_likes: [],
      message_reactions: [],
      parent_message: replyToId
        ? {
            id: replyToId,
            content: '',
            sender: null,
          }
        : null,
    },
    userId
  );
}

/**
 * Edit a thread message owned by the current user.
 */
export const editThreadMessage = async (
  messageId: string,
  content: string,
  userId: string
): Promise<Message> => {
  const nextContent = content.trim();
  if (!nextContent) {
    throw new Error('Message cannot be empty');
  }
  if (nextContent.length > MESSAGE_CONFIG.maxLength) {
    throw new Error(`Message must be ${MESSAGE_CONFIG.maxLength} characters or fewer.`);
  }

  const { data: updatedRows, error: updateError } = await rawDb.update<any[]>(
    'messages',
    {
      content: nextContent,
      is_edited: true,
      edited_at: new Date().toISOString(),
    },
    {
      'id': rawDb.filter.eq(messageId),
      'sender_id': rawDb.filter.eq(userId),
      'deleted_at': 'is.null',
    }
  );

  if (updateError) {
    throw updateError;
  }

  const updated = updatedRows?.[0];
  if (!updated?.id) {
    throw new Error('Message not found or not editable');
  }

  const selectStr = `
    *,
    sender:users!messages_sender_id_fkey(id, username, anonymous_id, is_premium, avatar_url),
    message_likes(user_id),
    message_reactions(reaction_type, user_id),
    parent_message:messages!parent_message_id(
      id,
      content,
      sender:users!messages_sender_id_fkey(id, username, anonymous_id, avatar_url, is_premium)
    )
  `.replace(/\s+/g, '');

  const { data: fetchedData, error: fetchError } = await rawDb.select<any>('messages', {
    select: selectStr,
    filters: { 'id': rawDb.filter.eq(updated.id) },
    single: true,
  });

  if (fetchError || !fetchedData) {
    throw fetchError || new Error('Message updated but could not be retrieved');
  }

  return transformMessage(fetchedData, userId);
}

/**
 * Update a thread
 */
export const updateThread = async (
  threadId: string,
  updates: Partial<Thread>,
  userId: string
): Promise<Thread | null> => {
  try {
    // Map Thread types to DB columns
    const dbUpdates: any = {
      updated_at: new Date().toISOString()
    };
    
    if (updates.title) dbUpdates.title = updates.title;
    if (updates.content) dbUpdates.content = updates.content;
    if (updates.isLocked !== undefined) dbUpdates.is_locked = updates.isLocked;
    if (updates.isPinned !== undefined) dbUpdates.is_pinned = updates.isPinned;
    if (updates.privacy) dbUpdates.privacy = updates.privacy;
    if (updates.memberLimit !== undefined) {
      dbUpdates.member_limit = updates.memberLimit;
    } else if (updates.privacy === 'public') {
      dbUpdates.member_limit = null;
    }
    
    const { data: updatedData, error } = await rawDb.update<any>('threads', dbUpdates, {
      'id': rawDb.filter.eq(threadId),
      'creator_id': rawDb.filter.eq(userId)
    });

    if (error) throw error;
    if (!updatedData || updatedData.length === 0) return null;

    // Fetch full thread details to return strict Thread object
    // Or just return simplistic version if acceptable?
    // Using fetchThreadById logic to ensure consistent return type
    return fetchThreadById(threadId, userId);
  } catch (error) {
    console.error('updateThread error:', error);
    return null;
  }
}

/**
 * Delete a thread (hard delete)
 * Removes the thread, all associated data, and storage attachments
 */
export const deleteThread = async (threadId: string, userId: string): Promise<boolean> => {
  try {
    console.log(`🗑️ Starting hard delete for thread: ${threadId} (User: ${userId})`);

    // 1. Storage Cleanup: Delete all attachments for this thread
    // Typical folder structure: messages/{threadId}
    const storageFolder = `messages/${threadId}`;
    try {
       await uploadService.deleteFolder('thread-attachments', storageFolder);
    } catch (storageError) {
       console.error('⚠️ Storage cleanup failed, continuing with DB deletion:', storageError);
    }

    // 2. Database Cleanup: Handle constraints by nullifying references in payments/earnings
    // This is optional if ON DELETE CASCADE is NOT set but we want to keep payment records
    // Actually the user said "removing all other stuffs related with it", 
    // but typically payments should be kept for audit/history, just disconnect from thread.
    
    // Nullify references in payments
    await rawDb.update('payments', { thread_id: null }, { 'thread_id': rawDb.filter.eq(threadId) }, { returning: false }).catch(err => {
      console.warn('⚠️ Failed to nullify payment references:', err);
    });

    // Nullify references in creator_earnings
    await rawDb.update('creator_earnings', { thread_id: null }, { 'thread_id': rawDb.filter.eq(threadId) }, { returning: false }).catch(err => {
      console.warn('⚠️ Failed to nullify earnings references:', err);
    });

    // 3. Hard Delete the thread record
    // Cascading deletes will handle messages, reactions, likes etc. if configured in DB
    const { error: deleteError } = await rawDb.remove('threads', {
      'id': rawDb.filter.eq(threadId),
      'creator_id': rawDb.filter.eq(userId)
    });

    if (deleteError) {
      console.error('❌ Database delete failed:', deleteError);
      throw deleteError;
    }

    console.log(`✅ Thread ${threadId} successfully deleted`);
    return true;
  } catch (error: any) {
    console.error('❌ deleteThread error:', {
      message: error?.message,
      details: error?.details,
      hint: error?.hint,
      code: error?.code
    });
    return false;
  }
}

/**
 * Extend thread expiration by 7 days
 * Only premium creators can extend their threads (all thread types)
 */
export const extendThreadExpiration = async (
  threadId: string,
  userId: string
): Promise<{ success: boolean; newExpiresAt?: string; error?: string }> => {
  try {
    // Fetch the thread to verify ownership
    const { data: threadData, error: fetchError } = await rawDb.select<any>('threads', {
      select: 'id, creator_id, expires_at',
      filters: { 'id': rawDb.filter.eq(threadId) },
      single: true
    })

    const thread = threadData as any;

    if (fetchError || !thread) {
      return { success: false, error: 'Thread not found' }
    }

    // Verify user is the creator
    if (thread.creator_id !== userId) {
      return { success: false, error: 'Only the thread creator can extend expiration' }
    }

    // Verify user is premium (premium creators can extend any thread type)
    const { data: userData, error: userError } = await rawDb.select<any>('users', {
      select: 'is_premium',
      filters: { 'id': rawDb.filter.eq(userId) },
      single: true
    })

    if (userError || !userData?.is_premium) {
      return { success: false, error: 'Only premium users can extend thread expiration' }
    }

    // Calculate new expiration (add 7 days)
    const currentExpires = thread.expires_at ? new Date(thread.expires_at) : new Date()
    const newExpires = new Date(currentExpires.getTime() + 7 * 24 * 60 * 60 * 1000)
    const newExpiresAt = newExpires.toISOString()

    // Update expiration
    const { error: updateError } = await rawDb.update('threads', { expires_at: newExpiresAt }, {
      'id': rawDb.filter.eq(threadId),
      'creator_id': rawDb.filter.eq(userId)
    }, { returning: false });

    if (updateError) {
      return { success: false, error: 'Failed to extend thread expiration' }
    }

    return { success: true, newExpiresAt }
  } catch (error) {
    console.error('extendThreadExpiration error:', error)
    return { success: false, error: 'An error occurred while extending the thread' }
  }
}

/**
 * Save a thread from expiration
 * Only thread creators can save their threads
 * Saved threads will not expire and are only visible to the creator
 */
export const saveThread = async (
  threadId: string,
  userId: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    // Fetch the thread to verify ownership
    const { data: threadData, error: fetchError } = await rawDb.select<any>('threads', {
      select: 'id, creator_id, is_saved',
      filters: { 'id': rawDb.filter.eq(threadId) },
      single: true
    })

    const thread = threadData as any;

    if (fetchError || !thread) {
      return { success: false, error: 'Thread not found' }
    }

    // Verify user is the creator
    if (thread.creator_id !== userId) {
      return { success: false, error: 'Only the thread creator can save threads' }
    }

    // Check if already saved (handle missing column gracefully)
    if (thread.is_saved === true) {
      return { success: false, error: 'Thread is already saved' }
    }

    // Save the thread (remove expiration and set is_saved flag)
    const { error: updateError } = await rawDb.update('threads', { 
        is_saved: true,
        expires_at: null  // Remove expiration
      }, {
        'id': rawDb.filter.eq(threadId),
        'creator_id': rawDb.filter.eq(userId)
      }, { returning: false });

    if (updateError) {
      return { success: false, error: 'Failed to save thread' }
    }

    return { success: true }
  } catch (error) {
    console.error('saveThread error:', error)
    return { success: false, error: 'An error occurred while saving the thread' }
  }
}

/**
 * Join a thread
 */
export const joinThread = async (threadId: string, userId: string): Promise<boolean> => {

  if (!userId) {

    return false;
  }
  try {
    const { data, error } = await rawDb.rpc('join_thread', {
      p_thread_id: threadId
    });

    if (error) {
      console.error('❌ [Service] joinThread RPC error:', error);
      const friendly = parseRpcErrorMessage(error);
      throw new Error(friendly || `Join failed: ${error.message || 'Unknown error'}`);
    }

    return data !== null ? Boolean(data) : true;
  } catch (error) {
    console.error('joinThread error:', error);
    throw error;
  }
}

function parseRpcErrorMessage(error: unknown): string | null {
  if (!(error instanceof Error)) return null;

  const msg = error.message || '';

  const jsonStart = msg.indexOf('{');
  if (jsonStart !== -1) {
    try {
      const json = JSON.parse(msg.slice(jsonStart));
      if (json?.message && typeof json.message === 'string') {
        if (json.message === 'You are banned from this thread') {
          return 'You have been removed from this thread.';
        }
        if (json.message === 'Thread is locked due to community reports') {
          return 'This thread is blocked due to community reports.';
        }
        return json.message;
      }
    } catch {
      // ignore JSON parse failures
    }
  }

  if (msg.includes('You are banned from this thread')) {
    return 'You have been removed from this thread.';
  }

  if (msg.includes('Thread is locked due to community reports')) {
    return 'This thread is blocked due to community reports.';
  }

  if (
    msg.includes('Access denied') ||
    msg.includes('row-level security policy for table "thread_participants"')
  ) {
    return 'You need an invite from the creator to join this private thread.';
  }

  return null;
}

/**
 * Generate invite link code for a thread (creator only)
 */
export const createThreadInvite = async (
  threadId: string,
  maxUses: number | null = null,
  expiresInDays: number = 7,
  forceNew: boolean = false
): Promise<{ code: string | null; error?: string }> => {
  try {
    const session = rawAuth.getSession();
    const userId = session?.user?.id;
    if (!userId) return { code: null, error: 'Not authenticated' };

    const now = new Date();

    if (!forceNew) {
      const { data: existing, error: existingError } = await rawDb.select<any[]>('thread_invites', {
        select: 'id, code, expires_at, max_uses, current_uses',
        filters: { 'thread_id': rawDb.filter.eq(threadId) },
        limit: 1,
      });

      if (!existingError && existing && existing.length > 0) {
        const invite = existing[0];
        const expiresAt = invite.expires_at ? new Date(invite.expires_at) : null;
        const expired = expiresAt ? expiresAt < now : false;
        const max = invite.max_uses as number | null;
        const current = invite.current_uses as number | null;
        const fullyUsed = max !== null && current !== null && current >= max;

        if (!expired && !fullyUsed && invite.code) {
          return { code: invite.code };
        }
      }
    }

    const code = Math.random().toString(36).substring(2, 10).toUpperCase();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiresInDays);

    const payload = {
      code,
      created_by: userId,
      max_uses: maxUses,
      current_uses: 0,
      expires_at: expiresAt.toISOString(),
      created_at: now.toISOString(),
    };

    const { data: updated, error: updateError } = await rawDb.update<any>(
      'thread_invites',
      payload,
      { 'thread_id': rawDb.filter.eq(threadId) }
    );

    if (updateError) {
      return { code: null, error: updateError.message || 'Failed to generate invite code' };
    }

    if (Array.isArray(updated) && updated.length > 0) {
      return { code: updated[0]?.code || code };
    }

    const { data, error } = await rawDb.insert<any>('thread_invites', {
      thread_id: threadId,
      ...payload,
    });

    if (error) {
      return { code: null, error: error.message || 'Failed to generate invite code' };
    }

    const created = Array.isArray(data) ? data[0] : data;
    return { code: created?.code || code };
  } catch (error: any) {
    return { code: null, error: error?.message || 'Failed to generate invite code' };
  }
};

/**
 * Redeem invite link code (joins the thread)
 */
export const redeemThreadInvite = async (
  code: string
): Promise<{ threadId: string | null; error?: string }> => {
  try {
    const { data, error } = await rawDb.rpc<string>('redeem_thread_invite', {
      p_code: code,
    });

    if (error) {
      const friendly = parseRpcErrorMessage(error);
      return { threadId: null, error: friendly || error.message || 'Failed to redeem invite' };
    }

    return { threadId: data || null };
  } catch (error: any) {
    return { threadId: null, error: error?.message || 'Failed to redeem invite' };
  }
};

/**
 * Fetch partner access codes for a premium thread (creator only)
 */
export const fetchThreadAccessCodes = async (
  threadId: string
): Promise<{ data: AccessCode[]; error?: string }> => {
  try {
    const { data, error } = await rawDb.select<any[]>('thread_access_codes', {
      filters: { 'thread_id': rawDb.filter.eq(threadId) },
      order: { column: 'created_at', ascending: false },
    });

    if (error) {
      return { data: [], error: error.message || 'Failed to fetch access codes' };
    }

    const codes: AccessCode[] = (data || []).map((row) => ({
      code: row.code,
      createdAt: row.created_at,
      maxUses: Number(row.max_uses ?? 0),
      currentUses: Number(row.current_uses ?? 0),
      isActive: Boolean(row.is_active),
      expiresAt: row.expires_at || undefined,
    }));

    return { data: codes };
  } catch (error: any) {
    return { data: [], error: error?.message || 'Failed to fetch access codes' };
  }
};

/**
 * Create a partner access code (limit 2 codes per thread)
 */
export const createThreadAccessCode = async (
  threadId: string
): Promise<{ data: AccessCode | null; error?: string }> => {
  try {
    const { data, error } = await rawDb.rpc<any>('create_thread_access_code', {
      p_thread_id: threadId,
    });

    if (error) {
      return { data: null, error: error.message || 'Failed to generate access code' };
    }

    const row = Array.isArray(data) ? data[0] : data;
    if (!row) {
      return { data: null, error: 'Failed to generate access code' };
    }

    return {
      data: {
        code: row.code,
        createdAt: row.created_at,
        maxUses: Number(row.max_uses ?? 0),
        currentUses: Number(row.current_uses ?? 0),
        isActive: Boolean(row.is_active),
        expiresAt: row.expires_at || undefined,
      },
    };
  } catch (error: any) {
    return { data: null, error: error?.message || 'Failed to generate access code' };
  }
};

/**
 * Revoke a partner access code (creator only)
 */
export const revokeThreadAccessCode = async (
  threadId: string,
  code: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    const { data, error } = await rawDb.rpc<any>('revoke_thread_access_code', {
      p_thread_id: threadId,
      p_code: code,
    });

    if (error) {
      return { success: false, error: error.message || 'Failed to revoke access code' };
    }

    return { success: Boolean(data) };
  } catch (error: any) {
    return { success: false, error: error?.message || 'Failed to revoke access code' };
  }
};

/**
 * Redeem a partner access code (grant free access)
 */
export const redeemThreadAccessCode = async (
  threadId: string,
  code: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    const { data, error } = await rawDb.rpc<any>('redeem_thread_access_code', {
      p_thread_id: threadId,
      p_code: code,
    });

    if (error) {
      return { success: false, error: error.message || 'Failed to redeem access code' };
    }

    return { success: Boolean(data) };
  } catch (error: any) {
    return { success: false, error: error?.message || 'Failed to redeem access code' };
  }
};

/**
 * Invite a user to a thread by username/anonymous ID
 */
export const inviteUserToThread = async (
  threadId: string,
  username: string,
  threadTitle?: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    const { data, error } = await rawDb.rpc<any>('invite_user_to_thread', {
      p_thread_id: threadId,
      p_username: username,
    });

    if (error) {
      return { success: false, error: error.message || 'Failed to invite user' };
    }

    if (!data?.success) {
      return { success: false, error: data?.error || 'Failed to invite user' };
    }

    const invitedUserId = data.user_id as string | undefined;

    if (invitedUserId) {
      const { data: userData } = await rawDb.select<any>('users', {
        select: 'email, username, anonymous_id, preferences',
        filters: { 'id': rawDb.filter.eq(invitedUserId) },
        single: true,
      });

      const email = userData?.email;
      const emailEnabled = userData?.preferences?.notifications?.email !== false;

      if (email && emailEnabled && typeof window !== 'undefined') {
        const threadPath = `/threads/${threadId}`;
        const inviteUrl = `${window.location.origin}/auth?redirect=${encodeURIComponent(threadPath)}`;
        await fetch('/api/threads/send-invite', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email,
            inviteUrl,
            threadTitle: threadTitle || 'a thread',
          }),
        }).catch(() => null);
      }
    }

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error?.message || 'Failed to invite user' };
  }
};

/**
 * Fetch invited threads for current user (pending invites)
 */
export const fetchInvitedThreads = async (
  userId: string
): Promise<{ data: ThreadInviteItem[]; error?: string }> => {
  try {
    const select = `
      id,
      status,
      created_at,
      thread:threads(
        *,
        creator:users!threads_creator_id_fkey(id, username, anonymous_id, is_premium, avatar_url),
        thread_likes(user_id),
        thread_participants(user_id)
      )
    `.replace(/\s+/g, '');

    const { data, error } = await rawDb.select<any[]>('thread_user_invites', {
      select,
      filters: {
        'invited_user_id': rawDb.filter.eq(userId),
        'status': rawDb.filter.eq('pending'),
      },
      order: { column: 'created_at', ascending: false },
    });

    if (error) {
      return { data: [], error: error.message || 'Failed to fetch invites' };
    }

    const invites = (data || [])
      .filter((row: any) => row.thread)
      .map((row: any) => ({
        inviteId: row.id,
        status: row.status,
        createdAt: row.created_at,
        thread: transformThread(row.thread, userId),
      }));

    return { data: invites };
  } catch (error: any) {
    return { data: [], error: error?.message || 'Failed to fetch invites' };
  }
};

/**
 * Leave a thread
 */
export const leaveThread = async (threadId: string, userId: string): Promise<boolean> => {
  try {
    const { data, error } = await rawDb.rpc('leave_thread', {
      p_thread_id: threadId
    });

    if (error) {
      console.error('❌ [Service] leaveThread RPC error:', error);
      throw new Error(`Leave failed: ${error.message || 'Unknown error'}`);
    }

    return data !== null ? Boolean(data) : true;
  } catch (error) {
    console.error('leaveThread error:', error);
    throw error;
  }
}

/**
 * Check if a user is banned from a thread
 */
export const checkThreadBan = async (
  threadId: string,
  userId: string
): Promise<{ isBanned: boolean; error?: string }> => {
  try {
    const { data, error } = await rawDb.rpc<boolean>('is_thread_banned', {
      p_thread_id: threadId,
      p_user_id: userId,
    });

    if (error) {
      return { isBanned: false, error: error.message || 'Failed to check ban status' };
    }

    return { isBanned: data === true };
  } catch (error: any) {
    return { isBanned: false, error: error?.message || 'Failed to check ban status' };
  }
};

interface PostgrestErrorPayload {
  code?: string;
  message?: string;
  details?: string;
  hint?: string;
}

const REPORT_REASON_VALUES = new Set([
  'spam',
  'harassment',
  'hate_speech',
  'violence',
  'sexual_content',
  'misinformation',
  'copyright',
  'other',
]);

function parsePostgrestErrorPayload(error: unknown): PostgrestErrorPayload | null {
  if (!(error instanceof Error)) return null;

  const rawMessage = error.message || '';
  const jsonStart = rawMessage.indexOf('{');
  if (jsonStart === -1) return null;

  try {
    const parsed = JSON.parse(rawMessage.slice(jsonStart));
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed as PostgrestErrorPayload;
  } catch {
    return null;
  }
}

function isMissingReportThreadRpc(error: unknown): boolean {
  const payload = parsePostgrestErrorPayload(error);
  const code = payload?.code;
  const message = payload?.message || '';
  return (
    (code === 'PGRST202' || code === 'PGRST204') &&
    message.includes('public.report_thread')
  );
}

function isUniqueViolation(error: unknown): boolean {
  const payload = parsePostgrestErrorPayload(error);
  if (payload?.code === '23505') return true;
  return error instanceof Error && error.message.includes('duplicate key value');
}

const reportThreadWithoutRpc = async (
  threadId: string,
  reason: string,
  description?: string
): Promise<{
  success: boolean;
  alreadyReported?: boolean;
  reportCount?: number;
  participantCount?: number;
  isLocked?: boolean;
  error?: string;
}> => {
  const session = rawAuth.getSession();
  const reporterId = session?.user?.id;
  if (!reporterId) {
    return { success: false, error: 'Not authenticated' };
  }

  const safeReason = REPORT_REASON_VALUES.has(reason) ? reason : 'other';

  const { data: threadRows, error: threadError } = await rawDb.select<any[]>('threads', {
    select: 'id,creator_id,participant_count',
    filters: { id: rawDb.filter.eq(threadId) },
    limit: 1,
  });

  if (threadError) {
    return { success: false, error: threadError.message || 'Failed to load thread details' };
  }

  const thread = threadRows?.[0];
  if (!thread) {
    return { success: false, error: 'Thread not found' };
  }

  const { data: existingRows, error: existingError } = await rawDb.select<any[]>('content_reports', {
    select: 'id',
    filters: {
      reporter_id: rawDb.filter.eq(reporterId),
      content_type: rawDb.filter.eq('thread'),
      content_id: rawDb.filter.eq(threadId),
    },
    limit: 1,
  });

  if (existingError) {
    return { success: false, error: existingError.message || 'Failed to verify existing report' };
  }

  let alreadyReported = (existingRows?.length || 0) > 0;

  if (!alreadyReported) {
    const { error: insertError } = await rawDb.insert(
      'content_reports',
      {
        reporter_id: reporterId,
        reported_user_id: thread.creator_id,
        content_type: 'thread',
        content_id: threadId,
        reason: safeReason,
        description: description?.trim() ? description.trim() : null,
      },
      { returning: false }
    );

    if (insertError) {
      if (isUniqueViolation(insertError)) {
        alreadyReported = true;
      } else {
        return { success: false, error: insertError.message || 'Failed to submit report' };
      }
    }
  }

  const { data: reportRows, error: reportCountError } = await rawDb.select<any[]>('content_reports', {
    select: 'reporter_id',
    filters: {
      content_type: rawDb.filter.eq('thread'),
      content_id: rawDb.filter.eq(threadId),
    },
  });

  if (reportCountError) {
    return { success: false, error: reportCountError.message || 'Failed to refresh report count' };
  }

  const reportCount = new Set(
    (reportRows || [])
      .map((row: any) => row.reporter_id)
      .filter((id: unknown) => typeof id === 'string' && id.length > 0)
  ).size;

  let participantCount =
    typeof thread.participant_count === 'number' && Number.isFinite(thread.participant_count)
      ? thread.participant_count
      : 0;

  if (participantCount <= 0) {
    const { data: participantRows, error: participantError } = await rawDb.select<any[]>('thread_participants', {
      select: 'user_id',
      filters: { thread_id: rawDb.filter.eq(threadId) },
    });

    if (!participantError && participantRows) {
      participantCount = new Set(
        participantRows
          .map((row: any) => row.user_id)
          .filter((id: unknown) => typeof id === 'string' && id.length > 0)
      ).size;
    }
  }

  if (participantCount <= 0) {
    participantCount = 1;
  }

  const threshold = Math.max(1, Math.ceil(participantCount * 0.8));
  const isLocked = reportCount >= threshold;

  const threadUpdate: Record<string, unknown> = { report_count: reportCount };
  if (isLocked) {
    threadUpdate.is_locked = true;
  }

  const { error: updateError } = await rawDb.update(
    'threads',
    threadUpdate,
    { id: rawDb.filter.eq(threadId) },
    { returning: false }
  );

  if (updateError) {
    const payload = parsePostgrestErrorPayload(updateError);
    const message = updateError.message || '';
    const missingColumns =
      payload?.code === '42703' ||
      message.includes('column "report_count" does not exist') ||
      message.includes('column "is_locked" does not exist');

    if (!missingColumns) {
      console.warn('[ThreadService] report fallback update failed:', updateError);
    }
  }

  return {
    success: true,
    alreadyReported,
    reportCount,
    participantCount,
    isLocked,
  };
};

export const reportThread = async (
  threadId: string,
  reason: string,
  description?: string
): Promise<{
  success: boolean;
  alreadyReported?: boolean;
  reportCount?: number;
  participantCount?: number;
  isLocked?: boolean;
  error?: string;
}> => {
  try {
    const { data, error } = await rawDb.rpc<any>('report_thread', {
      p_thread_id: threadId,
      p_reason: reason,
      p_description: description ?? null,
    });

    if (error) {
      if (isMissingReportThreadRpc(error)) {
        console.warn('[ThreadService] report_thread RPC is unavailable, using fallback report flow.');
        return reportThreadWithoutRpc(threadId, reason, description);
      }

      const friendly = parseRpcErrorMessage(error);
      return { success: false, error: friendly || error.message || 'Failed to submit report' };
    }

    if (!data || data.success !== true) {
      return { success: false, error: data?.error || 'Failed to submit report' };
    }

    return {
      success: true,
      alreadyReported: data.already_reported === true,
      reportCount: typeof data.report_count === 'number' ? data.report_count : 0,
      participantCount: typeof data.participant_count === 'number' ? data.participant_count : 0,
      isLocked: data.is_locked === true,
    };
  } catch (error: any) {
    return { success: false, error: error?.message || 'Failed to submit report' };
  }
};

/**
 * Remove participant from thread (creator only) and blacklist
 */
export const removeThreadParticipant = async (
  threadId: string,
  participantId: string,
  reason?: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    const { data, error } = await rawDb.rpc<boolean>('remove_thread_participant', {
      p_thread_id: threadId,
      p_user_id: participantId,
      p_reason: reason || null,
    });

    if (error) {
      return { success: false, error: error.message || 'Failed to remove participant' };
    }

    return { success: data === true };
  } catch (error: any) {
    return { success: false, error: error?.message || 'Failed to remove participant' };
  }
};

/**
 * Helper: Transform database thread to Thread type
 */
function transformThread(dbThread: any, userId?: string, purchasedThreadIds?: Set<string>): Thread {
  const hasLiked = userId
    ? dbThread.thread_likes?.some((like: any) => like.user_id === userId)
    : false
  const hasJoined = userId
    ? (dbThread.thread_participants || []).some((p: any) => (p.user_id || p.user?.id) === userId)
    : false
  const hasAccess = userId ? (purchasedThreadIds?.has(dbThread.id) ?? false) : false

  // Handle creator data - might be joined or might need to be fetched separately
  const author = dbThread.creator ? {
    id: dbThread.creator.id,
    anonymousId: dbThread.creator.anonymous_id,
    name: dbThread.creator.username || dbThread.creator.anonymous_id,
    avatar: dbThread.creator.avatar_url || undefined,
    isPremium: dbThread.creator.is_premium || false,
  } : {
    id: dbThread.creator_id,
    anonymousId: `ANON_${dbThread.creator_id?.substring(0, 8) || 'UNKNOWN'}`,
    name: `ANON_${dbThread.creator_id?.substring(0, 8) || 'UNKNOWN'}`,
    isPremium: false,
  };

  // Calculate participant count based ONLY on users who joined the thread
  // NOT based on message count - participants are only those who explicitly joined
  let participantCount = 0;
  const uniqueParticipants = new Set<string>();
  
  // Add from explicit thread_participants table (users who joined)
  const hasParticipantsArray = Array.isArray(dbThread.thread_participants);
  if (hasParticipantsArray) {
    dbThread.thread_participants.forEach((p: any) => {
      const id = p.user_id || p.user?.id;
      if (id) uniqueParticipants.add(id);
    });
  }
  
  const computedCount = uniqueParticipants.size;
  if (hasParticipantsArray) {
    participantCount = computedCount;
  } else if (typeof dbThread.participant_count === 'number') {
    participantCount = dbThread.participant_count;
  } else {
    participantCount = computedCount;
  }



  return {
    id: dbThread.id,
    title: dbThread.title || 'Untitled Thread',
    content: dbThread.content || '',
    type: dbThread.type || 'text',
    category: dbThread.category || 'general',
    author,
    authorId: dbThread.creator_id,
    createdAt: dbThread.created_at,
    updatedAt: dbThread.updated_at,
    likes: Math.max(typeof dbThread.likes_count === 'number' ? dbThread.likes_count : 0, dbThread.thread_likes?.length || 0),
    messageCount: dbThread.message_count || 0,
    hasLiked,
    hasJoined,
    hasAccess,
    isPremium: dbThread.is_premium || false,
    memberLimit: dbThread.member_limit ?? undefined,
    price: dbThread.price,
    timeRemaining: calculateTimeRemaining(dbThread.expires_at),
    expiresAt: dbThread.expires_at,
    latestMessage: (dbThread.content || '').substring(0, 100),
    tags: [],
    rating: 0,
    ratingCount: 0,
    participantCount,
    isPinned: false,
    isLocked: dbThread.is_locked === true,
    privacy: dbThread.privacy || 'public',
    isSaved: dbThread.is_saved ?? false,  // Fallback if column doesn't exist yet
  }
}

/**
 * Helper: Transform database thread to ThreadData type (with full details)
 */
function transformThreadData(
  dbThread: any,
  userId?: string,
  purchasedThreadIds?: Set<string>
): ThreadData {
  const baseThread = transformThread(dbThread, userId, purchasedThreadIds)

  // Build participants map - ONLY from users who explicitly joined the thread
  const participantsMap = new Map<string, Participant>();
  
  // 1. Add joined participants from thread_participants table
  if (dbThread.thread_participants && Array.isArray(dbThread.thread_participants)) {
    dbThread.thread_participants.forEach((p: any) => {
      const userData = p.user;
      const userIdFromTable = p.user_id || userData?.id;
      
      if (!userIdFromTable) return;
      
      participantsMap.set(userIdFromTable, {
        id: userIdFromTable,
        anonymousId: userData?.anonymous_id || `User ${userIdFromTable.substring(0, 5)}`,
        name: userData?.username || userData?.anonymous_id || `User ${userIdFromTable.substring(0, 5)}`,
        avatar: userData?.avatar_url || '#cccccc',
        status: 'online',
        messageCount: 0,
        isPremium: userData?.is_premium || false,
      });
    });
  }
  
  // 2. Count messages for participants who joined
  // (Only count messages from users who are already in the participants map)
  (dbThread.messages || []).forEach((msg: any) => {
    const senderId = msg.sender?.id || msg.sender_id;
    if (!senderId) return;
    
    // Only count messages if the sender is a participant (joined the thread)
    const participant = participantsMap.get(senderId);
    if (participant) {
      participant.messageCount = (participant.messageCount || 0) + 1;
    }
  });

  // 3. Ensure thread creator is included in participants list
  const creatorData = dbThread.creator;
  const creatorId = creatorData?.id || dbThread.creator_id;
  if (creatorId && !participantsMap.has(creatorId)) {
    participantsMap.set(creatorId, {
      id: creatorId,
      anonymousId: creatorData?.anonymous_id || `ANON_${creatorId.substring(0, 5)}`,
      name: creatorData?.username || creatorData?.anonymous_id || `User ${creatorId.substring(0, 5)}`,
      avatar: creatorData?.avatar_url || '#cccccc',
      status: 'online',
      messageCount: 0,
      isPremium: creatorData?.is_premium || false,
    });
  }

  const participants = Array.from(participantsMap.values());


  return {
    ...baseThread,
    expiresAt: dbThread.expires_at,
    pollId: dbThread.poll?.id,
    // Reverse messages to show oldest first (since we fetched newest first)
    // Reverse messages to show oldest first (since we fetched newest first)
    messages: (dbThread.messages || []).slice().reverse().map((msg: any) => transformMessage(msg, userId)),
    pollOptions: (() => {
      if (!dbThread.poll?.poll_options) return undefined;
      
      const pollOptions = dbThread.poll.poll_options;
      const pollVotes = dbThread.poll.poll_votes || [];
      
      // Pre-calculate counts in one pass
      const voteCountsMap: Record<string, number> = {};
      pollVotes.forEach((v: any) => {
        voteCountsMap[v.option_id] = (voteCountsMap[v.option_id] || 0) + 1;
      });

      // Calculate effective vote counts for each option
      const optionCounts = pollOptions.map((opt: any) => {
        return Math.max(opt.vote_count || 0, voteCountsMap[opt.id] || 0);
      });
      
      const totalVotes = optionCounts.reduce((sum: number, count: number) => sum + count, 0);

      return pollOptions.map((opt: any, index: number) => {
        const votes = optionCounts[index];
        const hasVoted = userId
          ? pollVotes.some((vote: any) => vote.user_id === userId && vote.option_id === opt.id)
          : false;

        return {
          id: opt.id,
          text: opt.text,
          votes,
          percentage: totalVotes > 0 ? Math.round((votes / totalVotes) * 100) : 0,
          hasVoted,
        };
      });
    })(),
    isExpired: dbThread.expires_at ? new Date(dbThread.expires_at) < new Date() : false,
    viewCount: dbThread.view_count || 0,
    participants,
    author: {
      id: dbThread.creator.id,
      anonymousId: dbThread.creator.anonymous_id,
      name: dbThread.creator.username || dbThread.creator.anonymous_id,
      avatar: dbThread.creator.avatar_url || '#cccccc',
      isPremium: dbThread.creator.is_premium,
    },
    authorId: dbThread.creator.id,
    createdBy: {
      id: dbThread.creator.id,
      anonymousId: dbThread.creator.anonymous_id,
      name: dbThread.creator.username || dbThread.creator.anonymous_id,
      avatar: dbThread.creator.avatar_url || '#cccccc',
      status: 'online' as const,
      isPremium: dbThread.creator.is_premium,
    },
    reportCount: typeof dbThread.report_count === 'number' ? dbThread.report_count : 0,
  }
}

/**
 * Helper: Calculate time remaining
 */
function calculateTimeRemaining(expiresAt: string | null): string | undefined {
  if (!expiresAt) return undefined

  const now = new Date()
  const expiry = new Date(expiresAt)
  const diff = expiry.getTime() - now.getTime()

  if (diff <= 0) return '0h'

  const hours = Math.floor(diff / (1000 * 60 * 60))
  return `${hours}h`
}

/**
 * Helper: Transform database message to Message type
 */
export function transformMessage(msg: any, userId?: string): Message {
  // Transform reactions from array to object format
  const reactions: any = {};
  if (msg.message_reactions && msg.message_reactions.length > 0) {
    msg.message_reactions.forEach((reaction: any) => {
      if (!reactions[reaction.reaction_type]) {
        reactions[reaction.reaction_type] = {
          count: 0,
          users: [],
        };
      }
      reactions[reaction.reaction_type].count++;
      reactions[reaction.reaction_type].users.push(reaction.user_id);
    });
  }

  return {
    id: msg.id,
    threadId: msg.thread_id,
    authorId: msg.sender?.id || msg.sender_id,
    authorName: msg.sender?.username || msg.sender?.anonymous_id || 'Unknown',
    sender: {
      id: msg.sender?.id || msg.sender_id,
      anonymousId: msg.sender?.anonymous_id || 'Unknown',
      name: msg.sender?.username || msg.sender?.anonymous_id || 'Unknown',
      avatar: msg.sender?.avatar_url || '#cccccc',
      status: 'online' as const,
      isPremium: msg.sender?.is_premium,
    },
    content: msg.content,
    type: msg.type,
    timestamp: msg.created_at,
    isEdited: msg.is_edited ?? false,
    editedAt: msg.edited_at ?? undefined,
    likes: msg.likes_count || 0,
    hasLiked: userId ? (msg.message_likes || []).some((like: any) => like.user_id === userId) : false,
    replyToId: msg.parent_message_id,
    // Populate the actual replied message object if parent data exists
    repliedMessage: msg.parent_message ? {
      id: msg.parent_message.id,
      content: msg.parent_message.content,
      sender: msg.parent_message.sender ? {
         id: msg.parent_message.sender.id,
         anonymousId: msg.parent_message.sender.anonymous_id,
         name: msg.parent_message.sender.username || msg.parent_message.sender.anonymous_id,
         avatar: msg.parent_message.sender.avatar_url || '#cccccc',
         status: 'online' as const,
         isPremium: msg.parent_message.sender.is_premium,
      } : {
         id: 'deleted',
         anonymousId: 'Deleted User',
         name: 'Deleted User',
         avatar: '#cccccc',
         status: 'offline' as const,
      }
    } : undefined,
    replies: [],
    reactions,
    attachments: msg.attachments || [],
  };
}


