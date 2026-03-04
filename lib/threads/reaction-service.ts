import * as rawDb from '@/lib/core/supabase/raw-db'
import { sanitizeSingleLineInput, sanitizeUuid } from '@/lib/security/input-sanitization'

/**
 * Add a reaction to a message
 */
export const addMessageReaction = async (
  messageId: string,
  userId: string,
  reactionType: string
): Promise<boolean> => {
  const safeMessageId = sanitizeUuid(messageId)
  const safeUserId = sanitizeUuid(userId)
  const safeReactionType = sanitizeSingleLineInput(reactionType, { maxLength: 64 })
  if (!safeMessageId || !safeUserId || !safeReactionType) {
    return false
  }

  try {

    
    // Check if user already has this reaction
    const { data: existing, error: checkError } = await rawDb.select<any>('message_reactions', {
      select: 'id',
      filters: { 
        'message_id': rawDb.filter.eq(safeMessageId),
        'user_id': rawDb.filter.eq(safeUserId),
        'reaction_type': rawDb.filter.eq(safeReactionType)
      },
      single: true
    })

    // PGRST116 (No rows) is handled by rawDb returning null data if not found (or throwing if single=true and no data??)
    // rawDb.select with single=true throws if no rows? 
    // Let's check raw-db.ts implementation.
    // implementation: if (options.single) { data = data[0] || null; if (!data) throw new Error('No rows returned'); }
    // So rawDb throws on not found. We should catch it.
    
    let exists = false;
    if (existing) exists = true;
    
    // Optimization: rawDb.select throws on 406/No Rows? 
    // Actually, checking "PGRST116" is specific to Supabase SDK behavior. rawDb might throw standard Error.
    // We should surround check with try/catch to handle "No rows" gracefully.
  } catch (err: any) {
    // Expected if not found
  }

  // To properly implement "Toggle" logic with raw-db:
  try {
    // 1. Try to fetch existing
    let existingId: string | null = null;
    try {
      const { data } = await rawDb.select<any>('message_reactions', {
        select: 'id',
        filters: { 
          'message_id': rawDb.filter.eq(safeMessageId),
          'user_id': rawDb.filter.eq(safeUserId),
          'reaction_type': rawDb.filter.eq(safeReactionType)
        },
        single: true
      });
      existingId = (data as any)?.id;
    } catch (e) {
      // Ignore not found
    }

    if (existingId) {
      // Remove reaction if it already exists (toggle off)

      await rawDb.remove('message_reactions', {
        'message_id': rawDb.filter.eq(safeMessageId),
        'user_id': rawDb.filter.eq(safeUserId),
        'reaction_type': rawDb.filter.eq(safeReactionType)
      });

      return true
    }

    // Remove any other reactions from this user on this message (Mutual Exclusivity Logic?)
    // The previous code did this: verify if we want ONLY one reaction per user per message?
    // "Remove any other reactions from this user on this message"

    await rawDb.remove('message_reactions', {
      'message_id': rawDb.filter.eq(safeMessageId),
      'user_id': rawDb.filter.eq(safeUserId)
    });

    // Add new reaction

    const { error, data } = await rawDb.insert('message_reactions', {
      message_id: safeMessageId,
      user_id: safeUserId,
      reaction_type: safeReactionType,
    });

    if (error) throw error

    return true
  } catch (error) {
    return false
  }
}

/**
 * Get reactions for a message (optimized with single query)
 */
export const getMessageReactions = async (
  messageId: string,
  userId?: string
): Promise<{ [key: string]: { count: number; users: string[]; hasReacted: boolean } }> => {
  try {
    const safeMessageId = sanitizeUuid(messageId)
    if (!safeMessageId) {
      return {}
    }
    const safeUserId = userId ? sanitizeUuid(userId) : null

    const { data, error } = await rawDb.select<any>('message_reactions', {
      select: 'reaction_type, user_id',
      filters: { 'message_id': rawDb.filter.eq(safeMessageId) },
      order: { column: 'created_at', ascending: true }
    });

    if (error) throw error

    if (!data || data.length === 0) {
      return {}
    }

    const reactions: { [key: string]: { count: number; users: string[]; hasReacted: boolean } } = {}

    // Optimized single-pass aggregation
    data.forEach((reaction) => {
      const type = reaction.reaction_type
      
      if (!reactions[type]) {
        reactions[type] = {
          count: 0,
          users: [],
          hasReacted: false,
        }
      }

      reactions[type].count++
      reactions[type].users.push(reaction.user_id)

      if (safeUserId && reaction.user_id === safeUserId) {
        reactions[type].hasReacted = true
      }
    })

    return reactions
  } catch (error) {
    return {}
  }
}
