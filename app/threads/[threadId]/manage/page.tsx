'use client'

import { use } from 'react';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { ArrowLeft } from 'lucide-react';
import AccessManagement from '@/components/features/premium/AccessManagement';
import { useThreadStore } from '@/store/threadStore';
import { useUserStore } from '@/store/userStore';
import { createAccessCode, generateSecretToken } from '@/utils/accessCodeUtils';
import { AccessCode } from '@/types';

interface PageProps {
  params: Promise<{
    threadId: string;
  }>;
}

export default function ThreadManagePage({ params }: PageProps) {
  const resolvedParams = use(params);
  const { threadId } = resolvedParams;
  const router = useRouter();
  const { currentThread, fetchThreadById, updateThread } = useThreadStore();
  const { session } = useUserStore();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadThread = async () => {
      setIsLoading(true);
      await fetchThreadById(threadId);
      setIsLoading(false);
    };
    loadThread();
  }, [threadId, fetchThreadById]);

  // Check if user is the creator
  const isCreator = session?.user?.id === currentThread?.author.id;

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

  const handleGenerateCode = (maxUses: number, expiryDays?: number) => {
    const newCode = createAccessCode(maxUses, expiryDays);
    const updatedCodes = [...(currentThread.accessCodes || []), newCode];

    updateThread(threadId, {
      accessCodes: updatedCodes,
    });
  };

  const handleDeleteCode = (code: string) => {
    const updatedCodes = (currentThread.accessCodes || []).filter((ac:any) => ac.code !== code);

    updateThread(threadId, {
      accessCodes: updatedCodes,
    });
  };

  const handleRegenerateSecretLink = () => {
    const newToken = generateSecretToken();

    updateThread(threadId, {
      secretToken: newToken,
    });
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
              <span>•</span>
              <span>Sales: <span className="text-green-400 font-semibold">0</span></span>
              <span>•</span>
              <span>Free Access: <span className="text-purple-400 font-semibold">
                {currentThread.freeAccessUsers?.length || 0}
              </span></span>
            </div>
          </div>
        </div>

        {/* Access Management Component */}
        <AccessManagement
          threadId={threadId}
          threadTitle={currentThread.title}
          accessCodes={currentThread.accessCodes || []}
          secretToken={currentThread.secretToken || generateSecretToken()}
          onGenerateCode={handleGenerateCode}
          onDeleteCode={handleDeleteCode}
          onRegenerateSecretLink={handleRegenerateSecretLink}
        />
      </div>
    </div>
  );
}
