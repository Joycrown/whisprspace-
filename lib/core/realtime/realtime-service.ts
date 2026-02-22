import * as rawRealtime from '@/lib/core/supabase/raw-realtime';

// Mock types compatible with Supabase SDK to avoid breaking consumers
export interface RealtimePostgresChangesPayload<T> {
  schema: string;
  table: string;
  commit_timestamp: string;
  eventType: 'INSERT' | 'UPDATE' | 'DELETE';
  new: T;
  old: T;
  errors: any[];
}

export interface ThreadEventsConfig {
  threadId: string;
  onMessageInsert?: (payload: RealtimePostgresChangesPayload<any>) => void;
  onMessageUpdate?: (payload: RealtimePostgresChangesPayload<any>) => void;
  onMessageDelete?: (payload: RealtimePostgresChangesPayload<any>) => void;
  onMessageLikeInsert?: (payload: RealtimePostgresChangesPayload<any>) => void;
  onMessageLikeDelete?: (payload: RealtimePostgresChangesPayload<any>) => void;
  onMessageReactionInsert?: (payload: RealtimePostgresChangesPayload<any>) => void;
  onMessageReactionDelete?: (payload: RealtimePostgresChangesPayload<any>) => void;
  onThreadUpdate?: (payload: RealtimePostgresChangesPayload<any>) => void;
  onLikeInsert?: (payload: RealtimePostgresChangesPayload<any>) => void;
  onLikeDelete?: (payload: RealtimePostgresChangesPayload<any>) => void;
  onParticipantInsert?: (payload: RealtimePostgresChangesPayload<any>) => void;
  onParticipantDelete?: (payload: RealtimePostgresChangesPayload<any>) => void;
  onTyping?: (payload: any) => void;
  pollId?: string;
  onPollVote?: (payload: RealtimePostgresChangesPayload<any>) => void;
  presence?: {
    userId: string;
    userInfo: { anonymousId: string; isPremium?: boolean };
    onSync?: (state: any) => void;
    onJoin?: (key: string, newPresences: any) => void;
    onLeave?: (key: string, leftPresences: any) => void;
  };
}

// Track active channels to support broadcast by threadId
const activeThreadChannels = new Map<string, any>();

/**
 * Helper to transform Raw PostgresChange to SDK-like Payload
 */
function transformChange(change: any): RealtimePostgresChangesPayload<any> {
  return {
    schema: change.schema,
    table: change.table,
    commit_timestamp: new Date().toISOString(), // Mock timestamp
    eventType: change.type,
    new: change.record,
    old: change.old_record,
    errors: []
  };
}

/**
 * Subscribe to ALL thread events via a single channel
 */
