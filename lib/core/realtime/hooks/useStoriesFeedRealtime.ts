import { useEffect, useRef } from 'react';
import { subscribeToStoriesFeed } from '../realtime-service';
import type { StoryLiveRow } from '@/lib/stories/types';

export interface UseStoriesFeedRealtimeProps {
  enabled?: boolean;
  onNewStory: (row: StoryLiveRow) => void;
  onStoryUpdate: (row: StoryLiveRow) => void;
}

export const useStoriesFeedRealtime = ({ enabled = true, onNewStory, onStoryUpdate }: UseStoriesFeedRealtimeProps) => {
  const handlersRef = useRef({ onNewStory, onStoryUpdate });
  handlersRef.current = { onNewStory, onStoryUpdate };

  useEffect(() => {
    if (!enabled) return;
    return subscribeToStoriesFeed(
      (payload) => handlersRef.current.onNewStory(payload.new as StoryLiveRow),
      (payload) => handlersRef.current.onStoryUpdate(payload.new as StoryLiveRow)
    );
  }, [enabled]);
};
