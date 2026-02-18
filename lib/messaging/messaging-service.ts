import * as rawDb from '@/lib/core/supabase/raw-db'
import * as rawAuth from '@/lib/core/supabase/raw-auth'
import * as rawRealtime from '@/lib/core/supabase/raw-realtime'

/**
 * Messaging Service
 * Handles all direct messaging operations (Migrated to use Raw Utils)
 */

export type DMMessageType = 'text' | 'image' | 'file' | 'system'

export interface Conversation {
  id: string
  createdAt: string
  updatedAt: string
  lastMessageAt: string
  participants?: ConversationParticipant[]
  lastMessage?: DirectMessage
  unreadCount?: number
  type: 'direct' | 'one_time'
}

export interface ConversationParticipant {
  conversationId: string
  userId: string
  joinedAt: string
  lastReadAt: string
  isMuted: boolean
  user?: {
    id: string
    anonymousId: string
    avatarUrl?: string
    isPremium?: boolean
  }
}

export interface DirectMessage {
  id: string
  conversationId: string
  senderId: string
  content: string
  messageType: DMMessageType
  attachmentUrl?: string
  isEdited: boolean
  isDeleted: boolean
  createdAt: string
  updatedAt: string
  sender?: {
    id: string
    anonymousId: string
    avatarUrl?: string
  }
  readReceipts?: MessageReadReceipt[]
  deliveryReceipts?: MessageDeliveryReceipt[]
}

export interface MessageReadReceipt {
  messageId: string
  userId: string
  readAt: string
}

export interface MessageDeliveryReceipt {
  messageId: string
  userId: string
  deliveredAt: string
}

const mapUser = (user: any) => {
  if (!user) return undefined
  return {
    id: user.id,
    anonymousId: user.anonymous_id ?? user.anonymousId,
    avatarUrl: user.avatar_url ?? user.avatarUrl,
    isPremium: user.is_premium ?? user.isPremium,
  }
}

const mapReadReceipt = (receipt: any): MessageReadReceipt => ({
  messageId: receipt.message_id ?? receipt.messageId,
  userId: receipt.user_id ?? receipt.userId,
  readAt: receipt.read_at ?? receipt.readAt,
})

const mapDeliveryReceipt = (receipt: any): MessageDeliveryReceipt => ({
  messageId: receipt.message_id ?? receipt.messageId,
  userId: receipt.user_id ?? receipt.userId,
  deliveredAt: receipt.delivered_at ?? receipt.deliveredAt,
})

const mapDirectMessage = (message: any): DirectMessage => ({
  id: message.id,
  conversationId: message.conversation_id ?? message.conversationId,
  senderId: message.sender_id ?? message.senderId,
  content: message.content,
  messageType: message.message_type ?? message.messageType,
  attachmentUrl: message.attachment_url ?? message.attachmentUrl,
  isEdited: message.is_edited ?? message.isEdited ?? false,
  isDeleted: message.is_deleted ?? message.isDeleted ?? false,
  createdAt: message.created_at ?? message.createdAt,
  updatedAt: message.updated_at ?? message.updatedAt,
  sender: message.sender
    ? {
        id: message.sender.id,
        anonymousId: message.sender.anonymous_id ?? message.sender.anonymousId,
        avatarUrl: message.sender.avatar_url ?? message.sender.avatarUrl,
      }
    : undefined,
  readReceipts: message.message_read_receipts
    ? message.message_read_receipts.map(mapReadReceipt)
    : message.readReceipts?.map(mapReadReceipt),
  deliveryReceipts: message.message_delivery_receipts
    ? message.message_delivery_receipts.map(mapDeliveryReceipt)
    : message.deliveryReceipts?.map(mapDeliveryReceipt),
})

const mapParticipant = (row: any): ConversationParticipant => ({
  conversationId: row.conversation_id ?? row.conversationId,
  userId: row.user_id ?? row.userId,
  joinedAt: row.joined_at ?? row.joinedAt,
  lastReadAt: row.last_read_at ?? row.lastReadAt,
  isMuted: row.is_muted ?? row.isMuted ?? false,
  user: mapUser(row.user),
})

