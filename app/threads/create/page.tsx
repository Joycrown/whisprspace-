"use client";

import React, { Suspense, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import ThreadComposer from '@/components/features/threads/ThreadComposer';
import { ThreadDraft, CreateThreadForm } from '@/types';
import { INBOX_THREAD_DRAFT_KEY } from '@/components/features/inbox/MessageModal';
import * as rawAuth from '@/lib/core/supabase/raw-auth';

interface InboxThreadDraft {
  conversationId: string;
  form: Partial<CreateThreadForm>;
}

const LoadingFallback = () => (
  <div className="min-h-screen bg-[#121212] flex items-center justify-center">
    <div className="w-12 h-12 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin"></div>
  </div>
);

function CreateThreadContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const fromInbox = searchParams?.get('from') === 'inbox';

  const [draft, setDraft] = useState<ThreadDraft | undefined>();
  const [initialForm, setInitialForm] = useState<Partial<CreateThreadForm> | undefined>();
  const [inboxConversationId, setInboxConversationId] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  // Handle mount state
  useEffect(() => {
    setMounted(true);
  }, []);

  // Load the right prefill source on mount:
  // - inbox origin → the dedicated inbox draft (prefills form + links conversation)
  // - otherwise → the normal saved thread draft
  useEffect(() => {
    if (!mounted) return;

    if (fromInbox) {
      const raw = localStorage.getItem(INBOX_THREAD_DRAFT_KEY);
      if (raw) {
        try {
          const parsed = JSON.parse(raw) as InboxThreadDraft;
          setInitialForm(parsed.form);
          setInboxConversationId(parsed.conversationId);
          return;
        } catch {
          localStorage.removeItem(INBOX_THREAD_DRAFT_KEY);
        }
      }
    }

    const savedDraft = localStorage.getItem('thread_draft');
    if (savedDraft) {
      try {
        setDraft(JSON.parse(savedDraft));
      } catch {
        localStorage.removeItem('thread_draft');
      }
    }
  }, [mounted, fromInbox]);

  const handleClose = () => {
    router.back();
  };

  // After the thread is created from an inbox conversation, import ALL of that
  // conversation's messages into the new thread as anonymous INBOX_USER messages.
  // Only on full success is the conversation marked converted (server-side).
  const importInboxMessages = async (threadId: string) => {
    if (!inboxConversationId) return;
    const token = rawAuth.getSession()?.access_token;
    const res = await fetch('/api/threads/import-inbox-messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ conversationId: inboxConversationId, threadId }),
    });

    // Clear the one-shot draft either way so a refresh doesn't re-trigger it.
    localStorage.removeItem(INBOX_THREAD_DRAFT_KEY);

    // 409 = already converted — fine, treat as done. Other failures bubble up so
    // ThreadComposer surfaces a toast (thread still created). Include the server's
    // detail so the real cause is visible instead of a generic message.
    if (!res.ok && res.status !== 409) {
      let detail = '';
      try {
        const data = await res.json();
        detail = data?.detail || data?.error || '';
      } catch {
        // ignore
      }
      throw new Error(detail ? `Failed to import messages: ${detail}` : 'Failed to import messages');
    }
  };

  // Prevent hydration mismatch
  if (!mounted) {
    return <LoadingFallback />;
  }

  return (
    <div className="min-h-screen bg-[#121212]">
      <ThreadComposer
        isOpen={true}
        onClose={handleClose}
        draft={draft}
        initialForm={initialForm}
        onCreated={inboxConversationId ? importInboxMessages : undefined}
      />
    </div>
  );
}

// useSearchParams() requires a Suspense boundary or the static build bails out
// (missing-suspense-with-csr-bailout). Same pattern as app/inbox/page.tsx.
export default function CreateThreadPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <CreateThreadContent />
    </Suspense>
  );
}
