'use client'

import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { redeemThreadInvite } from '@/lib/threads';
import { useUserStore } from '@/store/userStore';
import { useToast } from '@/components/ui/Toast';

const InvitePage = () => {
  const params = useParams();
  const router = useRouter();
  const { session, sessionInfo, loginAnonymously } = useUserStore();
  const { showToast } = useToast();

  const code = useMemo(() => {
    const raw = Array.isArray(params.code) ? params.code[0] : params.code;
    return (raw || '').toString().trim();
  }, [params.code]);

  const [status, setStatus] = useState<'idle' | 'redeeming' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const hasSession = !!session.user || !!sessionInfo;

  const normalizeInviteError = (message: string) => {
    const normalized = message.toLowerCase();

    if (
      normalized.includes('invalid invite code') ||
      normalized.includes('invite code has expired') ||
      normalized.includes('thread not found') ||
      normalized.includes('thread is deleted') ||
      normalized.includes('thread has expired')
    ) {
      return 'Thread expired or deleted. Ask the creator for a new invite.';
    }

    return message;
  };

  const redeem = async () => {
    if (!code) {
      setErrorMessage('Invalid invite link.');
      setStatus('error');
      return;
    }

    setStatus('redeeming');
    const result = await redeemThreadInvite(code);

    if (result.error || !result.threadId) {
      const message = normalizeInviteError(result.error || 'Unable to redeem invite.');
      setErrorMessage(message);
      setStatus('error');
      showToast({
        type: 'error',
        title: 'Invite Failed',
        message,
        duration: 5000,
      });
      return;
    }

    router.replace(`/threads/${result.threadId}`);
  };

  useEffect(() => {
    if (!hasSession || status !== 'idle') return;
    redeem();
  }, [hasSession, status, code]);

  const handleGuest = async () => {
    setErrorMessage('');
    setStatus('redeeming');
    await loginAnonymously();
    await redeem();
  };

  const handleSignIn = () => {
    router.push(`/auth?redirect=/invite/${encodeURIComponent(code)}`);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0e0e10] px-4">
      <div className="w-full max-w-md rounded-2xl border border-gray-800 bg-[#141418] p-6 shadow-xl">
        <h1 className="text-xl font-semibold text-white mb-2">Join Thread</h1>
        <p className="text-sm text-gray-400 mb-6">
          You&apos;ve been invited to a private thread. Sign in or continue as a guest to join.
        </p>

        {status === 'redeeming' && (
          <div className="flex items-center gap-3 text-gray-300">
            <div className="w-5 h-5 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
            <span>Processing invite...</span>
          </div>
        )}

        {status === 'error' && (
          <div className="mb-4 rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">
            {errorMessage}
          </div>
        )}

        {!hasSession && status !== 'redeeming' && (
          <div className="flex flex-col gap-3">
            <button
              onClick={handleSignIn}
              className="w-full rounded-lg bg-purple-600 px-4 py-2 text-white font-semibold hover:bg-purple-500 transition-colors"
            >
              Sign In
            </button>
            <button
              onClick={handleGuest}
              className="w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-2 text-gray-200 font-semibold hover:bg-gray-700 transition-colors"
            >
              Continue as Guest
            </button>
          </div>
        )}

        {hasSession && status === 'idle' && (
          <button
            onClick={redeem}
            className="w-full rounded-lg bg-purple-600 px-4 py-2 text-white font-semibold hover:bg-purple-500 transition-colors"
          >
            Join Thread
          </button>
        )}

        {(status === 'error') && (
          <button
            onClick={() => router.push('/threads')}
            className="mt-4 w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-2 text-gray-200 font-semibold hover:bg-gray-700 transition-colors"
          >
            Back to Threads
          </button>
        )}
      </div>
    </div>
  );
};

export default InvitePage;