const isDuplicateConversationParticipantError = (error: unknown) => {
  if (!error) return false
  const message =
    error instanceof Error
      ? error.message
      : typeof error === 'object' && error !== null && 'message' in error
        ? String((error as { message?: unknown }).message ?? '')
        : String(error)
  return (
    message.includes('conversation_participants_pkey') &&
    (message.includes('23505') || message.toLowerCase().includes('duplicate key'))
  )
}

const getConversationUnreadCount = async (
  conversationId: string,
  userId: string,
  lastReadAt?: string | null
): Promise<number> => {
  const filters: Record<string, string> = {
    conversation_id: rawDb.filter.eq(conversationId),
    is_deleted: rawDb.filter.eq(false),
    sender_id: rawDb.filter.neq(userId),
  }

  if (lastReadAt) {
    filters['created_at'] = rawDb.filter.gt(lastReadAt)
  }

  const { data, error } = await rawDb.select<any[]>('direct_messages', {
    select: 'id',
    filters,
  })

  if (error) throw error
  return data?.length || 0
}

/**
 * Get or create conversation with another user
 */
export const getOrCreateConversation = async (
  otherUserId: string
): Promise<{ data: Conversation | null; error: string | null }> => {
  try {
    const session = rawAuth.getSession();
    const user = session?.user;

    if (!user) {
      return { data: null, error: 'User not authenticated' }
    }

    if (user.id === otherUserId) {
      return { data: null, error: 'You cannot start a conversation with yourself' }
    }

    // Call database function to get or create conversation
    const { data, error } = await rawDb.rpc<string>('get_or_create_conversation', {
      user1_id: user.id,
      user2_id: otherUserId,
    });

    if (error) throw error

    // Fetch the conversation details
    if (data) {
      const conversation = await fetchConversationById(data)
      return conversation
    }
    
    return { data: null, error: 'Function returned null ID' }
  } catch (error: any) {
    if (isDuplicateConversationParticipantError(error)) {
      // Recover from duplicate participant races by loading existing conversation.
      const fallback = await findDirectConversationWithUser(otherUserId)
      if (fallback.data) {
        return { data: fallback.data, error: null }
      }
    }

    console.error('Get or create conversation error:', error)
    return { data: null, error: error.message || 'Failed to get/create conversation' }
  }
}

/**
 * Find an existing direct conversation with another user (no creation)
 */
export const findDirectConversationWithUser = async (
  otherUserId: string
): Promise<{ data: Conversation | null; error: string | null }> => {
  try {
    const session = rawAuth.getSession();
    const user = session?.user;

    if (!user) {
      return { data: null, error: 'User not authenticated' };
    }

    if (user.id === otherUserId) {
      return { data: null, error: 'You cannot message yourself' };
    }

    const { data: conversations, error } = await fetchConversations();
    if (error) {
      return { data: null, error };
    }

    const existing = conversations.find(conv => {
      if (conv.type !== 'direct') return false;
      if (!conv.participants) return false;
      return conv.participants.some(p => p.userId === otherUserId);
    });

    return { data: existing || null, error: null };
  } catch (error: any) {
    return { data: null, error: error?.message || 'Failed to find conversation' };
  }
}

/**
 * Fetch all conversations for current user
 */
export const fetchConversations = async (): Promise<{
  data: Conversation[]
  error: string | null
}> => {
  try {
    const session = rawAuth.getSession();
    const user = session?.user;

    if (!user) {
      console.warn('FetchConversations: No user found')
      return { data: [], error: 'User not authenticated' }
    }

    // Attempt 1: Optimized query with complex join
    try {

      const { data: participantData, error: participantError } = await rawDb.select<any[]>('conversation_participants', {
        select: `
          conversation_id,
          conversations!inner(
            id,
            created_at,
            updated_at,
            last_message_at
          )
        `.replace(/\s+/g, ''),
        filters: { 'user_id': rawDb.filter.eq(user.id) },
        order: { column: 'last_message_at', foreignTable: 'conversations', ascending: false }
      });

      if (participantError) {
        throw participantError
      }

      // Get conversation IDs
      const conversationIds = participantData?.map((p: any) => p.conversation_id) || []
      


      if (conversationIds.length === 0) {
        return { data: [], error: null }
      }

      // Fetch full details
      return await fetchConversationDetails(conversationIds)

    } catch (primaryError: any) {
      console.warn('Primary fetch conversation strategies failed, trying fallback. Error:', primaryError)
      
      // Attempt 2: Simple query (fallback)
      const { data: simpleData, error: simpleError } = await rawDb.select<any[]>('conversation_participants', {
        select: 'conversation_id',
        filters: { 'user_id': rawDb.filter.eq(user.id) }
      });
      
      if (simpleError) {
        throw simpleError
      }
      
      const conversationIds = simpleData?.map((p: any) => p.conversation_id) || []

      
      if (conversationIds.length === 0) {
        return { data: [], error: null }
      }
      
      // Fetch full details with robust handler
      const result = await fetchConversationDetails(conversationIds)
      
      // Sort in memory
      if (result.data) {
        result.data.sort((a, b) => 
          new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime()
        )
      }
      
      return result
    }
  } catch (error: any) {
    console.error('Fetch conversations FATAL error:', error);
    return { data: [], error: error?.message || 'Failed to fetch conversations' }
  }
}

