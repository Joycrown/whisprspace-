import { useEffect, useRef } from 'react';
import { subscribeToStoryLive } from '../realtime-service';
import type { StoryLiveRow } from '@/lib/stories/types';

export interface UseStoryLiveRealtimeProps {
  storyId?: string;
  enabled?: boolean;
  onUpdate: (row: StoryLiveRow) => void;
}

export const useStoryLiveRealtime = ({ storyId, enabled = true, onUpdate }: UseStoryLiveRealtimeProps) => {
  const onUpdateRef = useRef(onUpdate);
  onUpdateRef.current = onUpdate;

  useEffect(() => {
    if (!storyId || !enabled) return;
    return subscribeToStoryLive(storyId, (payload) => onUpdateRef.current(payload.new as StoryLiveRow));
  }, [storyId, enabled]);
};
