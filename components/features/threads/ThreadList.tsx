/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import { ArrowRight, Heart, MessageCircle, Crown, X } from "lucide-react";
import { Thread } from "@/types";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { FaLock } from 'react-icons/fa';
import PaymentModal from "@/components/modals/PaymentModal";
import { useUserStore } from "@/store/userStore";
import { redeemThreadAccessCode } from "@/lib/threads/thread-service";
import { getThreadAvatarSeed } from "@/lib/threads/display-identity";
import { useJoinThreadMutation } from "@/lib/threads/hooks/useThreadMutations";
import { Loader2 } from "lucide-react";
import { buildThreadPath } from "@/lib/threads/thread-url";

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

// Deterministic identicon — no human photos
function Identicon({ seed, size = 36 }: { seed: string; size?: number }) {
  const char = (seed || '?').charAt(0).toUpperCase();
  const code = seed.charCodeAt(0) || 63;
  const hue = (code * 47) % 360;
  const hue2 = (hue + 55) % 360;
  return (
    <div
      className="flex-shrink-0 flex items-center justify-center font-semibold select-none rounded-[22%]"
      style={{
        width: size,
        height: size,
        background: `linear-gradient(135deg, hsl(${hue},65%,42%), hsl(${hue2},65%,52%))`,
        fontSize: size * 0.38,
        color: 'rgba(255,255,255,0.92)',
      }}
    >
      {char}
    </div>
  );
}