export const subscribeToThreadEvents = (config: ThreadEventsConfig): (() => void) => {
  const { threadId } = config;


  // Construct multiplexed config
  const channelConfig: any = {
    presence: config.presence ? { key: config.presence.userId } : undefined,
    postgres_changes: []
  };

  // 1. Messages
  if (config.onMessageInsert || config.onMessageUpdate || config.onMessageDelete) {
    if (config.onMessageInsert) channelConfig.postgres_changes.push({ event: 'INSERT', schema: 'public', table: 'messages', filter: `thread_id=eq.${threadId}` });
    if (config.onMessageUpdate) channelConfig.postgres_changes.push({ event: 'UPDATE', schema: 'public', table: 'messages', filter: `thread_id=eq.${threadId}` });
    if (config.onMessageDelete) channelConfig.postgres_changes.push({ event: 'DELETE', schema: 'public', table: 'messages', filter: `thread_id=eq.${threadId}` });
  }

  // 2. Thread Updates
  if (config.onThreadUpdate) {
    channelConfig.postgres_changes.push({ event: 'UPDATE', schema: 'public', table: 'threads', filter: `id=eq.${threadId}` });
  }

  // 3. Message likes (thread-scoped for lower payload volume)
  if (config.onMessageLikeInsert || config.onMessageLikeDelete) {
    if (config.onMessageLikeInsert) {
      channelConfig.postgres_changes.push({
        event: 'INSERT',
        schema: 'public',
        table: 'message_likes',
        filter: `thread_id=eq.${threadId}`,
      });
    }
    if (config.onMessageLikeDelete) {
      channelConfig.postgres_changes.push({
        event: 'DELETE',
        schema: 'public',
        table: 'message_likes',
        filter: `thread_id=eq.${threadId}`,
      });
    }
  }

  // 4. Message reactions (thread-scoped for lower payload volume)
  if (config.onMessageReactionInsert || config.onMessageReactionDelete) {
    if (config.onMessageReactionInsert) {
      channelConfig.postgres_changes.push({
        event: 'INSERT',
        schema: 'public',
        table: 'message_reactions',
        filter: `thread_id=eq.${threadId}`,
      });
    }
    if (config.onMessageReactionDelete) {
      channelConfig.postgres_changes.push({
        event: 'DELETE',
        schema: 'public',
        table: 'message_reactions',
        filter: `thread_id=eq.${threadId}`,
      });
    }
  }

  // 5. Thread Likes
  if (config.onLikeInsert || config.onLikeDelete) {
    if (config.onLikeInsert) channelConfig.postgres_changes.push({ event: 'INSERT', schema: 'public', table: 'thread_likes', filter: `thread_id=eq.${threadId}` });
    if (config.onLikeDelete) channelConfig.postgres_changes.push({ event: 'DELETE', schema: 'public', table: 'thread_likes', filter: `thread_id=eq.${threadId}` });
  }

  // 6. Thread Participants
  if (config.onParticipantInsert || config.onParticipantDelete) {
    if (config.onParticipantInsert) channelConfig.postgres_changes.push({ event: 'INSERT', schema: 'public', table: 'thread_participants', filter: `thread_id=eq.${threadId}` });
    if (config.onParticipantDelete) channelConfig.postgres_changes.push({ event: 'DELETE', schema: 'public', table: 'thread_participants', filter: `thread_id=eq.${threadId}` });
  }

  // 7. Poll Votes
  if (config.pollId && config.onPollVote) {
    channelConfig.postgres_changes.push({ event: 'INSERT', schema: 'public', table: 'poll_votes', filter: `poll_id=eq.${config.pollId}` });
  }

  const channel = rawRealtime.createChannel({
    channelName: `realtime:thread:${threadId}`,
    config: channelConfig,
    onPostgresChange: (change) => {
      const payload = transformChange(change);
      
      // Dispatch based on table and event
      if (change.table === 'messages') {
        if (change.type === 'INSERT') config.onMessageInsert?.(payload);
        if (change.type === 'UPDATE') config.onMessageUpdate?.(payload);
        if (change.type === 'DELETE') config.onMessageDelete?.(payload);
      }
      else if (change.table === 'message_likes') {
        if (change.type === 'INSERT') config.onMessageLikeInsert?.(payload);
        if (change.type === 'DELETE') config.onMessageLikeDelete?.(payload);
      }
      else if (change.table === 'message_reactions') {
        if (change.type === 'INSERT') config.onMessageReactionInsert?.(payload);
        if (change.type === 'DELETE') config.onMessageReactionDelete?.(payload);
      }
      else if (change.table === 'threads') {
        if (change.type === 'UPDATE') config.onThreadUpdate?.(payload);
      }
      else if (change.table === 'thread_likes') {
        if (change.type === 'INSERT') config.onLikeInsert?.(payload);
        if (change.type === 'DELETE') config.onLikeDelete?.(payload);
      }
      else if (change.table === 'thread_participants') {

        if (change.type === 'INSERT') config.onParticipantInsert?.(payload);
        if (change.type === 'DELETE') config.onParticipantDelete?.(payload);
      }
      else if (change.table === 'poll_votes') {
        if (change.type === 'INSERT') config.onPollVote?.(payload);
      }
    },
    onPresenceSync: (state) => {
      // Raw presence sync is simpler, might need adaptation
      config.presence?.onSync?.(state);
    },
    onBroadcast: (payload) => {
      if (payload.event === 'typing') {
        config.onTyping?.(payload);
      }
    }
  });

  // Store active channel for broadcasting
  activeThreadChannels.set(threadId, channel);

  let isActive = true;
  let retryAttempt = 0;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;

  const subscribeWithRetry = () => {
    if (!isActive) return;

    channel
      .subscribe()
      .then(async () => {
        retryAttempt = 0;
        if (config.presence) {
          await channel.track({
            user_id: config.presence.userId,
            anonymous_id: config.presence.userInfo.anonymousId,
            is_premium: config.presence.userInfo.isPremium || false,
            online_at: new Date().toISOString(),
          });
        }
      })
      .catch((error) => {
        if (!isActive) return;
        console.error(`[Realtime] Failed to subscribe to thread channel ${threadId}:`, error);
        const retryDelayMs = Math.min(1000 * Math.pow(2, retryAttempt), 15000);
        retryAttempt++;
        retryTimer = setTimeout(() => {
          retryTimer = null;
          subscribeWithRetry();
        }, retryDelayMs);
      });
  };

  subscribeWithRetry();

  return () => {
    isActive = false;
    if (retryTimer) clearTimeout(retryTimer);
    channel.unsubscribe();
    activeThreadChannels.delete(threadId);
  };
};