// Helper to fetch details for a list of IDs - Robust Version with Batching
const fetchConversationDetails = async (conversationIds: string[]): Promise<{
  data: Conversation[]
  error: string | null
}> => {

  
  const BATCH_SIZE = 5
  const validConversations: Conversation[] = []
  const errors: string[] = []

  // Process in batches to avoid overwhelming the network/browser
  for (let i = 0; i < conversationIds.length; i += BATCH_SIZE) {
    const batch = conversationIds.slice(i, i + BATCH_SIZE)

    
    // We reuse fetchConversationById which uses rawDb internally now
    const results = await Promise.allSettled(
      batch.map(id => fetchConversationById(id))
    )

    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        const { data, error } = result.value
        if (data) {
          validConversations.push(data)
        } else if (error) {
          console.warn(`Failed to fetch individual conversation ${batch[index]}:`, error)
          errors.push(error)
        }
      } else {
        console.warn(`Promise rejected for conversation ${batch[index]}:`, result.reason)
        errors.push(result.reason?.message || 'Unknown error')
      }
    })
  }



  if (validConversations.length > 0 || conversationIds.length === 0) {
    return { data: validConversations, error: null }
  }
  
  if (conversationIds.length > 0 && validConversations.length === 0) {
    return { data: [], error: `Failed to load conversations. First error: ${errors[0]}` }
  }

  return { data: [], error: null }
}

/**
 * Fetch single conversation by ID
 */
export const fetchConversationById = async (
  conversationId: string
): Promise<{ data: Conversation | null; error: string | null }> => {
  try {
    const session = rawAuth.getSession();
    const user = session?.user;

    if (!user) {
      return { data: null, error: 'User not authenticated' }
    }

    // Fetch conversation
    const { data: conversationData, error: conversationError } = await rawDb.select<any>('conversations', {
      filters: { 'id': rawDb.filter.eq(conversationId) },
      single: true
    }) as any;

    if (conversationError) throw conversationError

    // Fetch participants with user details
    const { data: participants, error: participantsError } = await rawDb.select<any[]>('conversation_participants', {
      select: `
        *,
        user:users(id, anonymous_id, avatar_url, is_premium)
      `.replace(/\s+/g, ''),
      filters: { 'conversation_id': rawDb.filter.eq(conversationId) }
    });

    if (participantsError) throw participantsError

    // Fetch last message
    // Use rawDb with limit 1
    const { data: lastMessages, error: lastMessageError } = await rawDb.select<any[]>('direct_messages', {
      select: `
        *,
        sender:users!direct_messages_sender_id_fkey(id, anonymous_id, avatar_url)
      `.replace(/\s+/g, ''),
      filters: { 
        'conversation_id': rawDb.filter.eq(conversationId),
        'is_deleted': rawDb.filter.eq(false)
      },
      order: { column: 'created_at', ascending: false },
      limit: 1
    });
    
    // rawDb.select returns array even with limit 1 unless single: true. 
    // Here we handle array.
    const lastMessage = lastMessages && lastMessages.length > 0 ? lastMessages[0] : null;

      const currentParticipant = (participants || []).find(
        (participant: any) => participant.user_id === user.id
      )
      const lastReadAt = currentParticipant?.last_read_at || null
      const unreadCount = await getConversationUnreadCount(conversationId, user.id, lastReadAt)

      const conversation: Conversation = {
        id: conversationData.id,
        createdAt: conversationData.created_at,
        updatedAt: conversationData.updated_at,
        lastMessageAt: conversationData.last_message_at,
        participants: (participants || []).map(mapParticipant),
        lastMessage: lastMessage ? mapDirectMessage(lastMessage) : undefined,
        unreadCount,
        type: (conversationData as any).type || 'direct',
      }

    return { data: conversation, error: null }
  } catch (error: any) {
    console.error('Fetch conversation error:', error)
    return { data: null, error: error.message || 'Failed to fetch conversation' }
  }
}

