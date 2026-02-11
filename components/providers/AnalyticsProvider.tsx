'use client';

import React, { useEffect } from 'react';
import posthog from 'posthog-js';
import { PostHogProvider } from 'posthog-js/react';
import { usePathname } from 'next/navigation';
import { useUserStore } from '@/store/userStore';

const isPostHogReady = () => (posthog as any).__loaded;

const initPostHog = () => {
  if (typeof window === 'undefined') return;
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key) return;

  if (!isPostHogReady()) {
    posthog.init(key, {
      api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://app.posthog.com',
      capture_pageview: false,
      autocapture: true,
      mask_all_text: true,
      mask_all_inputs: true,
      disable_session_recording: false,
      session_recording: {
        maskAllText: true,
        maskAllInputs: true,
        blockClass: 'ph-no-capture',
        maskTextClass: 'ph-mask',
      },
      persistence: 'localStorage+cookie',
    });
  }
};

const PostHogPageView = () => {
  const pathname = usePathname();

  useEffect(() => {
    if (!isPostHogReady()) return;
    if (typeof window === 'undefined') return;
    posthog.capture('$pageview', { $current_url: window.location.href });
  }, [pathname]);

  return null;
};

export default function AnalyticsProvider({ children }: { children: React.ReactNode }) {
  const { session } = useUserStore();

  useEffect(() => {
    initPostHog();
  }, []);

  useEffect(() => {
    if (!isPostHogReady()) return;

    const user = session.user;
    if (user?.id) {
      posthog.identify(user.id, {
        is_premium: !!user.isPremium,
        anonymous_id: user.anonymousId,
        username: user.username || user.anonymousId,
      });
    } else {
      posthog.reset();
    }
  }, [session.user?.id, session.user?.isPremium, session.user?.anonymousId, session.user?.username]);

  if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) {
    return <>{children}</>;
  }

  return (
    <PostHogProvider client={posthog}>
      <PostHogPageView />
      {children}
    </PostHogProvider>
  );
}
