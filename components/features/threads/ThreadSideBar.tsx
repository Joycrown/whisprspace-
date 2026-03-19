/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect } from 'react';
import { FaRegBell, FaBell, FaEnvelope, FaUserMinus, FaGlobe, FaLock, FaFlag } from 'react-icons/fa';
import { Eye, Settings } from 'lucide-react'; // Import Settings icon
import { Thread, Message, Participant, ThreadPrivacy } from '@/types';
import { useSearch } from '@/hooks/hooks/ThreadSearchHook';
import { SearchBar, SearchResults } from './ThreadSearchBar';
import { DeleteModal, RemoveModal, ReportModal as ThreadReportModal, VisibilityModal, LeaveModal } from '@/components/modals/ThreadModals';
import ThreadSettingsPanel from './ThreadSettingsPanel'; // Import the new settings panel
import { formatDistanceToNow } from 'date-fns';
import { useToast } from '@/components/ui/Toast'; // Import useToast
import { createThreadInvite } from '@/lib/threads';
import { getAvatarUrl } from '@/lib/utils/avatar';
import { buildThreadPath } from '@/lib/threads/thread-url';

interface ThreadSidebarProps {
  thread: Thread & {
    reportCount: number;
    participants: Participant[]; // Ensure participants are always present
  };
  isMuted: boolean;
  setIsMuted: (muted: boolean) => void;
  isCreator: boolean;
  participants: Participant[];
  messages: Message[];
  onRemoveParticipant?: (participantId: string) => void;
  onMessageParticipant?: (participantId: string) => void;
  onLeaveThread?: () => void;
  onDeleteThread?: () => void;
  onReportThread?: (data: { reason: string; customReason?: string }) => void | Promise<void>;
  onUpdateThreadPrivacy?: (privacy: ThreadPrivacy, memberLimit?: number) => void; // New prop for privacy update
  onSetMessageFilter?: (filter: { senderId?: string; keyword?: string }) => void; // New prop for setting message filter
  currentMessageFilter?: { senderId?: string; keyword?: string }; // New prop for current message filter state
  onLockThread?: (threadId: string, isLocked: boolean) => void; // New prop for locking/unlocking thread
  onViewReportedMessages?: (threadId: string) => void; // New prop for viewing reported messages
  onInviteParticipant?: (threadId: string, participantId: string) => void; // Add onInviteParticipant here
  isMobileDrawer?: boolean; // Add prop to indicate if rendering in mobile drawer
  isDeleting?: boolean; // New prop for deletion loading state
  onJoinThread?: () => void; // New prop for joining thread
  isJoined?: boolean; // New prop for joined status
  joinErrorMessage?: string; // Optional join/leave error
  isBanned?: boolean; // Optional ban status
}

