/**
 * Custom hook for real-time user notifications
 * Subscribes to notification INSERT events and shows toast notifications
 */

import { useEffect, useRef } from 'react';
import { subscribeToUserNotifications } from '../realtime-service';
import { useToast } from '@/components/ui/Toast';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';

export interface UseRealtimeNotificationsProps {
  userId?: string;
  onNotification?: (notification: any) => void;
  showToastNotification?: boolean;
  playSound?: boolean;
  enabled?: boolean;
}

export const useRealtimeNotifications = ({
  userId,
  onNotification,
  showToastNotification = true,
  playSound = true,
  enabled = true,
}: UseRealtimeNotificationsProps) => {
  const { showToast } = useToast();
  const optionsRef = useRef({ onNotification, showToastNotification, playSound, showToast });
  optionsRef.current = { onNotification, showToastNotification, playSound, showToast };

  useEffect(() => {
    if (!userId || !enabled) return;

    const unsubscribe = subscribeToUserNotifications(userId, (payload: RealtimePostgresChangesPayload<any>) => {
      const notification = payload.new;
      const current = optionsRef.current;

      if (current.showToastNotification) {
        current.showToast({
          type: 'info',
          title: notification.title || 'New Notification',
          message: notification.message,
          duration: 5000,
        });
      }

      if (current.playSound && typeof window !== 'undefined') {
        try {
          const audio = new Audio('/sounds/notification.mp3');
          audio.volume = 0.5;
          audio.play().catch(() => {});
        } catch {}
      }

      current.onNotification?.(notification);
    });

    return () => {
      unsubscribe();
    };
  }, [userId, enabled]);
};
