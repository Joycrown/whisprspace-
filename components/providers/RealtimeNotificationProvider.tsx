'use client';

import { useCallback, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useRealtimeNotifications } from '@/lib/core/realtime/hooks';
import { REALTIME_RESUMED_EVENT } from '@/lib/core/supabase/raw-realtime';
import { queryKeys } from '@/lib/react-query/queryKeys';
import { useUserStore } from '@/store/userStore';

export const RealtimeNotificationProvider = () => {
  const userId = useUserStore((state) => state.session.user?.id);
  const isAnonymous = useUserStore((state) => state.session.user?.isAnonymous ?? true);
  const queryClient = useQueryClient();
  const isRealtimeEnabled = process.env.NODE_ENV === 'production';

  const handleNotification = useCallback((notification: { type?: string }) => {
    if (notification?.type === 'direct_message') {
      queryClient.invalidateQueries({ queryKey: queryKeys.conversations.lists() });
      queryClient.invalidateQueries({ queryKey: queryKeys.conversations.unreadCount() });
    }
  }, [queryClient]);

  useEffect(() => {
    const onResume = () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.conversations.all, refetchType: 'active' });
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all, refetchType: 'active' });
      queryClient.invalidateQueries({ queryKey: queryKeys.threads.all, refetchType: 'active' });
    };
    window.addEventListener(REALTIME_RESUMED_EVENT, onResume);
    return () => window.removeEventListener(REALTIME_RESUMED_EVENT, onResume);
  }, [queryClient]);

  useRealtimeNotifications({
    userId,
    enabled: !!userId && !isAnonymous && isRealtimeEnabled,
    showToastNotification: true,
    playSound: true,
    onNotification: handleNotification,
  });

  return null;
};