/**
 * Broadcast typing indicator (reused)
 */
export const broadcastTyping = (
  threadId: string,
  userId: string,
  isTyping: boolean
): void => {
  const channel = activeThreadChannels.get(threadId);
  
  if (channel) {
    channel.broadcast('typing', {
      user_id: userId,
      is_typing: isTyping,
      timestamp: new Date().toISOString(),
    });
  } else {
    // No active channel means user isn't subscribed, skip
  }
};

export const subscribeToAllThreads = (
  onInsert: (payload: RealtimePostgresChangesPayload<any>) => void,
  onUpdate?: (payload: RealtimePostgresChangesPayload<any>) => void,
  onDelete?: (payload: RealtimePostgresChangesPayload<any>) => void
): (() => void) => {
  const channel = rawRealtime.createChannel({
    channelName: 'realtime:threads:all',
    config: {
      postgres_changes: [
        { event: 'INSERT', schema: 'public', table: 'threads' },
        { event: 'UPDATE', schema: 'public', table: 'threads' },
        { event: 'DELETE', schema: 'public', table: 'threads' }
      ]
    },
    onPostgresChange: (change) => {
      const payload = transformChange(change);
      if (change.type === 'INSERT') onInsert(payload);
      if (change.type === 'UPDATE') onUpdate?.(payload);
      if (change.type === 'DELETE') onDelete?.(payload);
    }
  });

  channel.subscribe().catch(err => {
    console.error('[Realtime] Failed to subscribe to all threads:', err);
  });
  return () => channel.unsubscribe();
};

/**
 * Subscribe to ALL participant changes (to update counts in lists)
 */
export const subscribeToAllParticipantChanges = (
  onChange: () => void
): (() => void) => {
  const unsubInsert = rawRealtime.subscribeToTable('thread_participants', {
    event: 'INSERT',
    onChange: () => {
      onChange();
    }
  });

  const unsubDelete = rawRealtime.subscribeToTable('thread_participants', {
    event: 'DELETE',
    onChange: () => {
      onChange();
    }
  });

  return () => {
    unsubInsert();
    unsubDelete();
  };
};