/**
 * Create a ONE-TIME conversation explicitly
 */
export const createOneTimeConversation = async (
  recipientId: string
): Promise<{ data: Conversation | null; error: string | null }> => {
  try {
    const session = rawAuth.getSession();
    const user = session?.user;

    if (!user) {
      return { data: null, error: 'User not authenticated' }
    }

    if (user.id === recipientId) {
      return { data: null, error: 'You cannot send a one-off message to yourself' }
    }

    // Call RPC to create one-time conversation
    const { data: conversationId, error: rpcError } = await rawDb.rpc<string>('create_one_time_conversation', {
      sender_id: user.id,
      recipient_id: recipientId
    });

    if (rpcError) throw rpcError

    // Fetch the full conversation details
    const { data: conversationData, error: conversationError } = await rawDb.select<any>('conversations', {
      filters: { 'id': rawDb.filter.eq(conversationId!) }, // conversationId should be valid if no rpcError
      single: true
    });

    if (conversationError) throw conversationError

    const conversation: Conversation = {
      id: conversationData.id,
      createdAt: conversationData.created_at,
      updatedAt: conversationData.updated_at,
      lastMessageAt: conversationData.last_message_at,
      type: conversationData.type || 'one_time',
      unreadCount: 0
    }

    return { data: conversation, error: null }
  } catch (error: any) {
    console.error('Create one-time conversation error:', error)
    return { data: null, error: error.message || 'Failed to create conversation' }
  }
}

/**
 * Fetch messages in a conversation
 */
export const fetchMessages = async (
  conversationId: string,
  options?: {
    limit?: number
    offset?: number
  }
): Promise<{ data: DirectMessage[]; error: string | null }> => {
  try {
    const { data, error } = await rawDb.select<any[]>('direct_messages', {
      select: `
        *,
        sender:users!direct_messages_sender_id_fkey(id, anonymous_id, avatar_url),
        message_read_receipts(*),
        message_delivery_receipts(*)
      `.replace(/\s+/g, ''),
      filters: { 
        'conversation_id': rawDb.filter.eq(conversationId),
        'is_deleted': rawDb.filter.eq(false)
      },
      order: { column: 'created_at', ascending: false },
      limit: options?.limit,
      offset: options?.offset
    });

    if (error) throw error

      const mapped = (data || []).map(mapDirectMessage)
      return { data: mapped, error: null }
    } catch (error: any) {
      console.error('Fetch messages error:', error)
      return { data: [], error: error.message || 'Failed to fetch messages' }
    }
  }

/**
 * Send a message
 */
export const sendMessage = async (
  conversationId: string,
  content: string,
  messageType: DMMessageType = 'text',
  attachmentUrl?: string
): Promise<{ data: DirectMessage | null; error: string | null }> => {
  try {
    const session = rawAuth.getSession();
    const user = session?.user;

    if (!user) {
      return { data: null, error: 'User not authenticated' }
    }

    // Insert message
    const { data: insertedData, error: insertError } = await rawDb.insert('direct_messages', {
      conversation_id: conversationId,
      sender_id: user.id,
      content,
      message_type: messageType,
      attachment_url: attachmentUrl,
    }, { returning: true });

    if (insertError) throw insertError

    const messageId = insertedData && insertedData[0]?.id;
    if (!messageId) throw new Error("Inserted message has no ID");

    // Fetch the full message details separately to ensure we handle the join correctly
    const { data, error } = await rawDb.select<any>('direct_messages', {
      select: `
        *,
        sender:users!direct_messages_sender_id_fkey(id, anonymous_id, avatar_url),
        message_read_receipts(*),
        message_delivery_receipts(*)
      `.replace(/\s+/g, ''),
      filters: { 'id': rawDb.filter.eq(messageId) },
      single: true
    });

    if (error) throw error

      const mapped = data ? mapDirectMessage(data) : null
      return { data: mapped, error: null }
    } catch (error: any) {
      console.error('Send message error:', error)
      return { data: null, error: error.message || 'Failed to send message' }
    }
  }

