/**
 * Custom hook for real-time story comments and comment reactions.
 * Only subscribes once the comments panel is active, matching the
 * feature's existing lazy-load-on-open behavior.
 */

import { useEffect, useCallback } from 'react';
import { subscribeToStoryComments } from '../realtime-service';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';

export interface UseStoryCommentsRealtimeProps {
  storyId?: string;
  threadId?: string;
  enabled?: boolean;
  onCommentInsert?: (message: any) => void;
  onCommentUpdate?: (message: any) => void;
  onCommentDelete?: (messageId: string) => void;
  onCommentReactionInsert?: (reaction: any) => void;
  onCommentReactionDelete?: (reaction: any) => void;
}

export const useStoryCommentsRealtime = ({
  storyId,
  threadId,
  enabled = true,
  onCommentInsert,
  onCommentUpdate,
  onCommentDelete,
  onCommentReactionInsert,
  onCommentReactionDelete,
}: UseStoryCommentsRealtimeProps) => {
  const handleInsert = useCallback((payload: RealtimePostgresChangesPayload<any>) => {
    onCommentInsert?.(payload.new);
  }, [onCommentInsert]);

  const handleUpdate = useCallback((payload: RealtimePostgresChangesPayload<any>) => {
    onCommentUpdate?.(payload.new);
  }, [onCommentUpdate]);

  const handleDelete = useCallback((payload: RealtimePostgresChangesPayload<any>) => {
    const messageId = (payload.old as any)?.id;
    if (messageId) onCommentDelete?.(messageId);
  }, [onCommentDelete]);

  const handleReactionInsert = useCallback((payload: RealtimePostgresChangesPayload<any>) => {
    onCommentReactionInsert?.(payload.new);
  }, [onCommentReactionInsert]);

  const handleReactionDelete = useCallback((payload: RealtimePostgresChangesPayload<any>) => {
    onCommentReactionDelete?.(payload.old);
  }, [onCommentReactionDelete]);

  useEffect(() => {
    if (!storyId || !threadId || !enabled) return;

    const unsubscribe = subscribeToStoryComments({
      storyId,
      threadId,
      onCommentInsert: handleInsert,
      onCommentUpdate: handleUpdate,
      onCommentDelete: handleDelete,
      onCommentReactionInsert: handleReactionInsert,
      onCommentReactionDelete: handleReactionDelete,
    });

    return () => {
      unsubscribe();
    };
  }, [storyId, threadId, enabled, handleInsert, handleUpdate, handleDelete, handleReactionInsert, handleReactionDelete]);
};