export const subscribeToUserNotifications = (
  userId: string,
  onNotification: (payload: RealtimePostgresChangesPayload<any>) => void
): (() => void) => {
  const channel = rawRealtime.createChannel({
    channelName: `realtime:user:${userId}:notifications`,
    config: {
      postgres_changes: [
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` }
      ]
    },
    onPostgresChange: (change) => {
      const payload = transformChange(change);
      if (change.type === 'INSERT') onNotification(payload);
    }
  });

  let isActive = true;
  let retryAttempt = 0;
  const maxRetryAttempts = 5;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;

  const subscribeWithRetry = () => {
    if (!isActive) return;

    channel.subscribe().catch((err) => {
      if (!isActive) return;

      const message = err instanceof Error ? err.message : String(err);
      const isJoinTimeout = message.includes('Channel join timed out');

      if (retryAttempt >= maxRetryAttempts) {
        console.warn(
          `[Realtime] Notifications subscription disabled after ${maxRetryAttempts} retries for user ${userId}`
        );
        return;
      }

      if (isJoinTimeout) {
        console.warn(`[Realtime] Notifications channel join timed out for user ${userId}; retrying...`);
      } else {
        console.error(`[Realtime] Failed to subscribe to notifications for user ${userId}:`, err);
      }

      const retryDelayMs = Math.min(1000 * Math.pow(2, retryAttempt), 15000);
      retryAttempt++;
      retryTimer = setTimeout(() => {
        retryTimer = null;
        subscribeWithRetry();
      }, retryDelayMs);
    });
  };

  subscribeWithRetry();

  return () => {
    isActive = false;
    if (retryTimer) clearTimeout(retryTimer);
    channel.unsubscribe();
  };
};

// Legacy Wrappers (Proxy to unified function)

export const trackThreadPresence = (
  threadId: string,
  userId: string,
  userInfo: { anonymousId: string; isPremium?: boolean }
) => {
  return subscribeToThreadEvents({
    threadId,
    presence: { userId, userInfo }
  });
};

export const getThreadPresence = async (threadId: string): Promise<any> => {
  void threadId;
  // Not easily supported with raw-realtime on-demand without subscribing
  // Returning empty object for now as this is rarely used critical path
  return {};
};

export const subscribeToThreadMessages = (
  threadId: string,
  onInsert: (payload: RealtimePostgresChangesPayload<any>) => void,
  onUpdate?: (payload: RealtimePostgresChangesPayload<any>) => void,
  onDelete?: (payload: RealtimePostgresChangesPayload<any>) => void
) => {
  return subscribeToThreadEvents({
    threadId,
    onMessageInsert: onInsert,
    onMessageUpdate: onUpdate,
    onMessageDelete: onDelete,
  });
};

export const subscribeToThread = (
  threadId: string,
  onUpdate: (payload: RealtimePostgresChangesPayload<any>) => void
) => {
  return subscribeToThreadEvents({
    threadId,
    onThreadUpdate: onUpdate,
  });
};

export const subscribeToThreadLikes = (
  threadId: string,
  onInsert: (payload: RealtimePostgresChangesPayload<any>) => void,
  onDelete?: (payload: RealtimePostgresChangesPayload<any>) => void
) => {
  return subscribeToThreadEvents({
    threadId,
    onLikeInsert: onInsert,
    onLikeDelete: onDelete,
  });
};

export const subscribeToTyping = (
  threadId: string,
  onTyping: (payload: any) => void
) => {
  return subscribeToThreadEvents({
    threadId,
    onTyping,
  });
};

export const subscribeToPollVotes = (
  pollId: string,
  onVote: (payload: RealtimePostgresChangesPayload<any>) => void
) => {
  // Standalone subscription
  const channel = rawRealtime.createChannel({
    channelName: `realtime:poll:${pollId}:votes`,
    config: {
      postgres_changes: [
        { event: 'INSERT', schema: 'public', table: 'poll_votes', filter: `poll_id=eq.${pollId}` }
      ]
    },
    onPostgresChange: (change) => {
      const payload = transformChange(change);
      if (change.type === 'INSERT') onVote(payload);
    }
  });
  
  channel.subscribe().catch(err => {
    console.error(`[Realtime] Failed to subscribe to poll votes for poll ${pollId}:`, err);
  });
  return () => channel.unsubscribe();
};
