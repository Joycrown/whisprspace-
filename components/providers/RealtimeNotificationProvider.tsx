/**
 * Realtime Notification Provider
 * Handles real-time notification subscriptions for logged-in users
 */

'use client';

import { useRealtimeNotifications } from '@/lib/core/realtime/hooks';
import { useUserStore } from '@/store/userStore';

export const RealtimeNotificationProvider = () => {
  const { session } = useUserStore();
  const userId = session?.user?.id;
  const isRealtimeEnabled = process.env.NODE_ENV === 'production';

  // Subscribe to realtime notifications
  useRealtimeNotifications({
    userId,
    enabled: !!userId && isRealtimeEnabled,
    showToastNotification: true,
    playSound: true,
    onNotification: (notification) => {
      // Additional handling if needed
      console.log('[RealtimeNotifications] Received:', notification);
    },
  });

  // This component doesn't render anything
  return null;
};
