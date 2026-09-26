/**
 * Custom hook for real-time story reactions and story row changes
 * (reply_count / reaction_counts). One channel per open story page.
 */

import { useEffect, useCallback } from 'react';
import { subscribeToStoryReactions } from '../realtime-service';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';

export interface UseStoryReactionsRealtimeProps {
  storyId?: string;
  enabled?: boolean;
  onStoryUpdate?: (story: any) => void;
  onStoryReactionInsert?: (reaction: any) => void;
  onStoryReactionUpdate?: (reaction: any, old: any) => void;
  onStoryReactionDelete?: (reaction: any) => void;
}

export const useStoryReactionsRealtime = ({
  storyId,
  enabled = true,
  onStoryUpdate,
  onStoryReactionInsert,
  onStoryReactionUpdate,
  onStoryReactionDelete,
}: UseStoryReactionsRealtimeProps) => {
  const handleStoryUpdate = useCallback((payload: RealtimePostgresChangesPayload<any>) => {
    onStoryUpdate?.(payload.new);
  }, [onStoryUpdate]);

  const handleReactionInsert = useCallback((payload: RealtimePostgresChangesPayload<any>) => {
    onStoryReactionInsert?.(payload.new);
  }, [onStoryReactionInsert]);

  const handleReactionUpdate = useCallback((payload: RealtimePostgresChangesPayload<any>) => {
    onStoryReactionUpdate?.(payload.new, payload.old);
  }, [onStoryReactionUpdate]);

  const handleReactionDelete = useCallback((payload: RealtimePostgresChangesPayload<any>) => {
    onStoryReactionDelete?.(payload.old);
  }, [onStoryReactionDelete]);

  useEffect(() => {
    if (!storyId || !enabled) return;

    const unsubscribe = subscribeToStoryReactions({
      storyId,
      onStoryUpdate: handleStoryUpdate,
      onStoryReactionInsert: handleReactionInsert,
      onStoryReactionUpdate: handleReactionUpdate,
      onStoryReactionDelete: handleReactionDelete,
    });

    return () => {
      unsubscribe();
    };
  }, [storyId, enabled, handleStoryUpdate, handleReactionInsert, handleReactionUpdate, handleReactionDelete]);
};
