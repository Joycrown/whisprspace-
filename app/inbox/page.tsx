'use client'

import { Suspense, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { MessageCircle, Mail, MailOpen, Lock, Zap } from 'lucide-react';
import { FaShareAlt, FaCheck } from 'react-icons/fa';
import { useConversationsQuery, Conversation, DirectMessage, markConversationReadWithReceipts } from '@/lib/messaging';
import { useUserStore } from '@/store/userStore';
import AppLoadingState from '@/components/ui/AppLoadingState';
import MessageModal from '@/components/features/inbox/MessageModal';
import { ShareDropdown } from '@/components/features/inbox/ShareDropdown';
import UserShareCard from '@/components/features/inbox/UserShareCard';
import { useInboxShare } from '@/lib/hooks/useInboxShare';

type TabType = 'all' | 'unread';

const getConversationTimestamp = (conversation: Conversation) => {
  return (
    conversation.lastMessage?.createdAt ||
    conversation.lastMessageAt ||
    conversation.updatedAt ||
    conversation.createdAt
  );
};

const getConversationSortTime = (conversation: Conversation) => {
  const timestamp = getConversationTimestamp(conversation);
  const time = new Date(timestamp).getTime();
  return Number.isNaN(time) ? 0 : time;
};

function InboxPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { session, sessionValidated } = useUserStore();
  // Guests can hold an inbox link but not read messages — don't fetch conversations
  // for them (nothing to show, and it avoids needless queries).
  const isGuest = session.user?.isAnonymous ?? false;
  const isSessionReady = Boolean(sessionValidated && session.user && !isGuest);

  // Use React Query hooks for data fetching
  const {
    conversations,
    isLoading,
    refetch: refetchConversations,
  } = useConversationsQuery({
    enableRealtime: true,
    queryOptions: {
      enabled: isSessionReady,
    },
  });

  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [directPage, setDirectPage] = useState(1);
  const [oneOffPage, setOneOffPage] = useState(1);

  // Shared share logic — same hook/components as the threads-page nudge, so the
  // download card and production card link come for free and stay in sync.
  const {
    link: myProfileLink,
    cardLink,
    handle: messageHandle,
    copied: copiedLink,
    showDropdown: showShareDropdown,
    dropdownPos: dropdownPosition,
    shareCardRef,
    isGeneratingCard,
    copyLink,
    openDropdown,
    closeDropdown,
    shareOnTwitter,
    shareOnFacebook,
    shareOnWhatsApp,
    shareOnLinkedIn,
    shareOnInstagram,
    shareViaEmail,
    downloadShareCard,
  } = useInboxShare();

  const shareButtonRef = useRef<HTMLButtonElement>(null);
  const displayName = session?.user?.username || session?.user?.anonymousId || messageHandle;

  const PAGE_SIZE = 6;

  // State for One-time Message Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMessage, setModalMessage] = useState<DirectMessage | null>(null);
  const [resolvedConversationLinkId, setResolvedConversationLinkId] = useState<string | null>(null);

  const linkedConversationId =
    searchParams.get('conversationId') ||
    searchParams.get('conversation_id') ||
    null;

  const handleShareButtonClick = () => {
    if (shareButtonRef.current) {
      openDropdown(shareButtonRef.current.getBoundingClientRect());
    }
  };

  const filteredConversations = useMemo(() => {
    const scoped = conversations.filter((conv) => {
      if (activeTab === 'unread') return (conv.unreadCount || 0) > 0;
      return true;
    });

    return [...scoped].sort(
      (a, b) => getConversationSortTime(b) - getConversationSortTime(a)
    );
  }, [activeTab, conversations]);
  const unreadCount = conversations.reduce((count, conversation) => {
    return count + (conversation.unreadCount || 0)
  }, 0);

  const directConversations = filteredConversations.filter(conv => conv.type !== 'one_time');
  const oneOffConversations = filteredConversations.filter(conv => conv.type === 'one_time');

  useEffect(() => {
    setDirectPage(1);
    setOneOffPage(1);
  }, [activeTab]);

  useEffect(() => {
    const maxDirectPage = Math.max(1, Math.ceil(directConversations.length / PAGE_SIZE));
    const maxOneOffPage = Math.max(1, Math.ceil(oneOffConversations.length / PAGE_SIZE));
    setDirectPage((prev) => Math.min(prev, maxDirectPage));
    setOneOffPage((prev) => Math.min(prev, maxOneOffPage));
  }, [directConversations.length, oneOffConversations.length]);

  const visibleDirect = directConversations.slice(0, directPage * PAGE_SIZE);
  const visibleOneOff = oneOffConversations.slice(0, oneOffPage * PAGE_SIZE);
  const hasMoreDirect = visibleDirect.length < directConversations.length;
  const hasMoreOneOff = visibleOneOff.length < oneOffConversations.length;

  const openOneOffConversation = useCallback((conversation: Conversation) => {
    setSelectedConversation(conversation);
    if (conversation.lastMessage) {
      setModalMessage(conversation.lastMessage);
      setIsModalOpen(true);
    } else {
      setModalMessage(null);
      setIsModalOpen(false);
    }

    markConversationReadWithReceipts(conversation.id).then(() => {
      refetchConversations();
    });
  }, [refetchConversations]);

  const handleConversationClick = (conversation: Conversation) => {
    // If one-time message, open modal
    if (conversation.type === 'one_time') {
      openOneOffConversation(conversation);
      return;
    }

    // Otherwise navigate to conversation page
    router.push(`/inbox/${conversation.id}`);
  };
  
  useEffect(() => {
    if (!sessionValidated || session.user) return;
    router.replace(`/auth?redirect=${encodeURIComponent('/inbox')}`);
  }, [sessionValidated, session.user, router]);

  useEffect(() => {
    if (!isSessionReady) return;
    if (!linkedConversationId) {
      setResolvedConversationLinkId(null);
      return;
    }

    if (isLoading || resolvedConversationLinkId === linkedConversationId) {
      return;
    }

    const targetConversation = conversations.find(
      (conversation) => conversation.id === linkedConversationId
    );
    setResolvedConversationLinkId(linkedConversationId);

    if (!targetConversation) {
      router.replace(`/inbox/${linkedConversationId}`);
      return;
    }

    if (targetConversation.type === 'one_time') {
      openOneOffConversation(targetConversation);
      router.replace('/inbox');
      return;
    }

    router.replace(`/inbox/${targetConversation.id}`);
  }, [
    linkedConversationId,
    isLoading,
    resolvedConversationLinkId,
    conversations,
    router,
    openOneOffConversation,
    isSessionReady,
  ]);

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setModalMessage(null);
    setSelectedConversation(null);
  };



  const formatTimestamp = (timestamp?: string) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    if (Number.isNaN(date.getTime())) return '';
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);

    if (hours < 1) return 'Just now';
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const getOtherParticipant = (conversation: Conversation) => {
    if (!conversation.participants || !session.user) return null;
    return conversation.participants.find(p => p.userId !== session?.user?.id);
  };

  if (!sessionValidated) {
    return <AppLoadingState title="Syncing your conversations..." />;
  }

  if (!session.user) {
    return <AppLoadingState title="Taking you to sign in..." />;
  }

  if (!isGuest && isLoading && conversations.length === 0) {
    return <AppLoadingState title="Syncing your conversations..." />;
  }

  return (
    <div className="min-h-screen py-4 pb-28 md:py-8">
      <div className="max-w-6xl mx-auto px-4">
        {/* Header */}
        <div className="mb-6 md:mb-8">
          <h1 className="text-2xl md:text-4xl font-bold text-white mb-1 md:mb-2">Messages</h1>
          <p className="text-sm md:text-base text-gray-400">Your anonymous messages and conversations</p>
        </div>

        {/* Profile Link Section */}
        <div className="bg-gradient-to-r from-purple-900/20 to-orange-900/20 border border-purple-500/30 rounded-xl p-4 md:p-6 mb-6 md:mb-8">
          <div className="flex items-start gap-3 md:gap-4 mb-3 md:mb-4">
            <Lock className="w-5 h-5 md:w-6 md:h-6 text-purple-400 flex-shrink-0 mt-1" />
            <div>
              <h2 className="text-lg md:text-xl font-semibold text-white mb-1 md:mb-2">Your Message Link</h2>
              <p className="text-gray-300 text-xs md:text-sm">
                ✨ Dare them to be honest. Share your link and let the anonymous messages roll in — one-off confessions or full-blown convos. No names. No filters. Just vibes.
              </p>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              value={myProfileLink}
              readOnly
              className="flex-1 px-3 md:px-4 py-2.5 md:py-3 bg-gray-900/50 border border-gray-700 rounded-lg text-gray-300 text-xs md:text-sm font-mono"
            />
            <button
              ref={shareButtonRef}
              onClick={handleShareButtonClick}
              className="px-4 md:px-6 py-2.5 md:py-3 bg-purple-600 hover:bg-purple-700 active:scale-95 rounded-lg text-white font-semibold transition-all flex items-center justify-center gap-2 min-h-[44px]"
            >
              {copiedLink ? (
                <>
                  <FaCheck className="w-4 h-4" />
                  Copied!
                </>
              ) : (
                <>
                  <FaShareAlt className="w-4 h-4" />
                  Share
                </>
              )}
            </button>
          </div>
        </div>

        {/* Shared share dropdown — includes Download card + correct production link */}
        {showShareDropdown && (
          <ShareDropdown
            position={dropdownPosition}
            onClose={closeDropdown}
            onCopyLink={copyLink}
            onTwitter={shareOnTwitter}
            onFacebook={shareOnFacebook}
            onWhatsApp={shareOnWhatsApp}
            onLinkedIn={shareOnLinkedIn}
            onInstagram={shareOnInstagram}
            onEmail={shareViaEmail}
            onDownloadCard={downloadShareCard}
            isGeneratingCard={isGeneratingCard}
          />
        )}

        {/* Hidden off-screen card for html-to-image capture */}
        {messageHandle && (
          <div style={{ position: 'fixed', top: -9999, left: -9999, pointerEvents: 'none', zIndex: -1 }}>
            <UserShareCard ref={shareCardRef} displayName={displayName} handle={messageHandle} inboxUrl={cardLink} />
          </div>
        )}

        {/* Guest wall — link is shareable above, but reading messages requires sign-up.
            This is the conversion moment: they've already shared and messages may await. */}
        {isGuest ? (
          <div className="bg-gray-800/60 border border-purple-500/30 rounded-2xl p-8 md:p-12 text-center">
            <div className="text-4xl md:text-5xl mb-4">👀</div>
            <h3 className="text-lg md:text-2xl font-semibold text-white mb-2">
              Someone might already be talking about you.
            </h3>
            <p className="text-sm md:text-base text-gray-400 max-w-md mx-auto mb-2">
              Your link is already live. Claim your account to unlock your inbox and see what people really think — no names, all honesty.
            </p>
            <p className="text-xs md:text-sm text-purple-300/80 max-w-md mx-auto mb-6">
              It&apos;s still you — your same link and every message waiting for you carry right over. ✨
            </p>
            <Link
              href={`/auth?view=signup&reason=inbox&redirect=${encodeURIComponent('/inbox')}`}
              className="inline-flex items-center justify-center px-6 py-3 bg-gradient-to-r from-purple-600 to-orange-500 hover:opacity-90 rounded-lg text-white font-semibold transition-opacity shadow-lg"
            >
              Claim my inbox →
            </Link>
          </div>
        ) : (
        <>
        {/* Stats */}
        <div className="grid grid-cols-3 md:grid-cols-3 gap-3 md:gap-4 mb-6 md:mb-8">
          <div className="bg-gray-800 border border-gray-700 rounded-xl p-3 md:p-6">
            <div className="flex flex-col md:flex-row items-start md:items-center gap-2 md:gap-3">
              <div className="p-1.5 md:p-2 bg-purple-500/20 rounded-lg">
                <Mail className="w-4 h-4 md:w-5 md:h-5 text-purple-400" />
              </div>
              <div>
                <p className="text-gray-400 text-[10px] md:text-sm">Total</p>
                <p className="text-lg md:text-2xl font-bold text-white">{conversations.length}</p>
              </div>
            </div>
          </div>

          <div className="bg-gray-800 border border-gray-700 rounded-xl p-3 md:p-6">
            <div className="flex flex-col md:flex-row items-start md:items-center gap-2 md:gap-3">
              <div className="p-1.5 md:p-2 bg-orange-500/20 rounded-lg">
                <MailOpen className="w-4 h-4 md:w-5 md:h-5 text-orange-400" />
              </div>
              <div>
                <p className="text-gray-400 text-[10px] md:text-sm">Unread</p>
                <p className="text-lg md:text-2xl font-bold text-white">{unreadCount}</p>
              </div>
            </div>
          </div>

          <div className="bg-gray-800 border border-gray-700 rounded-xl p-3 md:p-6">
            <div className="flex flex-col md:flex-row items-start md:items-center gap-2 md:gap-3">
              <div className="p-1.5 md:p-2 bg-green-500/20 rounded-lg">
                <MessageCircle className="w-4 h-4 md:w-5 md:h-5 text-green-400" />
              </div>
              <div>
                <p className="text-gray-400 text-[10px] md:text-sm">Active</p>
                <p className="text-lg md:text-2xl font-bold text-white">{conversations.filter(c => (c.unreadCount || 0) > 0).length}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs - Horizontal scroll on mobile */}
        <div className="flex gap-1 md:gap-2 mb-6 border-b border-gray-800 overflow-x-auto scrollbar-hide">
          <button
            onClick={() => setActiveTab('all')}
            className={`px-3 md:px-6 py-2 md:py-3 font-semibold text-xs md:text-base transition-colors relative whitespace-nowrap flex-shrink-0 ${activeTab === 'all' ? 'text-white' : 'text-gray-500 hover:text-gray-300'
              }`}
          >
            All ({conversations.length})
            {activeTab === 'all' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-purple-600"></div>
            )}
          </button>
          <button
            onClick={() => setActiveTab('unread')}
            className={`px-3 md:px-6 py-2 md:py-3 font-semibold text-xs md:text-base transition-colors relative whitespace-nowrap flex-shrink-0 ${activeTab === 'unread' ? 'text-white' : 'text-gray-500 hover:text-gray-300'
              }`}
          >
            <span className="flex items-center gap-1.5">
              <span className="hidden sm:inline">Unread ({unreadCount})</span>
              <span className="sm:hidden">Unread ({unreadCount})</span>
              {unreadCount > 0 && (
                <span className="w-2 h-2 bg-orange-500 rounded-full animate-pulse"></span>
              )}
            </span>
            {activeTab === 'unread' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-purple-600"></div>
            )}
          </button>
        </div>

        {/* Conversations List */}
        <div className="space-y-6">
          {filteredConversations.length === 0 ? (
            <div className="bg-gray-800 border border-gray-700 rounded-xl p-8 md:p-12 text-center">
              <MessageCircle className="w-12 h-12 md:w-16 md:h-16 text-gray-600 mx-auto mb-3 md:mb-4" />
              <h3 className="text-lg md:text-xl font-semibold text-white mb-2">No Messages Yet</h3>
              <p className="text-sm md:text-base text-gray-400 mb-4 md:mb-6">
                Start a conversation from someone&apos;s profile or wait for messages
              </p>
            </div>
          ) : (
            <div className="grid gap-6 lg:grid-cols-2">
              <div className="rounded-2xl border border-gray-800 bg-gray-900/40 p-4 max-h-[65vh] overflow-y-auto">
                <div className="flex items-center justify-between text-xs md:text-sm uppercase tracking-[0.2em] text-gray-500 mb-4">
                  <span>Conversations</span>
                  <span>{directConversations.length}</span>
                </div>
                <div className="space-y-2 md:space-y-3">
                  {directConversations.length === 0 ? (
                    <div className="text-sm text-gray-500 bg-gray-800/60 border border-gray-700 rounded-xl p-4">
                      No conversations yet.
                    </div>
                  ) : (
                    visibleDirect.map((conversation) => {
                      const otherUser = getOtherParticipant(conversation);
                      const hasUnread = (conversation.unreadCount || 0) > 0;

                      return (
                        <div
                          key={conversation.id}
                          onClick={() => handleConversationClick(conversation)}
                          className={`bg-gray-800 border rounded-xl p-3 md:p-4 cursor-pointer transition-all hover:border-purple-500/50 active:scale-[0.98] min-h-[72px] ${hasUnread
                            ? 'border-orange-500/50 bg-orange-500/5'
                            : 'border-gray-700'
                            }`}
                        >
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <div className="w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center flex-shrink-0 bg-orange-500/20">
                                <span className="text-xs md:text-sm font-semibold text-orange-400">
                                  {otherUser?.user?.anonymousId?.charAt(0) || 'A'}
                                </span>
                              </div>
                              <div className="min-w-0">
                                <span className="text-sm md:text-base font-semibold text-white truncate block">
                                  {otherUser?.user?.anonymousId || 'Anonymous User'}
                                </span>
                                <span className="inline-flex items-center gap-1 text-[10px] md:text-xs text-purple-300 mt-1">
                                  <span className="px-2 py-0.5 rounded-full bg-purple-500/15 border border-purple-500/30">
                                    Conversation
                                  </span>
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center gap-1 md:gap-2 flex-shrink-0">
                              <span className="text-[10px] md:text-xs text-gray-500">
                                {formatTimestamp(getConversationTimestamp(conversation))}
                              </span>
                            </div>
                          </div>
                          {conversation.lastMessage && (
                            <p className="text-gray-300 text-xs md:text-sm line-clamp-2">
                              {conversation.lastMessage.content}
                            </p>
                          )}
                          {hasUnread && (
                            <div className="flex items-center gap-2 mt-2">
                              <span className="inline-block text-[10px] md:text-xs bg-orange-500/20 text-orange-400 px-2 py-0.5 md:py-1 rounded-full">
                                {conversation.unreadCount} new
                              </span>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                  {hasMoreDirect && (
                    <button
                      onClick={() => setDirectPage((prev) => prev + 1)}
                      className="mt-3 w-full rounded-lg border border-gray-700 bg-gray-900/60 px-4 py-2 text-sm text-gray-300 hover:border-purple-500/40 hover:text-white transition-colors"
                    >
                      Load more conversations
                    </button>
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-gray-800 bg-gray-900/40 p-4 max-h-[65vh] overflow-y-auto">
                <div className="flex items-center justify-between text-xs md:text-sm uppercase tracking-[0.2em] text-gray-500 mb-4">
                  <span>One-off Messages</span>
                  <span>{oneOffConversations.length}</span>
                </div>
                <div className="space-y-2 md:space-y-3">
                  {oneOffConversations.length === 0 ? (
                    <div className="text-sm text-gray-500 bg-gray-800/60 border border-gray-700 rounded-xl p-4">
                      No one-off messages yet.
                    </div>
                  ) : (
                    visibleOneOff.map((conversation) => {
                      const hasUnread = (conversation.unreadCount || 0) > 0;

                      return (
                        <div
                          key={conversation.id}
                          onClick={() => handleConversationClick(conversation)}
                          className={`bg-gray-900/60 border rounded-xl p-3 md:p-4 cursor-pointer transition-all hover:border-purple-500/50 active:scale-[0.98] min-h-[72px] ${hasUnread
                            ? 'border-purple-500/50'
                            : 'border-gray-700'
                            }`}
                        >
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <div className="w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center flex-shrink-0 bg-purple-600/20">
                                <Zap className="w-4 h-4 md:w-5 md:h-5 text-purple-400" />
                              </div>
                              <div className="min-w-0">
                                <span className="text-sm md:text-base font-semibold text-white truncate block">
                                  Anonymous Message
                                </span>
                                <span className="inline-flex items-center gap-1 text-[10px] md:text-xs text-purple-300 mt-1">
                                  <span className="px-2 py-0.5 rounded-full bg-purple-500/15 border border-purple-500/30">
                                    One-off - No replies
                                  </span>
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center gap-1 md:gap-2 flex-shrink-0">
                              <span className="text-[10px] md:text-xs text-gray-500">
                                {formatTimestamp(getConversationTimestamp(conversation))}
                              </span>
                            </div>
                          </div>
                          {conversation.lastMessage && (
                            <p className="text-gray-300 text-xs md:text-sm line-clamp-2">
                              {conversation.lastMessage.content}
                            </p>
                          )}
                          {hasUnread && (
                            <div className="flex items-center gap-2 mt-2">
                              <span className="inline-block text-[10px] md:text-xs bg-purple-500/20 text-purple-300 px-2 py-0.5 md:py-1 rounded-full">
                                {conversation.unreadCount} new
                              </span>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                  {hasMoreOneOff && (
                    <button
                      onClick={() => setOneOffPage((prev) => prev + 1)}
                      className="mt-3 w-full rounded-lg border border-gray-700 bg-gray-900/60 px-4 py-2 text-sm text-gray-300 hover:border-purple-500/40 hover:text-white transition-colors"
                    >
                      Load more one-off messages
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
        </>
        )}

      </div>

      <MessageModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        message={modalMessage || undefined}
        conversation={selectedConversation || undefined}
      />
    </div >
  );
}

export default function InboxPage() {
  return (
    <Suspense fallback={<AppLoadingState title="Syncing your conversations..." />}>
      <InboxPageContent />
    </Suspense>
  );
}
