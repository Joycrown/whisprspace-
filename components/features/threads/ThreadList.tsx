/* eslint-disable @typescript-eslint/no-explicit-any */
// components/thread/ThreadList.tsx
'use client'

import { ArrowRight, Heart, MessageCircle, Star, Crown } from "lucide-react";
import { Thread } from "@/types";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { FaLock } from 'react-icons/fa'; // Import FaLock
import PaymentModal from "@/components/modals/PaymentModal";
import { useUserStore } from "@/store/userStore";
import { validateAccessCode } from "@/utils/accessCodeUtils";
import { useJoinThreadMutation } from "@/lib/threads/hooks/useThreadMutations";
import { Loader2 } from "lucide-react";

// Thread component with ratings and likes
export const ThreadList: React.FC<{ thread: Thread }> = ({ thread }) => {
  // Use thread.author.avatar if available, otherwise a default color or calculate from anonymousId
  const avatarColor = thread.author.avatar || `#${(thread.author.anonymousId.length * 100).toString(16).slice(0, 6)}`;
  const router = useRouter();
  const { session } = useUserStore();
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [hasAccess, setHasAccess] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const joinMutation = useJoinThreadMutation();

  // Check if current user is the thread creator
  const isCreator = session?.user?.id === thread.author.id;
  const canAccessPremium = !thread.isPremium || hasAccess || isCreator;

  const handleThreadClick = (e: React.MouseEvent) => {
    if (thread.isPremium && !canAccessPremium) {
      e.preventDefault();
      setShowPaymentModal(true);
    }
  };

  const handlePaymentSuccess = () => {
    setHasAccess(true);
    setShowPaymentModal(false);
    // Navigate to thread after successful payment
    router.push(`/threads/${thread.id}`);
  };

  const handleValidateCode = async (code: string): Promise<boolean> => {
    // Validate the access code against thread's access codes
    if (!thread.accessCodes || thread.accessCodes.length === 0) {
      return false;
    }

    const validation = validateAccessCode(code, thread.accessCodes);
    return validation.valid;
  };

  const handleJoinClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

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
    } catch (error) {
      // If it fails (e.g. RLS or other issue), still try to navigate
      // The thread page will handle access control
      router.push(`/threads/${thread.id}`);
    } finally {
      setIsJoining(false);
    }
  };

  return (
    <>
      <div className={`p-3 md:p-4 transition-colors w-full max-w-full overflow-hidden ${thread.isPremium
        ? 'bg-gradient-to-br from-purple-900/30 to-orange-900/30 border-l-2 border-purple-500/50 hover:bg-gradient-to-br hover:from-purple-900/40 hover:to-orange-900/40 active:from-purple-900/50 active:to-orange-900/50'
        : 'hover:bg-gray-900/50 active:bg-gray-900/70'
        }`}>
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
                      <span>• ${thread.price.toFixed(2)}</span>
                    </div>
                  )}
                </div>
                {thread.author && (
                  <div>
                    <p className="text-purple-400 text-[10px] md:text-sm mt-1">
                      by {thread.author.name || thread.author.anonymousId}
                    </p>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {/* Join/Unlock button */}
                {thread.isPremium && !canAccessPremium ? (
                  <button
                    onClick={handleThreadClick}
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
    </>
  );
};

