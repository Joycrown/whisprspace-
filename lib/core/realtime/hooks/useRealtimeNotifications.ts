/**
 * Custom hook for real-time user notifications
 * Subscribes to notification INSERT events and shows toast notifications
 */

import { useEffect, useCallback } from 'react';
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

  const handleNotification = useCallback((payload: RealtimePostgresChangesPayload<any>) => {
    const notification = payload.new;


    // Show toast notification
    if (showToastNotification) {
      showToast({
        type: 'info',
        title: notification.title || 'New Notification',
        message: notification.message,
        duration: 5000,
      });
    }

    // Play notification sound
    if (playSound && typeof window !== 'undefined') {
      try {
        const audio = new Audio('/sounds/notification.mp3');
        audio.volume = 0.5;
        audio.play().catch(err => console.log('Audio play failed:', err));
      } catch (error) {
        console.log('Notification sound error:', error);
      }
    }

    // Call custom callback
    onNotification?.(notification);
  }, [showToastNotification, playSound, onNotification, showToast]);

  useEffect(() => {
    if (!userId || !enabled) return;


    
    const unsubscribe = subscribeToUserNotifications(userId, handleNotification);

    return () => {

      unsubscribe();
    };
  }, [userId, enabled, handleNotification]);
};
