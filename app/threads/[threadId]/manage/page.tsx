'use client'

import { use } from 'react';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { ArrowLeft } from 'lucide-react';
import AccessManagement from '@/components/features/premium/AccessManagement';
import { useThreadStore } from '@/store/threadStore';
import { useUserStore } from '@/store/userStore';
import { AccessCode } from '@/types';
import * as rawDb from '@/lib/core/supabase/raw-db';
import {
  fetchThreadAccessCodes,
  createThreadAccessCode,
} from '@/lib/threads/thread-service';

interface PageProps {
  params: Promise<{
    threadId: string;
  }>;
}

interface SalesRow {
  id: string;
  status?: string | null;
}

export default function ThreadManagePage({ params }: PageProps) {
  const resolvedParams = use(params);
  const { threadId } = resolvedParams;
  const router = useRouter();
  const { currentThread, fetchThreadById } = useThreadStore();
  const { session } = useUserStore();
  const [isLoading, setIsLoading] = useState(true);
  const [accessCodes, setAccessCodes] = useState<AccessCode[]>([]);
  const [codesLoading, setCodesLoading] = useState(false);
  const [codesError, setCodesError] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [salesCount, setSalesCount] = useState(0);
  const [salesLoading, setSalesLoading] = useState(false);
  const isThreadActive = Boolean(
    currentThread &&
    (!currentThread.expiresAt || new Date(currentThread.expiresAt) > new Date())
  );
  const freeAccessCount = accessCodes.reduce((sum, code) => sum + code.currentUses, 0);

  useEffect(() => {
    const loadThread = async () => {
      setIsLoading(true);
      await fetchThreadById(threadId);
      setIsLoading(false);
    };
    loadThread();
  }, [threadId, fetchThreadById]);

  useEffect(() => {
    const loadCodes = async () => {
      if (!currentThread) return;
      setCodesLoading(true);
      const { data, error } = await fetchThreadAccessCodes(threadId);
      if (error) {
        setCodesError(error);
      } else {
        setAccessCodes(data);
        setCodesError(null);
      }
      setCodesLoading(false);
    };

    if (currentThread?.id) {
      loadCodes();
    }
  }, [currentThread, currentThread?.id, threadId]);

  // Check if user is the creator
  const isCreator = session?.user?.id === currentThread?.author.id;

  useEffect(() => {
    const loadSalesCount = async () => {
      if (!threadId || !session?.user?.id || !isCreator) {
        setSalesCount(0);
        setSalesLoading(false);
        return;
      }

      setSalesLoading(true);

      const { data, error } = await rawDb.select<SalesRow[]>('creator_earnings', {
        select: 'id,status',
        filters: {
          creator_id: rawDb.filter.eq(session.user.id),
          thread_id: rawDb.filter.eq(threadId),
        },
      });

      if (error) {
        console.error('Failed to load premium thread sales count:', error);
        setSalesLoading(false);
        return;
      }

      const rows = data || [];
      const nonRefundedCount = rows.filter((row) => String(row.status || '').toLowerCase() !== 'refunded').length;
      setSalesCount(nonRefundedCount);
      setSalesLoading(false);
    };

    loadSalesCount();
  }, [threadId, session?.user?.id, isCreator, isGenerating]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#121212] flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!currentThread) {
    return (
      <div className="min-h-screen bg-[#121212] flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white mb-4">Thread Not Found</h1>
          <button
            onClick={() => router.push('/threads')}
            className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
          >
            Back to Threads
          </button>
        </div>
      </div>
    );
  }

  if (!currentThread.isPremium) {
    return (
      <div className="min-h-screen bg-[#121212] flex items-center justify-center">
        <div className="text-center max-w-md">
          <h1 className="text-2xl font-bold text-white mb-4">Not a Premium Thread</h1>
          <p className="text-gray-400 mb-6">
            Access management is only available for premium threads.
          </p>
          <button
            onClick={() => router.push(`/threads/${threadId}`)}
            className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
          >
            Back to Thread
          </button>
        </div>
      </div>
    );
  }

  if (!isCreator) {
    return (
      <div className="min-h-screen bg-[#121212] flex items-center justify-center">
        <div className="text-center max-w-md">
          <h1 className="text-2xl font-bold text-white mb-4">Access Denied</h1>
          <p className="text-gray-400 mb-6">
            Only the thread creator can manage access codes and settings.
          </p>
          <button
            onClick={() => router.push(`/threads/${threadId}`)}
            className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
          >
            Back to Thread
          </button>
        </div>
      </div>
    );
  }

  const handleGenerateCode = async () => {
    setIsGenerating(true);
    const { data, error } = await createThreadAccessCode(threadId);
    if (error || !data) {
      setCodesError(error || 'Failed to generate access code');
      setIsGenerating(false);
      return;
    }
    setAccessCodes((prev) => [data, ...prev]);
    setCodesError(null);
    setIsGenerating(false);
  };


  return (
    <div className="min-h-screen bg-[#121212] py-8">
      <div className="max-w-4xl mx-auto px-4">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => router.push(`/threads/${threadId}`)}
            className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors mb-4"
          >
            <ArrowLeft className="w-5 h-5" />
            Back to Thread
          </button>

          <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
            <h1 className="text-3xl font-bold text-white mb-2">
              Thread Access Management
            </h1>
            <p className="text-gray-400">
              Manage free access for: <span className="text-purple-400 font-semibold">{currentThread.title}</span>
            </p>
            <div className="mt-4 flex items-center gap-4 text-sm text-gray-400">
              <span>Price: <span className="text-white font-semibold">${currentThread.price?.toFixed(2)}</span></span>
              <span>|</span>
              <span>
                Sales: <span className="text-green-400 font-semibold">{salesLoading ? '--' : salesCount}</span>
              </span>
              <span>|</span>
              <span>Free Access: <span className="text-purple-400 font-semibold">
                {freeAccessCount}
              </span></span>
            </div>
          </div>
        </div>

        {/* Access Management Component */}
        <AccessManagement
          accessCodes={accessCodes}
          onGenerateCode={handleGenerateCode}
          isGenerating={isGenerating || codesLoading}
          errorMessage={codesError}
          isThreadActive={isThreadActive}
        />
      </div>
    </div>
  );
}