export const ThreadList: React.FC<{ thread: Thread }> = ({ thread }) => {
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
  const threadPath = buildThreadPath({ id: thread.id, title: thread.title });

  const isCreator = session?.user?.id === thread.author.id;
  const isThreadBlocked = thread.isLocked === true;
  const canAccessPremium = !thread.isPremium || hasAccess || isCreator;

  useEffect(() => {
    if (thread.hasJoined) setHasAccess(true);
  }, [thread.hasJoined]);

  useEffect(() => {
    if (thread.hasAccess) setHasAccess(true);
  }, [thread.hasAccess]);

  const loadPreview = async () => {
    if (previewLoading || previewData) return;
    setPreviewLoading(true);
    setPreviewError(null);
    try {
      const response = await fetch(`/api/threads/${thread.id}/preview`, { method: 'GET', cache: 'no-store' });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.data) throw new Error(payload?.error || 'Failed to load thread preview');
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
    router.push(threadPath);
  };

  const handleValidateCode = async (code: string): Promise<boolean> => {
    if (!session?.user?.id) { router.push('/auth'); return false; }
    const result = await redeemThreadAccessCode(thread.id, code);
    return result.success;
  };

  const joinThreadNow = async () => {
    if (isThreadBlocked) return;
    if (!session?.user?.id) { router.push('/auth'); return; }
    if (isCreator) { router.push(threadPath); return; }
    try {
      setIsJoining(true);
      await joinMutation.mutateAsync({ threadId: thread.id, userId: session.user.id });
      router.push(threadPath);
    } catch {
      router.push(threadPath);
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
    if (isThreadBlocked) return;
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

  const authorSeed = getThreadAvatarSeed(thread.author?.id, thread.id);

  return (
    <>
      {/* ── Card ── */}
      <div
        className={`px-3 md:px-4 py-3 md:py-4 transition-colors w-full cursor-pointer ${
          thread.isPremium
            ? 'bg-[#15101E] hover:bg-[#1A1228] border-l-2 border-[#8B5CF6]/40'
            : 'hover:bg-white/[0.025]'
        }`}
        role="button"
        tabIndex={0}
        onClick={handleCardClick}
        onKeyDown={handleCardKeyDown}
        aria-label={`Preview thread ${thread.title}`}
      >
        <div className="flex items-start gap-2.5 md:gap-3 w-full">
          <Identicon seed={authorSeed} size={36} />

          <div className="flex-1 min-w-0">
            {/* Title row */}
            <div className="flex justify-between items-start gap-2 w-full">
              <div className="flex-1 min-w-0">
                <h3 className="text-sm md:text-base text-[#F2F2F6] font-medium flex items-center gap-1.5 flex-wrap">
                  <span className="truncate max-w-full">{thread.title}</span>
                  {thread.isPremium && (
                    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full border border-[#8B5CF6]/40 text-[10px] text-[#C4B5FD] flex-shrink-0">
                      <Crown className="w-2.5 h-2.5" />
                      Premium
                    </span>
                  )}
                  {(thread.privacy === 'private' || thread.privacy === 'invite_only') && (
                    <FaLock className="w-3 h-3 text-[#5C5C6E] flex-shrink-0" title="Private thread" />
                  )}
                </h3>
                <p className="text-[#5C5C6E] text-xs md:text-sm mt-0.5 line-clamp-2 break-words">
                  {thread.content.substring(0, 100)}…
                </p>
              </div>
              <span className="text-[#5C5C6E] text-[10px] md:text-xs whitespace-nowrap flex-shrink-0 ml-2">
                {thread.timeRemaining}
              </span>
            </div>

            {/* Metrics + action row */}
            <div className="flex justify-between items-center mt-2 md:mt-3 gap-2 w-full">
              <div className="flex items-center gap-3 text-xs text-[#8F8FA3] flex-wrap">
                <span className="flex items-center gap-1">
                  <MessageCircle className="w-3.5 h-3.5" />
                  {thread.messageCount}
                </span>
                <span className="flex items-center gap-1">
                  <Heart className="w-3.5 h-3.5 text-[#E24B4A]" />
                  {thread.likes}
                </span>
                {thread.isPremium && thread.price ? (
                  <span className="text-[#C4B5FD] font-medium">${thread.price.toFixed(2)}</span>
                ) : null}
              </div>

              <div className="flex-shrink-0">
                {isThreadBlocked ? (
                  <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs text-[#5C5C6E] bg-white/[0.03] border border-[#2A2A38] cursor-not-allowed">
                    Blocked
                  </span>
                ) : thread.isPremium && !canAccessPremium ? (
                  <button
                    onClick={handleUnlockClick}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs text-white font-medium active:scale-95 transition-all"
                    style={{ background: 'linear-gradient(100deg, #8B5CF6, #F97316)' }}
                  >
                    Unlock <ArrowRight className="w-3 h-3" />
                  </button>
                ) : (
                  <button
                    onClick={handleJoinClick}
                    disabled={isJoining}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs text-[#F2F2F6] bg-white/[0.06] border border-[#2A2A38] hover:border-[#8B5CF6]/50 active:scale-95 transition-all disabled:opacity-50"
                  >
                    {isJoining ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <>{isCreator || thread.hasJoined ? 'Open' : 'Join'} <ArrowRight className="w-3 h-3" /></>
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Payment modal ── */}
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

      {/* ── Preview sheet ── */}
      {showPreviewModal && (
        <div
          className="fixed inset-0 z-[1200] bg-black/60 flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={() => setShowPreviewModal(false)}
        >
          <div
            className="w-full sm:max-w-2xl rounded-t-2xl sm:rounded-2xl border border-[#23232E] bg-[#12121A] text-[#F2F2F6] overflow-y-auto max-h-[85dvh] sm:max-h-[calc(100dvh-2rem)]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-3 border-b border-[#23232E] px-5 py-4">
              <div className="min-w-0">
                <p className="text-[11px] uppercase tracking-wider text-[#5C5C6E]">{preview.category}</p>
                <h3 className="mt-1 text-base md:text-lg font-medium text-[#F2F2F6] break-words">{preview.title}</h3>
              </div>
              <button
                onClick={() => setShowPreviewModal(false)}
                className="rounded-lg p-1.5 text-[#5C5C6E] hover:text-[#F2F2F6] hover:bg-white/[0.05] transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="px-5 py-4 space-y-4">
              {previewLoading ? (
                <div className="py-8 text-center text-sm text-[#8F8FA3]">Loading preview…</div>
              ) : previewError ? (
                <div className="rounded-xl border border-[#E24B4A]/30 bg-[#E24B4A]/[0.07] px-4 py-3 text-sm text-[#F2F2F6]">
                  {previewError}
                </div>
              ) : (
                <>
                  <p className="text-sm text-[#8F8FA3] whitespace-pre-wrap break-words">{preview.content}</p>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {[
                      { label: 'Messages', value: preview.messageCount },
                      { label: 'Participants', value: preview.participantCount },
                      { label: 'Likes', value: preview.likes },
                      { label: 'Type', value: preview.isPremium ? `Premium${preview.price ? ` $${preview.price.toFixed(2)}` : ''}` : 'Free' },
                    ].map(({ label, value }) => (
                      <div key={label} className="rounded-xl border border-[#23232E] bg-white/[0.02] px-3 py-2">
                        <p className="text-[11px] uppercase tracking-wide text-[#5C5C6E]">{label}</p>
                        <p className="text-sm font-medium text-[#F2F2F6]">{value}</p>
                      </div>
                    ))}
                  </div>

                  <div>
                    <h4 className="text-xs uppercase tracking-wide text-[#5C5C6E] mb-2">Message preview</h4>
                    {isThreadBlocked && (
                      <p className="mb-2 text-xs text-[#E24B4A]">This thread is blocked due to community reports.</p>
                    )}
                    {preview.messages.length === 0 ? (
                      <p className="text-xs text-[#5C5C6E]">No messages yet.</p>
                    ) : (
                      <div className="space-y-2">
                        {preview.messages.map((msg) => (
                          <div key={msg.id} className="rounded-xl border border-[#23232E] bg-white/[0.02] px-3 py-2">
                            {msg.senderName && (
                              <p className="text-[11px] text-[#5C5C6E]">{msg.senderName}</p>
                            )}
                            <p className="text-sm text-[#8F8FA3] break-words">{msg.content}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-2 border-t border-[#23232E] px-5 py-4">
              <button
                onClick={() => setShowPreviewModal(false)}
                className="rounded-xl border border-[#2A2A38] px-4 py-2 text-sm text-[#8F8FA3] hover:text-[#F2F2F6] hover:bg-white/[0.04] transition-colors"
              >
                Close
              </button>
              <button
                onClick={handlePreviewPrimaryAction}
                disabled={isJoining || isThreadBlocked}
                className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium text-white disabled:opacity-50 transition-opacity active:scale-[0.97]"
                style={{ background: 'linear-gradient(100deg, #8B5CF6, #F97316)' }}
              >
                {isJoining && <Loader2 className="w-4 h-4 animate-spin" />}
                {isThreadBlocked
                  ? 'Thread blocked'
                  : thread.isPremium && !canAccessPremium
                    ? 'Unlock & join'
                    : isCreator || thread.hasJoined
                      ? 'Open thread'
                      : 'Join thread'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
