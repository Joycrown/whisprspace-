/**
 * Custom hook for real-time presence tracking
 * Tracks who is online in a thread
 */

import { useState, useEffect } from 'react';
import { trackThreadPresence, getThreadPresence } from '../realtime-service';

export interface PresenceUser {
  user_id: string;
  anonymous_id: string;
  is_premium: boolean;
  online_at: string;
}

export interface UseThreadPresenceProps {
  threadId?: string;
  userId?: string;
  userInfo?: {
    anonymousId: string;
    isPremium?: boolean;
  };
  enabled?: boolean;
}

export const useThreadPresence = ({
  threadId,
  userId,
  userInfo,
  enabled = true,
}: UseThreadPresenceProps) => {
  const [onlineUsers, setOnlineUsers] = useState<PresenceUser[]>([]);
  const [onlineCount, setOnlineCount] = useState(0);

  useEffect(() => {
    if (!threadId || !enabled) return;

    // Get initial presence state
    getThreadPresence(threadId).then(state => {
      const users = Object.values(state).flat() as PresenceUser[];
      setOnlineUsers(users);
      setOnlineCount(users.length);
    });

    // Track user's presence if userId provided
    if (userId && userInfo) {

      
      const unsubscribe = trackThreadPresence(threadId, userId, userInfo);

      return () => {

        unsubscribe();
      };
    }
  }, [threadId, userId, userInfo, enabled]);

  return {
    onlineUsers,
    onlineCount,
    isUserOnline: (checkUserId: string) => 
      onlineUsers.some(u => u.user_id === checkUserId),
  };
};
