"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import ThreadComposer from '@/components/features/threads/ThreadComposer';
import { ThreadDraft } from '@/types';

export default function CreateThreadPage() {
  const router = useRouter();
  const [draft, setDraft] = useState<ThreadDraft | undefined>();
  const [mounted, setMounted] = useState(false);

  // Handle mount state
  useEffect(() => {
    setMounted(true);
  }, []);

  // Load draft from localStorage on mount
  useEffect(() => {
    if (!mounted) return;

    const savedDraft = localStorage.getItem('thread_draft');
    if (savedDraft) {
      try {
        setDraft(JSON.parse(savedDraft));
      } catch (error) {
        localStorage.removeItem('thread_draft');
      }
    }
  }, [mounted]);

  const handleClose = () => {
    router.back();
  };

  // Prevent hydration mismatch
  if (!mounted) {
    return (
      <div className="min-h-screen bg-[#121212] flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#121212]">
      <ThreadComposer
        isOpen={true}
        onClose={handleClose}
        draft={draft}
      />
    </div>
  );
}
