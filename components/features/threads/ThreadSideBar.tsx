/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect } from 'react';
import { FaRegBell, FaBell, FaEnvelope, FaUserMinus, FaGlobe, FaLock, FaFlag } from 'react-icons/fa';
import { Eye, Settings } from 'lucide-react';
import { Thread, Message, Participant, ThreadPrivacy } from '@/types';
import { useSearch } from '@/hooks/hooks/ThreadSearchHook';
import { SearchBar, SearchResults } from './ThreadSearchBar';
import { DeleteModal, RemoveModal, ReportModal as ThreadReportModal, VisibilityModal, LeaveModal } from '@/components/modals/ThreadModals';
import ThreadSettingsPanel from './ThreadSettingsPanel';
import { formatDistanceToNow } from 'date-fns';
import { useToast } from '@/components/ui/Toast';
import { createThreadInvite } from '@/lib/threads';
import { buildThreadPath } from '@/lib/threads/thread-url';

interface ThreadSidebarProps {
  thread: Thread & { reportCount: number; participants: Participant[] };
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
  onUpdateThreadPrivacy?: (privacy: ThreadPrivacy, memberLimit?: number) => void;
  onSetMessageFilter?: (filter: { senderId?: string; keyword?: string }) => void;
  currentMessageFilter?: { senderId?: string; keyword?: string };
  onLockThread?: (threadId: string, isLocked: boolean) => void;
  onViewReportedMessages?: (threadId: string) => void;
  onInviteParticipant?: (threadId: string, participantId: string) => void;
  isMobileDrawer?: boolean;
  isDeleting?: boolean;
  onJoinThread?: () => void;
  isJoined?: boolean;
  joinErrorMessage?: string;
  isBanned?: boolean;
}

