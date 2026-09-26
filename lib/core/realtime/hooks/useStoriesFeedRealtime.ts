/**
 * Custom hook for real-time story feed updates: new stories publishing
 * and reply_count/reaction_counts changes on already-visible stories.
 * One feed-wide channel; caller filters/discards client-side.
 */

import { useEffect, useCallback } from 'react';
import { subscribeToStoriesFeed } from '../realtime-service';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';

export interface UseStoriesFeedRealtimeProps {
  enabled?: boolean;
  onNewStory?: (story: any) => void;
  onStoryUpdate?: (story: any) => void;
}

export const useStoriesFeedRealtime = ({
  enabled = true,
  onNewStory,
  onStoryUpdate,
}: UseStoriesFeedRealtimeProps) => {
  const handleInsert = useCallback((payload: RealtimePostgresChangesPayload<any>) => {
    onNewStory?.(payload.new);
  }, [onNewStory]);

  const handleUpdate = useCallback((payload: RealtimePostgresChangesPayload<any>) => {
    onStoryUpdate?.(payload.new);
  }, [onStoryUpdate]);

  useEffect(() => {
    if (!enabled) return;

    const unsubscribe = subscribeToStoriesFeed(handleInsert, handleUpdate);

    return () => {
      unsubscribe();
    };
  }, [enabled, handleInsert, handleUpdate]);
};
