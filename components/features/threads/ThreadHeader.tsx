'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import {
  FaRegHeart, FaHeart, FaShareAlt,
  FaTwitter, FaFacebook, FaWhatsapp, FaLinkedinIn, FaInstagram, FaEnvelope,
  FaBars
} from 'react-icons/fa';
import { formatTimeRemaining } from '@/lib/utils/utils/helpers/threadHelpers';
import { ThreadData } from '@/types';
import { getThreadAvatarSeed } from '@/lib/threads/display-identity';
import { createThreadInvite } from '@/lib/threads';
import { useToast } from '@/components/ui/Toast';
import { buildThreadPath } from '@/lib/threads/thread-url';

interface ThreadHeaderProps {
  thread: ThreadData | null;
  onLike: () => void;
  onToggleSidebar?: () => void;
  currentUserId?: string;
  onOpenPreview?: () => void;
}

// Deterministic identicon — matches design rules (no human photos in participant stack)
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
        fontSize: size * 0.38,
        color: 'rgba(255,255,255,0.92)',
      }}
    >
      {char}
    </div>
  );
}

const ThreadHeader: React.FC<ThreadHeaderProps> = ({
  thread,
  onLike,
  onToggleSidebar,
  currentUserId,
  onOpenPreview,
}) => {
  const [timeRemaining, setTimeRemaining] = useState('');
  const [showShareDropdown, setShowShareDropdown] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, right: 0 });
  const [resolvedShareUrl, setResolvedShareUrl] = useState('');
  const [isResolvingShareLink, setIsResolvingShareLink] = useState(false);
  const shareButtonRef = useRef<HTMLDivElement>(null);
  const { showToast } = useToast();
  const maxAvatars = 5;

  useEffect(() => {
    const updateTimer = () => {
      if (thread?.expiresAt) {
        setTimeRemaining(formatTimeRemaining(thread.expiresAt));
      } else if (thread?.isSaved) {
        setTimeRemaining('Never expires');
      } else {
        setTimeRemaining('');
      }
    };
    updateTimer();
    const timer = setInterval(updateTimer, 1000);
    return () => clearInterval(timer);
  }, [thread?.expiresAt, thread?.isSaved]);

  useEffect(() => {
    if (showShareDropdown && shareButtonRef.current) {
      const rect = shareButtonRef.current.getBoundingClientRect();
      setDropdownPosition({ top: rect.bottom + 8, right: window.innerWidth - rect.right });
    }
  }, [showShareDropdown]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (showShareDropdown) {
        const target = e.target as HTMLElement;
        if (!target.closest('.share-dropdown-container')) setShowShareDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showShareDropdown]);

  const threadPath = thread ? buildThreadPath({ id: thread.id, title: thread.title }) : '';
  const buildThreadShareUrl = useCallback(() =>
    typeof window !== 'undefined'
      ? `${window.location.origin}${threadPath}?from=share`
      : '', [threadPath]);

  const requiresInviteLink = thread?.privacy !== 'public';
  const isCreator = Boolean(
    thread && currentUserId && (thread.createdBy?.id === currentUserId || thread.authorId === currentUserId)
  );
  const defaultShareUrl = buildThreadShareUrl();
  const shareText = thread ? `Check out this discussion: ${thread.title}` : 'Check out this discussion';
  const canOpenPreview = typeof onOpenPreview === 'function';

  const resolveShareUrl = useCallback(async (forceNew = false) => {
    if (!thread) return defaultShareUrl;
    if (!requiresInviteLink) return defaultShareUrl;
    if (!isCreator) return '';
    if (!forceNew && resolvedShareUrl) return resolvedShareUrl;

    setIsResolvingShareLink(true);
    const { code, error } = await createThreadInvite(thread.id, null, 7, forceNew);
    setIsResolvingShareLink(false);

    if (error || !code) {
      showToast({ type: 'error', title: 'Invite link failed', message: error || 'Unable to generate invite link.', duration: 4000 });
      return defaultShareUrl;
    }
    const inviteUrl = `${window.location.origin}/invite/${code}`;
    setResolvedShareUrl(inviteUrl);
    return inviteUrl;
  }, [thread, requiresInviteLink, isCreator, resolvedShareUrl, showToast, defaultShareUrl]);

  useEffect(() => {
    if (!thread || !showShareDropdown || !requiresInviteLink || !isCreator) return;
    void resolveShareUrl();
  }, [thread, showShareDropdown, requiresInviteLink, isCreator, resolveShareUrl]);

  useEffect(() => { setResolvedShareUrl(''); }, [thread?.id, thread?.privacy, currentUserId]);

  if (!thread) return null;

  const getShareUrlOrNotify = async () => {
    const shareUrl = await resolveShareUrl();
    if (shareUrl) return shareUrl;
    showToast({ type: 'error', title: 'Invite link restricted', message: 'Only the discussion creator can share private-discussion invite links.', duration: 4000 });
    setShowShareDropdown(false);
    return null;
  };

  const handleCopyLink = async () => {
    try {
      const shareUrl = await getShareUrlOrNotify();
      if (!shareUrl) return;
      await navigator.clipboard.writeText(shareUrl);
      showToast({ type: 'success', title: 'Link copied', message: 'Share link copied to clipboard.', duration: 3000 });
    } catch {
      showToast({ type: 'error', title: 'Copy failed', message: 'Unable to copy share link.', duration: 4000 });
    }
    setShowShareDropdown(false);
  };

  const handleTwitterShare = async () => {
    const url = await getShareUrlOrNotify();
    if (!url) return;
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(url)}`, '_blank');
    setShowShareDropdown(false);
  };

  const handleFacebookShare = async () => {
    const url = await getShareUrlOrNotify();
    if (!url) return;
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`, '_blank');
    setShowShareDropdown(false);
  };

  const handleThreadsShare = async () => {
    const url = await getShareUrlOrNotify();
    if (!url) return;
    navigator.clipboard.writeText(url);
    showToast({ type: 'success', title: 'Link copied', message: 'Paste it in Threads.', duration: 3000 });
    setShowShareDropdown(false);
  };

  const handleWhatsappShare = async () => {
    const url = await getShareUrlOrNotify();
    if (!url) return;
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(shareText + ' ' + url)}`, '_blank');
    setShowShareDropdown(false);
  };

  const handleLinkedInShare = async () => {
    const url = await getShareUrlOrNotify();
    if (!url) return;
    window.open(`https://www.linkedin.com/shareArticle?mini=true&url=${encodeURIComponent(url)}&title=${encodeURIComponent(thread.title)}`, '_blank');
    setShowShareDropdown(false);
  };

  const handleInstagramShare = async () => {
    const url = await getShareUrlOrNotify();
    if (!url) return;
    navigator.clipboard.writeText(url);
    showToast({ type: 'success', title: 'Link copied', message: 'Paste it in Instagram.', duration: 3000 });
    setShowShareDropdown(false);
  };

  const handleEmailShare = async () => {
    const url = await getShareUrlOrNotify();
    if (!url) return;
    window.open(`mailto:?subject=${encodeURIComponent(shareText)}&body=${encodeURIComponent(url)}`, '_blank');
    setShowShareDropdown(false);
  };

  const visibleParticipants = thread.participants?.slice(0, maxAvatars) || [];
  const extraParticipants = (thread.participants?.length || 0) - maxAvatars;

  const ShareDropdown = () => {
    if (!showShareDropdown || typeof window === 'undefined') return null;

    const itemCls = 'flex items-center gap-2.5 px-4 py-2.5 text-sm text-[#8F8FA3] hover:text-[#F2F2F6] hover:bg-white/[0.04] w-full text-left transition-colors';

    return createPortal(
      <>
        <div className="fixed inset-0 z-[999]" onClick={() => setShowShareDropdown(false)} />
        <div
          className="fixed z-[1000] w-52 bg-[#1A1A24] border border-[#23232E] rounded-xl shadow-2xl py-1.5 share-dropdown-container"
          style={{ top: `${dropdownPosition.top}px`, right: `${dropdownPosition.right}px` }}
        >
          <button onClick={handleCopyLink} disabled={isResolvingShareLink} className={itemCls}>
            <FaShareAlt className="w-3.5 h-3.5" />
            {isResolvingShareLink ? 'Preparing…' : 'Copy link'}
          </button>
          <button onClick={handleTwitterShare} className={itemCls}><FaTwitter className="w-3.5 h-3.5 text-sky-400" />Share on Twitter</button>
          <button onClick={handleFacebookShare} className={itemCls}><FaFacebook className="w-3.5 h-3.5 text-blue-500" />Share on Facebook</button>
          <button onClick={handleThreadsShare} className={itemCls}><FaTwitter className="w-3.5 h-3.5" />Share on Threads</button>
          <button onClick={handleWhatsappShare} className={itemCls}><FaWhatsapp className="w-3.5 h-3.5 text-green-500" />Share on WhatsApp</button>
          <button onClick={handleLinkedInShare} className={itemCls}><FaLinkedinIn className="w-3.5 h-3.5 text-blue-600" />Share on LinkedIn</button>
          <button onClick={handleInstagramShare} className={itemCls}><FaInstagram className="w-3.5 h-3.5 text-pink-400" />Share on Instagram</button>
          <button onClick={handleEmailShare} className={itemCls}><FaEnvelope className="w-3.5 h-3.5 text-[#5C5C6E]" />Share via email</button>
        </div>
      </>,
      document.body
    );
  };

  return (
    <div className="bg-[#0E0E16] border-b border-[#23232E] flex-shrink-0 w-full overflow-hidden">
      <div className="px-3 md:px-4 py-2.5 md:py-3">
        <div className="flex items-center justify-between gap-2">

          {/* Left: identicons + title */}
          <div
            className={`flex items-center gap-2 md:gap-3 flex-1 min-w-0 ${canOpenPreview ? 'cursor-pointer' : ''}`}
            onClick={canOpenPreview ? onOpenPreview : undefined}
            onKeyDown={canOpenPreview ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpenPreview?.(); } } : undefined}
            role={canOpenPreview ? 'button' : undefined}
            tabIndex={canOpenPreview ? 0 : undefined}
            aria-label={canOpenPreview ? 'Open discussion preview' : undefined}
          >
            {/* Participant identicon stack */}
            <div className="flex-shrink-0 hidden sm:flex -space-x-2">
              {visibleParticipants.map(p => (
                <div key={p.id} className="ring-2 ring-[#0E0E16] rounded-[22%]">
                  <Identicon seed={getThreadAvatarSeed(p.id, thread?.id)} size={32} />
                </div>
              ))}
              {extraParticipants > 0 && (
                <div
                  className="w-8 h-8 rounded-[22%] ring-2 ring-[#0E0E16] flex items-center justify-center text-xs font-medium text-[#8F8FA3] bg-[#23232E]"
                >
                  +{extraParticipants}
                </div>
              )}
            </div>

            <div className="min-w-0 flex-1">
              <h1 className="text-[#F2F2F6] font-medium truncate text-sm md:text-base">
                {thread.title}
              </h1>
              <div className="flex items-center gap-1 md:gap-2 text-xs text-[#5C5C6E]">
                {thread.expiresAt && !thread.isSaved && (
                  <span className="text-[#EF9F27]">
                    {timeRemaining}
                  </span>
                )}
                {thread.isSaved && (
                  <span className="text-[#5DCAA5] hidden sm:inline">· Never expires</span>
                )}
              </div>
            </div>
          </div>

          {/* Right: actions */}
          <div className="flex items-center gap-1 md:gap-3">
            <button
              onClick={onToggleSidebar}
              className="lg:hidden text-[#5C5C6E] hover:text-[#F2F2F6] transition-colors p-2 rounded-lg hover:bg-white/[0.05]"
            >
              <FaBars className="w-4 h-4" />
            </button>

            <motion.button
              onClick={onLike}
              className="flex items-center gap-1 md:gap-1.5 text-[#5C5C6E] hover:text-[#F2F2F6] transition-colors px-1 py-1"
              whileTap={{ scale: 0.8 }}
            >
              {thread.hasLiked ? (
                <FaHeart className="text-[#E24B4A] w-4 h-4 md:w-5 md:h-5" />
              ) : (
                <FaRegHeart className="w-4 h-4 md:w-5 md:h-5" />
              )}
              <span className="text-xs md:text-sm">{thread.likes}</span>
            </motion.button>

            <div className="relative share-dropdown-container" ref={shareButtonRef}>
              <button
                onClick={() => setShowShareDropdown(!showShareDropdown)}
                className="text-[#5C5C6E] hover:text-[#F2F2F6] transition-colors p-2 rounded-lg hover:bg-white/[0.05]"
                title="Share discussion"
              >
                <FaShareAlt className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
      <ShareDropdown />
    </div>
  );
};

export default ThreadHeader;