// Deterministic identicon — no human photos in sidebar participant list
function Identicon({ seed, size = 32 }: { seed: string; size?: number }) {
  const char = (seed || '?').charAt(0).toUpperCase();
  const code = (seed || '').charCodeAt(0) || 63;
  const hue = (code * 47) % 360;
  const hue2 = (hue + 55) % 360;
  return (
    <div
      className="flex-shrink-0 flex items-center justify-center font-semibold select-none rounded-[22%]"
      style={{
        width: size,
        height: size,
        background: `linear-gradient(135deg, hsl(${hue},65%,42%), hsl(${hue2},65%,52%))`,
        fontSize: size * 0.4,
        color: 'rgba(255,255,255,0.92)',
      }}
    >
      {char}
    </div>
  );
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
  onInviteParticipant,
  isMobileDrawer = false,
  isDeleting = false,
  onJoinThread,
  isJoined = false,
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
  const [showSettingsPanel, setShowSettingsPanel] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [isGeneratingLink, setIsGeneratingLink] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const { showToast } = useToast();
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
    const p = participants.find(p => p.id === participantId);
    if (p) setSelectedParticipant(p);
  };

  const handleReport = async ({ reason, customReason }: { reason: string; customReason?: string }) => {
    if (thread.isLocked) {
      showToast({ type: 'error', title: 'Thread blocked', message: 'This thread is already blocked.', duration: 4000 });
      setShowReportModal(false);
      return;
    }
    try { await onReportThread?.({ reason, customReason }); } finally { setShowReportModal(false); }
  };

  const CustomTooltip: React.FC<{ text: string; children: React.ReactNode }> = ({ text, children }) => (
    <div className="group relative inline-block">
      {children}
      <div className="invisible opacity-0 group-hover:visible group-hover:opacity-100 transition-all duration-200 absolute z-50 px-3 py-2 text-xs bg-[#1A1A24] border border-[#23232E] text-[#8F8FA3] rounded-xl shadow-xl bottom-full left-0 mb-2 w-56 pointer-events-none">
        {text}
      </div>
    </div>
  );

  const buildThreadLink = () =>
    `${window.location.origin}/auth?redirect=${encodeURIComponent(`${buildThreadPath({ id: thread.id, title: thread.title })}?from=share`)}`;

  const copyToClipboard = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
      showToast({ type: 'success', title: 'Link copied', message: 'Invite link copied to clipboard.', duration: 3000 });
      return true;
    } catch {
      showToast({ type: 'error', title: 'Copy failed', message: 'Unable to copy link.', duration: 4000 });
      return false;
    }
  };

  const generateInviteLink = async (forceNew = false) => {
    if (thread.privacy !== 'public' && !isCreator) {
      showToast({ type: 'error', title: 'Restricted', message: 'Only the thread creator can generate invite links.', duration: 4000 });
      return null;
    }
    if (thread.privacy !== 'public') {
      setIsGeneratingLink(true);
      const { code, error } = await createThreadInvite(thread.id, null, 7, forceNew);
      setIsGeneratingLink(false);
      if (error || !code) {
        showToast({ type: 'error', title: 'Link failed', message: error || 'Unable to generate invite link.', duration: 4000 });
        return null;
      }
      return `${window.location.origin}/invite/${code}`;
    }
    return buildThreadLink();
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

  // ── Section components ──────────────────────────────────────────────────────

  const sectionCls = 'border-b border-[#23232E] px-4 py-4';
  const labelCls = 'text-xs text-[#5C5C6E] uppercase tracking-wide';
  const subLabelCls = 'text-[11px] text-[#5C5C6E]';

  const ThreadLinkSection = () => (
    <div className={sectionCls}>
      <div className="flex items-center justify-between">
        <CustomTooltip text="Generate a unique link to invite others to join this thread.">
          <div className="cursor-help">
            <p className={labelCls}>Thread link</p>
            <p className={subLabelCls}>Share and connect</p>
          </div>
        </CustomTooltip>
        <button
          onClick={handleLinkClick}
          disabled={!isCreator}
          className={`p-1.5 rounded-lg transition-colors ${isCreator ? 'text-[#5C5C6E] hover:text-[#F2F2F6] hover:bg-white/[0.05]' : 'opacity-30 cursor-not-allowed'}`}
        >
          <Eye className="w-4 h-4" />
        </button>
      </div>
      {isLinkVisible && isCreator && (
        <div className="flex items-start gap-2 mt-2">
          <button
            type="button"
            onClick={handleLinkClick}
            className="text-xs text-[#8F8FA3] break-all text-left hover:text-[#F2F2F6] transition-colors"
          >
            {isGeneratingLink ? 'Generating…' : (inviteLink || buildThreadLink())}
          </button>
          {inviteLink && (
            <button
              type="button"
              onClick={handleRegenerateLink}
              className="text-[11px] px-2 py-0.5 rounded-full border border-[#2A2A38] text-[#8F8FA3] hover:border-[#8B5CF6]/50 hover:text-[#C4B5FD] transition-colors flex-shrink-0"
            >
              Regenerate
            </button>
          )}
        </div>
      )}
      {!isCreator && <p className={`${subLabelCls} mt-1`}>Only the creator can generate a link.</p>}
      {linkCopied && (
        <span className="inline-block mt-1.5 text-[11px] px-2 py-0.5 rounded-full bg-[#5DCAA5]/10 text-[#5DCAA5]">Copied</span>
      )}
    </div>
  );

  const ThreadStatusSection = () => (
    <div className={sectionCls}>
      <CustomTooltip text="Manage who can access this thread.">
        <div className="cursor-help mb-2">
          <p className={labelCls}>Thread status</p>
          <p className={subLabelCls}>Control visibility</p>
        </div>
      </CustomTooltip>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button onClick={() => setShowVisibilityModal(true)} className="p-1.5 rounded-lg hover:bg-white/[0.05] transition-colors">
            {thread.privacy === 'public'
              ? <FaGlobe className="text-[#5DCAA5]" />
              : <FaLock className="text-[#EF9F27]" />}
          </button>
          <span className="text-sm text-[#8F8FA3]">
            {thread.privacy === 'public' ? 'Public' : thread.privacy === 'invite_only' ? 'Invite only' : 'Private'}
          </span>
        </div>
        <span className={subLabelCls}>{thread.privacy === 'public' ? 'Anyone can join' : 'Invite required'}</span>
      </div>
    </div>
  );

  if (!thread) return null;

  return (
    <div className={`flex flex-col w-full h-full bg-[#0E0E16] ${isMobileDrawer ? '' : 'hidden lg:flex border-l border-[#23232E]'}`}>

      {/* Search */}
      <div className="sticky top-0 bg-[#0E0E16] z-10 px-4 py-3 border-b border-[#23232E] flex-shrink-0">
        <SearchBar searchQuery={searchQuery} setSearchQuery={setSearchQuery} />
      </div>

      {/* Scrollable body */}
      <div className="flex-grow overflow-y-auto scrollbar-hide">
        <div className="mt-2">
          {searchQuery.trim() ? (
            <SearchResults
              onParticipantClick={handleParticipantClick}
              onMessageClick={(id) => { console.log('Navigate to message:', id); }}
              searchQuery={searchQuery}
              searchResults={{
                ...searchResults,
                participants: searchResults.participants.map(p => ({
                  ...p,
                  anonymousId: p.id,
                  status: 'offline',
                  isPremium: false,
                  reportCount: 0,
                })),
              }}
              isLoading={isSearching}
            />
          ) : (
            <div className="space-y-0">
              {/* Overview */}
              <div className={sectionCls}>
                <p className={`${labelCls} mb-2`}>Thread overview</p>
                <div className="space-y-1.5 text-sm text-[#8F8FA3]">
                  <div className="flex justify-between">
                    <span>Messages</span>
                    <span className="text-[#F2F2F6]">{messages.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Participants</span>
                    <span className="text-[#F2F2F6]">{thread.participantCount ?? participants.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Likes</span>
                    <span className="text-[#F2F2F6]">{thread.likes}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Created</span>
                    <span className="text-[#F2F2F6] text-xs">{(() => {
                      const start = new Date(thread.createdAt);
                      const diffDays = Math.ceil(Math.abs(Date.now() - start.getTime()) / 86400000);
                      if (diffDays < 30) return formatDistanceToNow(start, { addSuffix: true });
                      const m = Math.floor(diffDays / 30), d = diffDays % 30;
                      return d === 0 ? `${m}mo ago` : `${m}mo ${d}d ago`;
                    })()}</span>
                  </div>
                </div>
              </div>

              {/* About / Creator */}
              <div className={sectionCls}>
                <p className={`${labelCls} mb-3`}>About</p>
                <div className="flex items-center gap-2.5">
                  <Identicon seed={thread.author?.id || thread.author?.name || 'anon'} size={32} />
                  <div>
                    <p className="text-sm text-[#F2F2F6]">{thread.author?.name || 'Anonymous'}</p>
                    <p className={subLabelCls}>Creator</p>
                  </div>
                </div>

                {isCreator && thread.privacy !== 'public' && (
                  <button
                    onClick={() => setShowSettingsPanel(true)}
                    className="mt-3 w-full py-2 px-4 rounded-xl border border-[#2A2A38] text-sm text-[#8F8FA3] hover:text-[#F2F2F6] hover:border-[#8B5CF6]/40 transition-colors flex items-center justify-center gap-2"
                  >
                    <Settings className="w-4 h-4" />
                    Manage private thread
                  </button>
                )}
              </div>

              {isCreator && <ThreadLinkSection />}
              {isCreator && <ThreadStatusSection />}

              {/* Reports */}
              <div className={`${sectionCls} flex items-center justify-between`}>
                <CustomTooltip text="Number of times this thread has been reported.">
                  <span className={`${labelCls} cursor-help`}>Reports</span>
                </CustomTooltip>
                <span className="text-sm text-[#8F8FA3]">{thread.reportCount}</span>
              </div>

              {thread.isLocked && (
                <div className="mx-4 my-2 rounded-xl border border-[#E24B4A]/30 bg-[#E24B4A]/[0.07] px-3 py-2 text-xs text-[#F2F2F6]">
                  This thread is blocked due to community reports.
                </div>
              )}

              {/* Mute */}
              <div className={`${sectionCls} flex items-center justify-between`}>
                <CustomTooltip text="Mute to stop notifications from this thread.">
                  <span className={`${labelCls} cursor-help`}>{isMuted ? 'Unmute' : 'Mute'} thread</span>
                </CustomTooltip>
                <button
                  onClick={() => setIsMuted(!isMuted)}
                  className="p-1.5 rounded-lg text-[#5C5C6E] hover:text-[#F2F2F6] hover:bg-white/[0.05] transition-colors"
                >
                  {isMuted
                    ? <FaBell className="w-4 h-4 text-[#C4B5FD]" />
                    : <FaRegBell className="w-4 h-4" />}
                </button>
              </div>

              {!isCreator && (
                <div className={`${sectionCls} flex items-center justify-between`}>
                  <button
                    onClick={() => setShowReportModal(true)}
                    disabled={thread.isLocked}
                    className={`text-sm flex items-center gap-2 transition-colors ${thread.isLocked ? 'opacity-40 cursor-not-allowed text-[#5C5C6E]' : 'text-[#8F8FA3] hover:text-[#E24B4A]'}`}
                  >
                    Report thread <FaFlag className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* Participants */}
              <div className="px-4 py-4">
                <p className={`${labelCls} mb-3`}>Participants</p>
                <div className="space-y-3">
                  {participants.map(participant => {
                    const seed = participant.anonymousId || participant.id || participant.name || '?';
                    return (
                      <div key={participant.id} className="flex items-center gap-2.5">
                        <Identicon seed={seed} size={32} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-[#F2F2F6] truncate">{participant.name || 'Anonymous'}</p>
                          <p className={subLabelCls}>{participant.messageCount ?? 0} messages</p>
                        </div>
                        <div className="flex gap-1">
                          <button
                            onClick={() => handleMessageClick(participant)}
                            className="text-[#5C5C6E] hover:text-[#C4B5FD] transition-colors p-1.5 rounded-lg hover:bg-white/[0.05]"
                          >
                            <FaEnvelope className="w-3.5 h-3.5" />
                          </button>
                          {isCreator && participant.id !== thread.author?.id && (
                            <button
                              onClick={() => handleRemoveClick(participant)}
                              className="text-[#5C5C6E] hover:text-[#E24B4A] transition-colors p-1.5 rounded-lg hover:bg-white/[0.05]"
                            >
                              <FaUserMinus className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom actions */}
      <div className="px-4 py-4 border-t border-[#23232E] flex-shrink-0 space-y-2">
        {joinErrorMessage && (
          <div className="text-xs text-[#E24B4A] bg-[#E24B4A]/[0.07] border border-[#E24B4A]/30 rounded-xl px-3 py-2">
            {joinErrorMessage}
          </div>
        )}

        {isCreator ? (
          <div className="space-y-2">
            {thread.expiresAt && !thread.isSaved && (
              <>
                <button
                  onClick={() => {
                    const userIsPremium = thread.author?.isPremium;
                    if (!userIsPremium) {
                      showToast({ type: 'warning', title: 'Premium feature', message: 'Upgrade to save threads permanently.', duration: 7000 });
                      return;
                    }
                    import('@/lib/threads/thread-service').then(({ saveThread }) => {
                      const userId = thread.author?.id || thread.authorId;
                      if (userId) {
                        saveThread(thread.id, userId).then(result => {
                          if (result.success) {
                            showToast({ type: 'success', title: 'Thread saved', message: 'Your thread will never expire.' });
                            window.location.reload();
                          } else {
                            showToast({ type: 'error', title: 'Failed to save', message: result.error || 'Could not save thread' });
                          }
                        });
                      }
                    });
                  }}
                  className={`w-full px-4 py-2 rounded-xl text-sm flex items-center justify-center gap-2 transition-colors ${
                    thread.author?.isPremium
                      ? 'bg-[#5DCAA5]/10 border border-[#5DCAA5]/30 text-[#5DCAA5] hover:bg-[#5DCAA5]/20'
                      : 'bg-white/[0.03] border border-[#2A2A38] text-[#5C5C6E]'
                  }`}
                >
                  Save thread
                  {!thread.author?.isPremium && <span className="text-[#EF9F27] text-[11px]">Premium</span>}
                </button>

                <button
                  onClick={() => {
                    const userIsPremium = thread.author?.isPremium;
                    if (!userIsPremium) {
                      showToast({ type: 'warning', title: 'Premium feature', message: 'Upgrade to extend thread expiration.', duration: 7000 });
                      return;
                    }
                    import('@/lib/threads/thread-service').then(({ extendThreadExpiration }) => {
                      const userId = thread.author?.id || thread.authorId;
                      if (userId) {
                        extendThreadExpiration(thread.id, userId).then(result => {
                          if (result.success) {
                            showToast({ type: 'success', title: 'Extended', message: `New expiration: ${result.newExpiresAt ? new Date(result.newExpiresAt).toLocaleString() : ''}` });
                            window.location.reload();
                          } else {
                            showToast({ type: 'error', title: 'Failed', message: result.error || 'Could not extend thread' });
                          }
                        });
                      }
                    });
                  }}
                  className={`w-full px-4 py-2 rounded-xl text-sm flex items-center justify-center gap-2 transition-colors ${
                    thread.author?.isPremium
                      ? 'bg-[#8B5CF6]/10 border border-[#8B5CF6]/30 text-[#C4B5FD] hover:bg-[#8B5CF6]/20'
                      : 'bg-white/[0.03] border border-[#2A2A38] text-[#5C5C6E]'
                  }`}
                >
                  Extend +7 days
                  {!thread.author?.isPremium && <span className="text-[#EF9F27] text-[11px]">Premium</span>}
                </button>
              </>
            )}

            {thread.isSaved && (
              <div className="w-full text-sm text-[#5DCAA5] border border-[#5DCAA5]/30 bg-[#5DCAA5]/[0.06] px-4 py-2 rounded-xl flex items-center justify-center gap-2">
                Never expires
              </div>
            )}

            <button
              onClick={() => setShowDeleteModal(true)}
              className="w-full bg-[#E24B4A]/[0.08] border border-[#E24B4A]/30 hover:bg-[#E24B4A]/[0.15] text-[#E24B4A] px-4 py-2 rounded-xl text-sm transition-colors"
            >
              Delete thread
            </button>
          </div>
        ) : isBanned ? (
          <div className="text-center text-sm text-[#E24B4A] bg-[#E24B4A]/[0.07] border border-[#E24B4A]/30 px-4 py-3 rounded-xl">
            You have been removed from this thread.
          </div>
        ) : isJoined ? (
          <button
            onClick={() => setShowLeaveModal(true)}
            className="w-full py-2 px-4 bg-[#E24B4A]/[0.08] border border-[#E24B4A]/30 hover:bg-[#E24B4A]/[0.15] text-[#E24B4A] rounded-xl text-sm transition-colors"
          >
            Leave thread
          </button>
        ) : (
          <button
            onClick={onJoinThread}
            className="w-full py-2 px-4 rounded-xl text-sm font-medium text-white flex items-center justify-center gap-2 active:scale-[0.97] transition-all"
            style={{ background: 'linear-gradient(100deg, #8B5CF6, #F97316)' }}
          >
            Join thread
          </button>
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
      <ThreadSettingsPanel
        isOpen={showSettingsPanel}
        onClose={() => setShowSettingsPanel(false)}
        thread={thread}
        onUpdatePrivacy={onUpdateThreadPrivacy}
        onRemoveParticipant={onRemoveParticipant}
        onInviteParticipant={onInviteParticipant}
        participants={participants}
        onSetMessageFilter={onSetMessageFilter}
        currentMessageFilter={currentMessageFilter}
        onLockThread={onLockThread}
        onViewReportedMessages={onViewReportedMessages}
      />
      <LeaveModal
        isOpen={showLeaveModal}
        onClose={() => setShowLeaveModal(false)}
        onConfirm={() => { onLeaveThread?.(); setShowLeaveModal(false); }}
      />
    </div>
  );
};

export default ThreadSidebar;