/**
 * Edit a message
 */
export const editMessage = async (
  messageId: string,
  newContent: string
): Promise<{ success: boolean; error: string | null }> => {
  try {
    const { error } = await rawDb.update(
        'direct_messages',
        {
            content: newContent,
            is_edited: true,
            updated_at: new Date().toISOString(),
        },
        { 'id': rawDb.filter.eq(messageId) }
    );

    if (error) throw error

    return { success: true, error: null }
  } catch (error: any) {
    console.error('Edit message error:', error)
    return { success: false, error: error.message || 'Failed to edit message' }
  }
}

/**
 * Delete a message (soft delete)
 */
export const deleteMessage = async (
  messageId: string
): Promise<{ success: boolean; error: string | null }> => {
  try {
    const { error } = await rawDb.update(
        'direct_messages',
        {
            is_deleted: true,
            updated_at: new Date().toISOString(),
        },
        { 'id': rawDb.filter.eq(messageId) }
    );

    if (error) throw error

    return { success: true, error: null }
  } catch (error: any) {
    console.error('Delete message error:', error)
    return { success: false, error: error.message || 'Failed to delete message' }
  }
}

/**
 * Mark conversation as read
 */
export const markConversationRead = async (
  conversationId: string
): Promise<{ success: boolean; error: string | null }> => {
  try {
    const session = rawAuth.getSession();
    const user = session?.user;

    if (!user) {
      return { success: false, error: 'User not authenticated' }
    }

    const { error } = await rawDb.rpc('mark_conversation_read', {
      p_conversation_id: conversationId,
      p_user_id: user.id,
    });

    if (error) throw error

    return { success: true, error: null }
  } catch (error: any) {
    console.error('Mark conversation read error:', error)
    return { success: false, error: error.message || 'Failed to mark as read' }
  }
}

/**
 * Create read receipt
 */
export const createReadReceipt = async (
  messageId: string
): Promise<{ success: boolean; error: string | null }> => {
  try {
    const session = rawAuth.getSession();
    const user = session?.user;

    if (!user) {
      return { success: false, error: 'User not authenticated' }
    }

    const { error } = await rawDb.insert('message_read_receipts', {
        message_id: messageId,
        user_id: user.id,
    });

    if (error) {
      // Ignore duplicate errors (already read) might be handled by DB or rawDb error code check
      // For now, simple error check
      if (String(error).includes('23505') || (error as any)?.code === '23505') {
        return { success: true, error: null }
      }
      throw error
    }

    return { success: true, error: null }
  } catch (error: any) {
    console.error('Create read receipt error:', error)
    return { success: false, error: error.message || 'Failed to create read receipt' }
  }
}

/**
 * Create/update delivery receipt for a message
 */
export const createDeliveryReceipt = async (
  messageId: string
): Promise<{ success: boolean; error: string | null }> => {
  try {
    const session = rawAuth.getSession();
    const user = session?.user;

    if (!user) {
      return { success: false, error: 'User not authenticated' }
    }

    const { error } = await rawDb.rpc('mark_message_delivered', {
      p_message_id: messageId,
      p_user_id: user.id,
    });

    if (error) throw error

    return { success: true, error: null }
  } catch (error: any) {
    console.error('Create delivery receipt error:', error)
    return { success: false, error: error.message || 'Failed to create delivery receipt' }
  }
}

/**
 * Create/update delivery receipts for all messages in a conversation
 */
export const markConversationDelivered = async (
  conversationId: string
): Promise<{ success: boolean; error: string | null }> => {
  try {
    const session = rawAuth.getSession();
    const user = session?.user;

    if (!user) {
      return { success: false, error: 'User not authenticated' }
    }

    const { error } = await rawDb.rpc('mark_conversation_delivered', {
      p_conversation_id: conversationId,
      p_user_id: user.id,
    });

    if (error) throw error

    return { success: true, error: null }
  } catch (error: any) {
    console.error('Mark conversation delivered error:', error)
    return { success: false, error: error.message || 'Failed to mark conversation delivered' }
  }
}