const ThreadSidebar: React.FC<ThreadSidebarProps> = ({
  thread,
  isMuted,
  setIsMuted,
  isCreator,
  participants,
  messages,
  onRemoveParticipant,
  onMessageParticipant,
  onLeaveThread,
  onDeleteThread,
  onReportThread,
  onUpdateThreadPrivacy,
  onSetMessageFilter,
  currentMessageFilter,
  onLockThread,
  onViewReportedMessages,
  onInviteParticipant, // Destructure onInviteParticipant here
  isMobileDrawer = false, // Destructure with default value
  isDeleting = false, // Destructure deletion state
  onJoinThread, // Destructure
  isJoined = false, // Destructure
  joinErrorMessage,
  isBanned = false,
}) => {
  const { searchQuery, setSearchQuery, searchResults, isLoading: isSearching } = useSearch();
  const [selectedParticipant, setSelectedParticipant] = useState<Participant | null>(null);
  const [showRemoveModal, setShowRemoveModal] = useState(false);
  const [isLinkVisible, setIsLinkVisible] = useState(false);
  const [showVisibilityModal, setShowVisibilityModal] = useState(false);
  const [isPublic, setIsPublic] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [showSettingsPanel, setShowSettingsPanel] = useState(false); // State for settings panel
  const [showDeleteModal, setShowDeleteModal] = useState(false); // State for delete modal
  const [showLeaveModal, setShowLeaveModal] = useState(false); // State for leave modal
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [isGeneratingLink, setIsGeneratingLink] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const { showToast } = useToast(); // Initialize toast
  const threadId = thread?.id;
  const threadPrivacy = thread?.privacy;

  useEffect(() => {
    if (!threadId) return;
    setInviteLink(null);
    setIsLinkVisible(false);
  }, [threadId, threadPrivacy]);

  const handleMessageClick = (participant: Participant) => {
    setSelectedParticipant(participant);
    onMessageParticipant?.(participant.id);
  };

  const handleRemoveClick = (participant: Participant) => {
    setSelectedParticipant(participant);
    setShowRemoveModal(true);
  };

  const handleParticipantClick = (participantId: string) => {
    const participant = participants.find(p => p.id === participantId);
    if (participant) {
      setSelectedParticipant(participant);
    }
  };

  const handleMessageSearch = (messageId: string) => {
    console.log('Navigate to message:', messageId);
  };

  const handleReport = async ({ reason, customReason }: { reason: string; customReason?: string }) => {
    if (thread.isLocked) {
      showToast({
        type: 'error',
        title: 'Thread Blocked',
        message: 'This thread is already blocked due to community reports.',
        duration: 4000,
      });
      setShowReportModal(false);
      return;
    }

    try {
      await onReportThread?.({ reason, customReason });
    } finally {
      setShowReportModal(false);
    }
  };

  interface TooltipProps {
    text: string;
    children: React.ReactNode;
  }

  const CustomTooltip: React.FC<TooltipProps> = ({ text, children }) => {
    return (
      <div className="group relative inline-block">
        {children}
        <div className="invisible opacity-0 group-hover:visible group-hover:opacity-100 transition-all duration-300 absolute z-50 px-3 py-2 text-sm bg-gray-800 text-gray-200 rounded-md shadow-lg bottom-full left-0 mb-2 w-64">
          <div className="relative text-xs">
            {text}
            <div className="absolute w-2 h-2 bg-gray-800 rotate-45 top-full -mt-1 left-4"></div>
          </div>
        </div>
      </div>
    );
  };

  const buildThreadLink = () => `${window.location.origin}/auth?redirect=${encodeURIComponent(`${buildThreadPath({ id: thread.id, title: thread.title })}?from=share`)}`;

  const copyToClipboard = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
      showToast({
        type: 'success',
        title: 'Link Copied',
        message: 'Invite link copied to clipboard.',
        duration: 3000,
      });
      return true;
    } catch {
      showToast({
        type: 'error',
        title: 'Copy Failed',
        message: 'Unable to copy link. Please copy manually.',
        duration: 4000,
      });
      return false;
    }
  };

  const generateInviteLink = async (forceNew: boolean = false) => {
    if (thread.privacy !== 'public' && !isCreator) {
      showToast({
        type: 'error',
        title: 'Invite Link Restricted',
        message: 'Only the thread creator can generate invite links.',
        duration: 4000,
      });
      return null;
    }

    if (thread.privacy !== 'public') {
      setIsGeneratingLink(true);
      const { code, error } = await createThreadInvite(thread.id, null, 7, forceNew);
      setIsGeneratingLink(false);
      if (error || !code) {
        showToast({
          type: 'error',
          title: 'Invite Link Failed',
          message: error || 'Unable to generate invite link.',
          duration: 4000,
        });
        return null;
      }
      return `${window.location.origin}/invite/${code}`;
    } else {
      return buildThreadLink();
    }
  };

  const handleLinkClick = async () => {
    const link = inviteLink || (await generateInviteLink());
    if (!link) return;
    setInviteLink(link);
    setIsLinkVisible(true);
    await copyToClipboard(link);
  };

  const handleRegenerateLink = async () => {
    const link = await generateInviteLink(true);
    if (!link) return;
    setInviteLink(link);
    setIsLinkVisible(true);
    await copyToClipboard(link);
  };

  const ThreadLinkSection = () => (
    <div className='border-b border-gray-800 p-4'>
      <div className="flex items-center justify-between">
        <CustomTooltip text="Generate a unique link to invite others to join this thread. Perfect for collaboration and discussion.">
          <div className="cursor-help">
            <h2 className="text-sm text-gray-400">Thread Link</h2>
            <p className="text-xs text-gray-400">Share and connect with others</p>
          </div>
        </CustomTooltip>
        <button
          onClick={handleLinkClick}
          disabled={!isCreator}
          className={`p-1.5 rounded transition-colors ${
            isCreator ? 'hover:bg-gray-700' : 'opacity-40 cursor-not-allowed'
          }`}
        >
          <Eye className="w-4 h-4 text-gray-400" />
        </button>
      </div>
      <div>
        {isLinkVisible && isCreator && (
          <div className="flex items-start gap-2">
            <button
              type="button"
              onClick={handleLinkClick}
              className="text-sm text-gray-300 break-all text-left hover:text-white transition-colors"
            >
              {isGeneratingLink ? 'Generating link...' : (inviteLink || buildThreadLink())}
            </button>
            {inviteLink && (
              <button
                type="button"
                onClick={handleRegenerateLink}
                className="text-[11px] px-2 py-0.5 rounded-full border border-gray-600 text-gray-300 hover:border-purple-400 hover:text-purple-300 transition-colors"
                title="Generate a new link (old one will stop working)"
              >
                Regenerate
              </button>
            )}
          </div>
        )}
        {!isCreator && (
          <div className="text-xs text-gray-500 mt-2">Only the creator can generate a link.</div>
        )}
        {linkCopied && (
          <span className="inline-block mt-2 text-[11px] px-2 py-0.5 rounded-full bg-green-500/20 text-green-400">
            Copied
          </span>
        )}
      </div>
    </div>

  );

  const ThreadStatusSection = () => {
    return (
      <div className="border-b border-gray-800 p-4">
        <CustomTooltip text="Manage who can access this thread. Public threads are visible to all members, while private threads are invitation-only.">
          <div className="cursor-help mb-2">
            <h2 className="text-sm text-gray-400">Thread Status</h2>
            <p className="text-xs text-gray-400">Control thread visibility</p>
          </div>
        </CustomTooltip>

        <div className="flex items-center justify-between mt-1">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowVisibilityModal(true)}
              className="p-1.5 rounded hover:bg-gray-700 transition-colors duration-200"
            >
              {thread.privacy === 'public' ? (
                <FaGlobe className="text-green-400" />
              ) : (
                <FaLock className="text-yellow-400" />
              )}
            </button>
            <span className="text-sm text-gray-300">
              {thread.privacy === 'public'
                ? 'Public'
                : thread.privacy === 'invite_only'
                  ? 'Invite Only'
                  : 'Private'}
            </span>
          </div>
          <span className="text-xs text-gray-400">
            {thread.privacy === 'public' ? 'Anyone can join' : 'Invitation required'}
          </span>
        </div>
      </div>
    );
  };

  const ReportSection = ({ reportCount }: any) => (
    <div className="flex items-center justify-between">
      <CustomTooltip text="Number of times this thread has been reported by participants. High report counts may trigger moderation review.">
        <div className="flex items-center gap-2 cursor-help">
          <span className="text-sm text-gray-400">Reports</span>
        </div>
      </CustomTooltip>
      <span className="text-sm text-gray-300">{reportCount}</span>
    </div>
  );

  const ReportButton = ({ onReportClick, disabled = false }: any) => (
    <button
      onClick={onReportClick}
      disabled={disabled}
      className={`text-gray-400 transition-colors ${disabled ? 'cursor-not-allowed opacity-50' : 'hover:text-red-400'}`}
    >
      <CustomTooltip text="Report this thread if you find any content that violates community guidelines">
        <div className="flex items-center gap-2">
          <span className="text-sm">Report Thread</span>
          <FaFlag className="w-4 h-4" />
        </div>
      </CustomTooltip>
    </button>
  );

  const MuteSection = ({ isMuted, setIsMuted }: any) => (
    <div className="flex items-center justify-between">
      <CustomTooltip text="Control notifications for this thread. When muted, you won't receive any notifications from new messages or updates.">
        <span className="text-sm text-gray-400 cursor-help">{isMuted ? 'Unmute Thread' : 'Mute Thread'}</span>
      </CustomTooltip>
      <button
        onClick={() => setIsMuted(!isMuted)}
        className="p-1.5 rounded hover:bg-gray-700 transition-colors"
      >
        {isMuted ? (
          <FaBell className="w-4 h-4 text-purple-400" />
        ) : (
          <FaRegBell className="w-4 h-4 text-gray-400 hover:text-purple-400" />
        )}
      </button>
    </div>
  );

  if (!thread) return null;

  return (
    <div className={`flex flex-col w-full h-full ${isMobileDrawer ? '' : 'hidden lg:flex border-l border-gray-800'}`}>
      {/* Search Section */}
      <div className={`sticky top-0 bg-[#121212] z-10 p-4 border-b border-gray-800 flex-shrink-0`}>
        <SearchBar
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
        />
      </div>
      {/* Scrollable Content Area */}
      <div className="flex-grow overflow-y-auto scrollbar-hide">
        <div className="mt-4">
          {searchQuery.trim() ? (
            <SearchResults
              onParticipantClick={handleParticipantClick}
              onMessageClick={handleMessageSearch}
              searchQuery={searchQuery}
              searchResults={{
                ...searchResults,
                participants: searchResults.participants.map(p => ({
                  ...p,
                  anonymousId: p.id, // Fallback or correct mapping
                  status: 'offline', // Default status
                  isPremium: false,
                  reportCount: 0
                }))
              }}
              isLoading={isSearching}
            />
          ) : (
            <div className="space-y-4">
              {/* Thread Overview */}
              <div className="bg-gray-800 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-gray-400 mb-2">Thread Overview</h3>
                <div className="space-y-2 text-gray-300 text-sm">
                  <p><strong>Total Messages:</strong> {messages.length}</p>
                  <p><strong>Total Participants:</strong> {thread.participantCount ?? participants.length}</p>
                  <p><strong>Created:</strong> {(() => {
                    const start = new Date(thread.createdAt);
                    const end = new Date();
                    const diffTime = Math.abs(end.getTime() - start.getTime());
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                    if (diffDays < 30) return formatDistanceToNow(start, { addSuffix: true });

                    const months = Math.floor(diffDays / 30);
                    const days = diffDays % 30;

                    if (days === 0) return `${months} month${months > 1 ? 's' : ''} ago`;
                    return `${months} month${months > 1 ? 's' : ''} ${days} day${days > 1 ? 's' : ''} ago`;
                  })()}</p>
                  <p><strong>Likes:</strong> {thread.likes}</p>
                  <p><strong>Rating:</strong> {thread.rating.toFixed(1)} ({thread.ratingCount} votes)</p>
                </div>
              </div>

              {/* About Section - Merged with Participants */}
              <div className="p-4">
                <h2 className="text-lg font-bold text-white mb-4">About</h2>
                <div className="space-y-4">
                  <div>
                    <h3 className="text-sm text-gray-400 mb-2">Created by</h3>
                    <div className="flex items-center gap-3">
                      <img
                        src={thread.author?.avatar || getAvatarUrl(thread.author?.id || thread.creatorId)}
                        alt={thread.author?.name || 'Anonymous'}
                        className="w-8 h-8 rounded-full"
                      />
                      <span className="text-white">{thread.author?.name || 'Anonymous'}</span>
                    </div>
                  </div>

                  {/* Settings button, visible to creator for private/invite-only threads */}
                  {isCreator && (thread.privacy !== 'public') && (
                    <button
                      onClick={() => setShowSettingsPanel(true)}
                      className="w-full py-2 px-4 bg-gray-700 hover:bg-gray-600 text-white rounded transition-colors flex items-center justify-center gap-2"
                    >
                      <Settings className="w-4 h-4" />
                      Manage Private Thread
                    </button>
                  )}

                  {isCreator && <ThreadLinkSection />}
                  {isCreator && <ThreadStatusSection />}

                  <ReportSection reportCount={thread.reportCount} />

                  {thread.isLocked && (
                    <div className="rounded-md border border-red-800 bg-red-950/40 px-3 py-2 text-xs text-red-200">
                      This thread is blocked due to community reports.
                    </div>
                  )}

                  {!isCreator && (
                    <ReportButton
                      disabled={thread.isLocked}
                      onReportClick={() => setShowReportModal(true)}
                    />
                  )}

                  <MuteSection isMuted={isMuted} setIsMuted={setIsMuted} />

                  {/* Participants moved here */}
                  <h2 className="text-lg font-bold text-white mb-4 mt-4">Participants</h2>
                  <div className="space-y-3">
                    {participants.map(participant => {
                      const isValidUrl = (s?: string) => !!s && s.startsWith('http');
                      const avatarSrc = isValidUrl(participant.avatar)
                        ? participant.avatar
                        : getAvatarUrl(participant.id || participant.anonymousId);
                      const initials = (participant.name || participant.anonymousId || '?').charAt(0).toUpperCase();
                      return (
                      <div key={participant.id} className="flex items-center gap-3">
                        <img
                          src={avatarSrc}
                          alt={participant.name || 'Anonymous'}
                          className="w-8 h-8 rounded-full object-cover object-top flex-shrink-0"
                          onError={(e) => {
                            const target = e.currentTarget;
                            target.style.display = 'none';
                            const fallback = target.nextElementSibling as HTMLElement;
                            if (fallback) fallback.style.display = 'flex';
                          }}
                        />
                        <div
                          className="w-8 h-8 rounded-full flex-shrink-0 items-center justify-center bg-purple-700 text-white text-xs font-bold"
                          style={{ display: 'none' }}
                        >
                          {initials}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-white truncate">{participant.name || 'Anonymous'}</p>
                          <p className="text-sm text-gray-400">{participant.messageCount ?? 0} messages</p>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleMessageClick(participant)}
                            className="text-gray-400 hover:text-purple-400 transition-colors p-1.5 rounded hover:bg-gray-700"
                          >
                            <FaEnvelope />
                          </button>
                          {isCreator && participant.id !== thread.author?.id && (
                            <button
                              onClick={() => handleRemoveClick(participant)}
                              className="text-gray-400 hover:text-red-400 transition-colors p-1.5 rounded hover:bg-gray-700"
                            >
                              <FaUserMinus />
                            </button>
                          )}
                        </div>
                      </div>
                    )})}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Action Button */}
      <div className="p-4 border-t border-gray-800 flex-shrink-0">
        {joinErrorMessage && (
          <div className="mb-2 text-xs text-red-400 bg-red-900/30 border border-red-800 rounded px-3 py-2">
            {joinErrorMessage}
          </div>
        )}
        {isCreator ? (
          <div className="mt-6 space-y-2">
            {/* Save Thread Button - Premium Feature (show to all creators) */}
            {thread.expiresAt && !thread.isSaved && (
              <button
                onClick={() => {
                  // Check if user is premium
                  const userIsPremium = thread.author?.isPremium;

                  if (!userIsPremium) {
                    // Show upgrade prompt for non-premium users
                    showToast({
                      type: 'warning',
                      title: '🌟 Premium Feature',
                      message: 'Save Thread is a premium feature. Upgrade to Premium to save threads permanently, remove expiration dates, and keep them private!',
                      duration: 7000
                    });
                    return;
                  }

                  // Premium user - proceed with save
                  import('@/lib/threads/thread-service').then(({ saveThread }) => {
                    const userId = thread.author?.id || thread.authorId;
                    if (userId) {
                      saveThread(thread.id, userId).then(result => {
                        if (result.success) {
                          showToast({
                            type: 'success',
                            title: 'Thread Saved!',
                            message: 'Your thread will never expire and is now private to you.',
                          });
                          window.location.reload();
                        } else {
                          showToast({
                            type: 'error',
                            title: 'Failed to Save',
                            message: result.error || 'Could not save thread',
                          });
                        }
                      });
                    }
                  });
                }}
                className={`w-full px-4 py-2 rounded-lg transition-colors flex items-center justify-center gap-2 ${thread.author?.isPremium
                  ? 'bg-green-600 hover:bg-green-700 text-white'
                  : 'bg-gray-700 hover:bg-gray-600 text-gray-300 border border-yellow-500/50'
                  }`}
              >
                <span>💾</span>
                Save Thread
                {!thread.author?.isPremium && <span className="text-yellow-400 text-xs ml-1">★ Premium</span>}
              </button>
            )}

            {/* Extend Expiration Button - Premium Feature (show to all creators) */}
            {thread.expiresAt && !thread.isSaved && (
              <button
                onClick={() => {
                  // Check if user is premium
                  const userIsPremium = thread.author?.isPremium;

                  if (!userIsPremium) {
                    // Show upgrade prompt for non-premium users
                    showToast({
                      type: 'warning',
                      title: '🌟 Premium Feature',
                      message: 'Extend Thread is a premium feature. Upgrade to Premium to extend thread expiration by 7 days and keep popular threads alive longer!',
                      duration: 7000
                    });
                    return;
                  }

                  // Premium user - proceed with extend
                  import('@/lib/threads/thread-service').then(({ extendThreadExpiration }) => {
                    const userId = thread.author?.id || thread.authorId;
                    if (userId) {
                      extendThreadExpiration(thread.id, userId).then(result => {
                        if (result.success) {
                          const newDate = result.newExpiresAt ? new Date(result.newExpiresAt).toLocaleString() : '';
                          showToast({
                            type: 'success',
                            title: 'Thread Extended!',
                            message: `New expiration: ${newDate}`,
                          });
                          window.location.reload();
                        } else {
                          showToast({
                            type: 'error',
                            title: 'Failed to Extend',
                            message: result.error || 'Could not extend thread',
                          });
                        }
                      });
                    }
                  });
                }}
                className={`w-full px-4 py-2 rounded-lg transition-colors flex items-center justify-center gap-2 ${thread.author?.isPremium
                  ? 'bg-purple-600 hover:bg-purple-700 text-white'
                  : 'bg-gray-700 hover:bg-gray-600 text-gray-300 border border-yellow-500/50'
                  }`}
              >
                <span>⏰</span>
                Extend +7 Days
                {!thread.author?.isPremium && <span className="text-yellow-400 text-xs ml-1">★ Premium</span>}
              </button>
            )}

            {/* Saved Thread Indicator */}
            {thread.isSaved && (
              <div className="w-full bg-green-900/30 border border-green-500/30 text-green-400 px-4 py-2 rounded-lg flex items-center justify-center gap-2">
                <span>✅</span>
                Saved (Never Expires)
              </div>
            )}

            <button
              onClick={() => setShowDeleteModal(true)}
              className="w-full bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-colors"
            >
              Delete Thread
            </button>
          </div>
        ) : (
          isBanned ? (
            <div className="w-full text-center bg-red-900/30 border border-red-800 text-red-300 px-4 py-3 rounded-lg">
              You have been removed from this thread.
            </div>
          ) : (
            isJoined ? (
              <button
                onClick={() => setShowLeaveModal(true)}
                className="w-full py-2 px-4 bg-red-600 hover:bg-red-700 text-white rounded transition-colors"
              >
                Leave Thread
              </button>
            ) : (
              <button
                onClick={onJoinThread}
                className="w-full py-2 px-4 bg-purple-600 hover:bg-purple-700 text-white rounded transition-colors flex items-center justify-center gap-2"
              >
                <span>👋</span> Join Thread
              </button>
            )
          )
        )}
      </div>

      {/* Modals */}
      <RemoveModal
        isOpen={showRemoveModal}
        onClose={() => setShowRemoveModal(false)}
        participantName={selectedParticipant?.name || ''}
        onRemove={() => onRemoveParticipant?.(selectedParticipant?.id || '')}
      />

      <ThreadReportModal
        isOpen={showReportModal}
        onClose={() => setShowReportModal(false)}
        onReport={handleReport}
      />

      <VisibilityModal
        isOpen={showVisibilityModal}
        onClose={() => setShowVisibilityModal(false)}
        isPublic={isPublic}
        onToggleVisibility={() => setIsPublic(!isPublic)}
      />


      <DeleteModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onDelete={() => onDeleteThread?.()}
        isLoading={isDeleting}
      />

      {/* Settings Panel */}
      <ThreadSettingsPanel
        isOpen={showSettingsPanel}
        onClose={() => setShowSettingsPanel(false)}
        thread={thread}
        onUpdatePrivacy={onUpdateThreadPrivacy}
        onRemoveParticipant={onRemoveParticipant}
        onInviteParticipant={onInviteParticipant} // Pass onInviteParticipant here
        participants={participants} // Pass participants to settings panel for member management
        onSetMessageFilter={onSetMessageFilter} // Pass message filter setter
        currentMessageFilter={currentMessageFilter} // Pass current message filter state
        onLockThread={onLockThread} // Pass new handler
        onViewReportedMessages={onViewReportedMessages} // Pass new handler
      />
      <LeaveModal
        isOpen={showLeaveModal}
        onClose={() => setShowLeaveModal(false)}
        onConfirm={() => {
          onLeaveThread?.();
          setShowLeaveModal(false);
        }}
      />
    </div>
  );
};

export default ThreadSidebar;




