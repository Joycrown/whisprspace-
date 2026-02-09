/**
 * Custom hook for real-time thread messages
 * Subscribes to message INSERT/UPDATE/DELETE events
 */

import { useEffect, useCallback } from 'react';
import { subscribeToThreadMessages } from '../realtime-service';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';

export interface UseThreadMessagesRealtimeProps {
  threadId?: string;
  onNewMessage?: (message: any) => void;
  onUpdateMessage?: (message: any) => void;
  onDeleteMessage?: (messageId: string) => void;
  enabled?: boolean;
}

export const useThreadMessagesRealtime = ({
  threadId,
  onNewMessage,
  onUpdateMessage,
  onDeleteMessage,
  enabled = true,
}: UseThreadMessagesRealtimeProps) => {
  
  const handleInsert = useCallback((payload: RealtimePostgresChangesPayload<any>) => {

    onNewMessage?.(payload.new);
  }, [onNewMessage]);

  const handleUpdate = useCallback((payload: RealtimePostgresChangesPayload<any>) => {

    onUpdateMessage?.(payload.new);
  }, [onUpdateMessage]);

  const handleDelete = useCallback((payload: RealtimePostgresChangesPayload<any>) => {

    const messageId = (payload.old as any)?.id;
    if (messageId) {
      onDeleteMessage?.(messageId);
    }
  }, [onDeleteMessage]);

  useEffect(() => {
    if (!threadId || !enabled) return;


    
    const unsubscribe = subscribeToThreadMessages(
      threadId,
      handleInsert,
      handleUpdate,
      handleDelete
    );

    return () => {

      unsubscribe();
    };
  }, [threadId, enabled, handleInsert, handleUpdate, handleDelete]);
};