/**
 * Mute/unmute conversation
 */
export const toggleMuteConversation = async (
  conversationId: string,
  isMuted: boolean
): Promise<{ success: boolean; error: string | null }> => {
  try {
    const session = rawAuth.getSession();
    const user = session?.user;

    if (!user) {
      return { success: false, error: 'User not authenticated' }
    }

    const { error } = await rawDb.update(
        'conversation_participants',
        { is_muted: isMuted },
        { 
            'conversation_id': rawDb.filter.eq(conversationId),
            'user_id': rawDb.filter.eq(user.id)
        }
    );

    if (error) throw error

    return { success: true, error: null }
  } catch (error: any) {
    console.error('Toggle mute error:', error)
    return { success: false, error: error.message || 'Failed to toggle mute' }
  }
}

/**
 * Get total unread message count
 */
export const getUnreadCount = async (): Promise<{ count: number; error: string | null }> => {
  try {
    const session = rawAuth.getSession();
    const user = session?.user;

    if (!user) {
      return { count: 0, error: 'User not authenticated' }
    }

    const { data, error } = await rawDb.rpc<number>('get_unread_dm_count', { p_user_id: user.id });

    if (error) {
        throw error
    }

    return { count: data || 0, error: null }
  } catch (error: any) {
    console.error('Get unread count error:', error)
    return { count: 0, error: error?.message || 'Failed to get unread count' }
  }
}

/**
 * Subscribe to new messages in a conversation
 */
export const subscribeToMessages = (
  conversationId: string,
  callback: (message: DirectMessage) => void
) => {
  const channel = rawRealtime.createChannel({
      channelName: `realtime:messages:${conversationId}`,
      config: {
          postgres_changes: [{
              event: 'INSERT',
              schema: 'public',
              table: 'direct_messages',
              filter: `conversation_id=eq.${conversationId}`
          }]
      },
      onPostgresChange: async (change) => {
          if (change.type === 'INSERT' && change.record) {
              const msgId = change.record.id;
              // Fetch full message with sender details
              const { data } = await rawDb.select<any>('direct_messages', {
                  select: `
                    *,
                    sender:users!direct_messages_sender_id_fkey(id, anonymous_id, avatar_url),
                    message_read_receipts(*),
                    message_delivery_receipts(*)
                  `.replace(/\s+/g, ''),
                  filters: { 'id': rawDb.filter.eq(msgId) },
                  single: true
              });

                if (data) {
                    callback(mapDirectMessage(data))
                }
            }
        }
    });

  channel.subscribe();

  return {
    unsubscribe: () => {
      channel.unsubscribe()
    },
  }
}

/**
 * Subscribe to conversation list updates
 */
export const subscribeToConversations = (
  userId: string,
  callback: () => void
) => {
  const channel = rawRealtime.createChannel({
      channelName: `realtime:conversations:${userId}`,
      config: {
          postgres_changes: [{
              event: '*',
              schema: 'public',
              table: 'direct_messages',
              // No filter or filter by participant? 
              // Original code: no filter, just listened to all direct_messages table changes?
              // That seems inefficient (receives ALL global DMs).
              // Actually, supabase.channel policy usually filters by RLS client-side if no filter provided?
              // No, Realtime receives ALL events unless filtered. 
              // Original code:
              /*
              postgres_changes: {
                event: '*',
                schema: 'public',
                table: 'direct_messages',
              }
              */
              // This relies on the client receiving events only for rows it can see? 
              // Supabase Realtime V2 with WAL usually does NOT apply RLS to the stream unless 'broadcast' or specific setup.
              // If the original code worked, it might have been receiving everything and filtering or just inefficient.
              // Ideally we filter by something relating to user.
              // But direct_messages doesn't have user_id (it has sender/recipient or conversation).
              // We can't filter by "user is participant" easily in realtime filter string.
              // We will replicate original behavior (no filter) but adding user_id check in callback if possible?
              // Or rely on `conversation_participants`.
              // Original code just called `callback()` (refresh list) on ANY change.
              // Let's assume we stick to exact replication.
          }]
      },
      onPostgresChange: () => {
          callback()
      }
  });

  channel.subscribe();

  return {
    unsubscribe: () => {
      channel.unsubscribe()
    },
  }
}
