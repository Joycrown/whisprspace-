/* eslint-disable @typescript-eslint/no-explicit-any */
// components/thread/ThreadList.tsx
'use client'

import { ArrowRight, Heart, MessageCircle, Star, Crown, X } from "lucide-react";
import { Thread } from "@/types";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { FaLock } from 'react-icons/fa'; // Import FaLock
import PaymentModal from "@/components/modals/PaymentModal";
import { useUserStore } from "@/store/userStore";
import { redeemThreadAccessCode } from "@/lib/threads/thread-service";
import { useJoinThreadMutation } from "@/lib/threads/hooks/useThreadMutations";
import { Loader2 } from "lucide-react";

type ThreadPreviewMessage = {
  id: string;
  content: string;
  createdAt: string;
  senderName: string;
};

type ThreadPreviewData = {
  id: string;
  title: string;
  content: string;
  category: string;
  type: string;
  privacy: string;
  isPremium: boolean;
  price: number | null;
  messageCount: number;
  participantCount: number;
  likes: number;
  expiresAt: string | null;
  messages: ThreadPreviewMessage[];
};

// Thread component with ratings and likes
export const ThreadList: React.FC<{ thread: Thread }> = ({ thread }) => {
  // Use thread.author.avatar if available, otherwise a default color or calculate from anonymousId
  const avatarColor = thread.author.avatar || `#${(thread.author.anonymousId.length * 100).toString(16).slice(0, 6)}`;
  const router = useRouter();
  const { session } = useUserStore();
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [hasAccess, setHasAccess] = useState(!!thread.hasJoined || !!thread.hasAccess);
  const [isJoining, setIsJoining] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewData, setPreviewData] = useState<ThreadPreviewData | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const joinMutation = useJoinThreadMutation();

  // Check if current user is the thread creator
  const isCreator = session?.user?.id === thread.author.id;
  const isThreadBlocked = thread.isLocked === true;
  const canAccessPremium = !thread.isPremium || hasAccess || isCreator;

  useEffect(() => {
    if (thread.hasJoined) {
      setHasAccess(true);
    }
  }, [thread.hasJoined]);

  useEffect(() => {
    if (thread.hasAccess) {
      setHasAccess(true);
    }
  }, [thread.hasAccess]);

  const loadPreview = async () => {
    if (previewLoading || previewData) return;

    setPreviewLoading(true);
    setPreviewError(null);
    try {
      const response = await fetch(`/api/threads/${thread.id}/preview`, {
        method: 'GET',
        cache: 'no-store',
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok || !payload?.data) {
        throw new Error(payload?.error || 'Failed to load thread preview');
      }

      setPreviewData(payload.data as ThreadPreviewData);
    } catch (error) {
      setPreviewError(error instanceof Error ? error.message : 'Failed to load thread preview');
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleCardClick = () => {
    setShowPreviewModal(true);
    void loadPreview();
  };

  const handleCardKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleCardClick();
    }
  };

  const handlePaymentSuccess = () => {
    setHasAccess(true);
    setShowPaymentModal(false);
    // Navigate to thread after successful payment
    router.push(`/threads/${thread.id}`);
  };

  const handleValidateCode = async (code: string): Promise<boolean> => {
    if (!session?.user?.id) {
      router.push('/auth');
      return false;
    }
    const result = await redeemThreadAccessCode(thread.id, code);
    return result.success;
  };

  const joinThreadNow = async () => {
    if (isThreadBlocked) {
      return;
    }

    if (!session?.user?.id) {
      router.push('/auth');
      return;
    }

    // If already the creator, just navigate
    if (isCreator) {
      router.push(`/threads/${thread.id}`);
      return;
    }

    try {
      setIsJoining(true);
      await joinMutation.mutateAsync({
        threadId: thread.id,
        userId: session.user.id
      });
      router.push(`/threads/${thread.id}`);
    } catch {
      // If it fails (e.g. RLS or other issue), still try to navigate
      // The thread page will handle access control
      router.push(`/threads/${thread.id}`);
    } finally {
      setIsJoining(false);
    }
  };

  const handleJoinClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    await joinThreadNow();
  };

  const handleUnlockClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setShowPaymentModal(true);
  };

  const handlePreviewPrimaryAction = async () => {
    if (isThreadBlocked) {
      return;
    }

    if (thread.isPremium && !canAccessPremium) {
      setShowPreviewModal(false);
      setShowPaymentModal(true);
      return;
    }

    setShowPreviewModal(false);
    await joinThreadNow();
  };

  const preview = previewData || {
    id: thread.id,
    title: thread.title,
    content: thread.content,
    category: thread.category,
    type: thread.type,
    privacy: thread.privacy,
    isPremium: thread.isPremium,
    price: thread.price ?? null,
    messageCount: thread.messageCount || 0,
    participantCount: thread.participantCount || 0,
    likes: thread.likes || 0,
    expiresAt: thread.expiresAt || null,
    messages: [] as ThreadPreviewMessage[],
  };

  return (
    <>
      <div
        className={`p-3 md:p-4 transition-colors w-full max-w-full overflow-hidden cursor-pointer ${thread.isPremium
        ? 'bg-gradient-to-br from-purple-900/30 to-orange-900/30 border-l-2 border-purple-500/50 hover:bg-gradient-to-br hover:from-purple-900/40 hover:to-orange-900/40 active:from-purple-900/50 active:to-orange-900/50'
        : 'hover:bg-gray-900/50 active:bg-gray-900/70'
        }`}
        role="button"
        tabIndex={0}
        onClick={handleCardClick}
        onKeyDown={handleCardKeyDown}
        aria-label={`Preview thread ${thread.title}`}
      >
        <div className="flex items-start gap-2 md:gap-3 w-full max-w-full">
          {thread.author.avatar?.startsWith('/avatars/') ? (
            <img
              src={thread.author.avatar}
              alt={thread.author.anonymousId}
              className="w-8 h-8 md:w-10 md:h-10 rounded-full object-cover flex-shrink-0"
            />
          ) : (
            <div
              className="w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center text-white text-sm md:text-base font-medium flex-shrink-0"
              style={{ backgroundColor: avatarColor }}
            >
              {thread.author.anonymousId.charAt(0)}
            </div>
          )}
          <div className="flex-1 min-w-0 w-full">
            <div className="flex justify-between items-start gap-2 w-full">
              <div className="flex-1 min-w-0">
                <h3 className="text-sm md:text-base text-white font-medium flex items-center gap-1.5 md:gap-2 flex-wrap w-full">
                  <span className="truncate max-w-full">{thread.title}</span>
                  {thread.isPremium && (
                    <div className="flex items-center gap-0.5 md:gap-1 px-1.5 md:px-2 py-0.5 bg-gradient-to-r from-purple-600 to-orange-500 rounded-full flex-shrink-0">
                      <Crown className="w-2.5 h-2.5 md:w-3 md:h-3 text-white" />
                      <span className="text-[10px] md:text-xs text-white font-semibold">Premium</span>
                    </div>
                  )}
                  {(thread.privacy === 'private' || thread.privacy === 'invite_only') && (
                    <FaLock className="w-3 h-3 md:w-4 md:h-4 text-gray-400 flex-shrink-0" title="Private Thread" />
                  )}
                </h3>



                <p className="text-gray-400 text-xs md:text-sm mt-1 line-clamp-2 break-words">{thread.content.substring(0, 100)}...</p>
              </div>
              <span className="text-gray-500 text-[10px] md:text-sm whitespace-nowrap flex-shrink-0 ml-2">{thread.timeRemaining}</span>

            </div>

            {/* Metrics row */}
            <div className="flex justify-between mt-2 md:mt-3 text-xs md:text-sm gap-2 w-full">
              <div className="flex-1 min-w-0">

                <div className="flex items-center gap-2 md:gap-4 flex-wrap overflow-hidden">
                  <div className="flex items-center gap-0.5 md:gap-1 text-gray-400">
                    <MessageCircle className="w-3.5 h-3.5 md:w-4 md:h-4" />
                    <span>{thread.messageCount}</span>
                  </div>
                  <div className="flex items-center gap-0.5 md:gap-1 text-gray-400">
                    <Heart className="w-3.5 h-3.5 md:w-4 md:h-4 text-red-500" />
                    <span>{thread.likes}</span>
                  </div>
                  <div className="hidden sm:flex items-center gap-0.5 md:gap-1 text-gray-400">
                    <Star className="w-3.5 h-3.5 md:w-4 md:h-4 text-yellow-500" />
                    <span>{thread.rating?.toFixed(1) || '0.0'} ({thread.ratingCount || 0})</span>
                  </div>
                  <div className="hidden md:flex items-center gap-1 text-gray-400">
                    <span>{thread.participantCount || 0} participants</span>
                  </div>
                  {thread.isPremium && thread.price && (
                    <div className="flex items-center gap-1 text-purple-400 font-semibold">
                      <span>- ${thread.price.toFixed(2)}</span>
                    </div>
                  )}
                </div>
                {thread.author && (
                  <div>
                    <p className="text-purple-400 text-[10px] md:text-sm mt-1 flex items-center gap-1">
                      <span>by {thread.author.name || thread.author.anonymousId}</span>
                      {thread.author.isPremium && (
                        <Crown className="w-3 h-3 text-yellow-400" />
                      )}
                    </p>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {/* Join/Unlock button */}
                {isThreadBlocked ? (
                  <button
                    disabled
                    className="inline-flex items-center gap-1 px-2.5 md:px-3 py-1.5 md:py-2 rounded-full text-white text-xs md:text-sm font-medium bg-gray-700/70 cursor-not-allowed min-h-[36px]"
                  >
                    <span className="hidden sm:inline">Blocked</span>
                    <ArrowRight className="w-3.5 h-3.5 md:w-4 md:h-4" />
                  </button>
                ) : thread.isPremium && !canAccessPremium ? (
                  <button
                    onClick={handleUnlockClick}
                    className="inline-flex items-center gap-1 px-2.5 md:px-3 py-1.5 md:py-2 rounded-full transition-all text-white text-xs md:text-sm font-medium bg-gradient-to-r from-purple-600 to-orange-500 hover:opacity-90 active:scale-95 min-h-[36px]"
                  >
                    <span className="hidden sm:inline">Unlock</span>
                    <ArrowRight className="w-3.5 h-3.5 md:w-4 md:h-4" />
                  </button>
                ) : (
                  <button
                    onClick={handleJoinClick}
                    disabled={isJoining}
                    className={`inline-flex items-center gap-1 px-2.5 md:px-3 py-1.5 md:py-2 rounded-full transition-all text-white text-xs md:text-sm font-medium min-h-[36px] disabled:opacity-70 ${thread.isPremium
                      ? 'bg-gradient-to-r from-purple-600 to-orange-500 hover:opacity-90 active:scale-95'
                      : 'bg-purple-600 hover:bg-purple-700 active:bg-purple-800'
                      }`}
                  >
                    {isJoining ? (
                      <Loader2 className="w-3.5 h-3.5 md:w-4 md:h-4 animate-spin" />
                    ) : (
                      <>
                        <span className="hidden sm:inline">{isCreator && thread.isPremium ? 'View' : 'Join'}</span>
                        <ArrowRight className="w-3.5 h-3.5 md:w-4 md:h-4" />
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Payment Modal */}
      {thread.isPremium && (
        <PaymentModal
          isOpen={showPaymentModal}
          onClose={() => setShowPaymentModal(false)}
          threadId={thread.id}
          threadTitle={thread.title}
          price={thread.price || 0}
          creatorId={thread.author.id}
          onSuccess={handlePaymentSuccess}
          onValidateCode={handleValidateCode}
        />
      )}

      {showPreviewModal && (
        <div
          className="fixed inset-0 z-[1200] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 modal-safe-overlay"
          onClick={() => setShowPreviewModal(false)}
        >
          <div
            className="w-full max-w-2xl rounded-2xl border border-gray-700 bg-[#151515] text-white shadow-2xl modal-safe-panel overflow-y-auto max-h-[calc(var(--app-viewport-height)-2rem)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b border-gray-800 px-5 py-4">
              <div className="min-w-0">
                <p className="text-xs uppercase tracking-wider text-gray-400">{preview.category}</p>
                <h3 className="mt-1 text-lg md:text-xl font-semibold text-white break-words">{preview.title}</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowPreviewModal(false)}
                className="rounded-md p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
                aria-label="Close preview"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="px-5 py-4 space-y-4">
              {previewLoading ? (
                <div className="py-8 text-center text-sm text-gray-300">Loading preview...</div>
              ) : previewError ? (
                <div className="rounded-lg border border-red-800 bg-red-950/30 px-4 py-3 text-sm text-red-200">
                  {previewError}
                </div>
              ) : (
                <>
                  <p className="text-sm text-gray-200 whitespace-pre-wrap break-words">{preview.content}</p>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    <div className="rounded-lg border border-gray-800 bg-gray-900/60 px-3 py-2">
                      <p className="text-[11px] uppercase text-gray-400">Messages</p>
                      <p className="text-sm font-semibold">{preview.messageCount}</p>
                    </div>
                    <div className="rounded-lg border border-gray-800 bg-gray-900/60 px-3 py-2">
                      <p className="text-[11px] uppercase text-gray-400">Participants</p>
                      <p className="text-sm font-semibold">{preview.participantCount}</p>
                    </div>
                    <div className="rounded-lg border border-gray-800 bg-gray-900/60 px-3 py-2">
                      <p className="text-[11px] uppercase text-gray-400">Likes</p>
                      <p className="text-sm font-semibold">{preview.likes}</p>
                    </div>
                    <div className="rounded-lg border border-gray-800 bg-gray-900/60 px-3 py-2">
                      <p className="text-[11px] uppercase text-gray-400">Type</p>
                      <p className="text-sm font-semibold">
                        {preview.isPremium ? `Premium${preview.price ? ` $${preview.price.toFixed(2)}` : ''}` : 'Standard'}
                      </p>
                    </div>
                  </div>

                  <div>
                    <h4 className="text-sm font-semibold text-gray-100 mb-2">Message Preview</h4>
                    {isThreadBlocked && (
                      <p className="mb-2 text-xs text-red-300">
                        This thread is blocked due to community reports.
                      </p>
                    )}
                    {preview.messages.length === 0 ? (
                      <p className="text-xs text-gray-400">No messages available yet.</p>
                    ) : (
                      <div className="space-y-2">
                        {preview.messages.map((message) => (
                          <div key={message.id} className="rounded-lg border border-gray-800 bg-gray-900/50 px-3 py-2">
                            <p className="text-[11px] text-gray-400">{message.senderName}</p>
                            <p className="text-sm text-gray-200 break-words">{message.content}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-gray-800 px-5 py-4">
              <button
                type="button"
                onClick={() => setShowPreviewModal(false)}
                className="rounded-lg border border-gray-700 px-3 py-2 text-sm text-gray-200 hover:bg-gray-800/70 transition-colors"
              >
                Close
              </button>
              <button
                type="button"
                onClick={handlePreviewPrimaryAction}
                disabled={isJoining || isThreadBlocked}
                className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-purple-600 to-orange-500 px-4 py-2 text-sm font-semibold text-white hover:opacity-95 transition-opacity disabled:opacity-70"
              >
                {isJoining ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : null}
                {isThreadBlocked
                  ? 'Thread Blocked'
                  : (thread.isPremium && !canAccessPremium ? 'Unlock & Join' : 'Join Thread')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

