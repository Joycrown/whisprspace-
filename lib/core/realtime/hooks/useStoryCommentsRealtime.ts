import { useEffect, useRef } from 'react';
import { subscribeToStoryCommentReactions } from '../realtime-service';

export interface StoryCommentReactionEvent {
  message_id: string;
  user_id: string;
  reaction_type: string;
}

export interface UseStoryCommentsRealtimeProps {
  storyId?: string;
  threadId?: string;
  enabled?: boolean;
  onReaction: (reaction: StoryCommentReactionEvent) => void;
}

export const useStoryCommentsRealtime = ({ storyId, threadId, enabled = true, onReaction }: UseStoryCommentsRealtimeProps) => {
  const onReactionRef = useRef(onReaction);
  onReactionRef.current = onReaction;

  useEffect(() => {
    if (!storyId || !threadId || !enabled) return;
    return subscribeToStoryCommentReactions(storyId, threadId, (payload) =>
      onReactionRef.current(payload.new as StoryCommentReactionEvent)
    );
  }, [storyId, threadId, enabled]);
};
