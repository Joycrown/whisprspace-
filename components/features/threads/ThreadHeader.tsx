/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import {
  FaRegHeart,
  FaHeart,
  FaShareAlt,
  FaTwitter, FaFacebook, FaWhatsapp, FaLinkedinIn, FaInstagram, FaEnvelope,
  FaBars
} from 'react-icons/fa';
import { formatTimeRemaining } from '@/lib/utils/utils/helpers/threadHelpers';
import { ThreadData } from '@/types';

interface ThreadHeaderProps {
  thread: ThreadData | null;
  onLike: () => void;
  onToggleSidebar?: () => void;
}

const ThreadHeader: React.FC<ThreadHeaderProps> = ({
  thread,
  onLike,
  onToggleSidebar
}) => {
  const [timeRemaining, setTimeRemaining] = useState('');
  const [showShareDropdown, setShowShareDropdown] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, right: 0 });
  const shareButtonRef = useRef<HTMLDivElement>(null);
  const maxAvatars = 5;

  useEffect(() => {
    const updateTimer = () => {
      if (thread?.expiresAt) {
        setTimeRemaining(formatTimeRemaining(thread.expiresAt));
      } else if (thread?.isSaved) {
        setTimeRemaining('Saved (Never expires)');
      } else {
        setTimeRemaining('');
      }
    };

    updateTimer();
    const timer = setInterval(updateTimer, 1000);
    return () => clearInterval(timer);
  }, [thread?.expiresAt, thread?.isSaved]);

  // Update dropdown position when shown
  useEffect(() => {
    if (showShareDropdown && shareButtonRef.current) {
      const rect = shareButtonRef.current.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + 8,
        right: window.innerWidth - rect.right,
      });
    }
  }, [showShareDropdown]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (showShareDropdown) {
        const target = e.target as HTMLElement;
        if (!target.closest('.share-dropdown-container')) {
          setShowShareDropdown(false);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showShareDropdown]);

  if (!thread) return null;

  const threadPath = `/threads/${thread.id}`;
  const threadUrl = typeof window !== 'undefined' ? `${window.location.origin}${threadPath}` : '';
  const shareUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/auth?redirect=${encodeURIComponent(threadPath)}`
    : '';
  const shareText = `Check out this thread: ${thread.title}`;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      alert('Link copied to clipboard!');
    } catch (err) {
      console.error('Failed to copy: ', err);
    }
    setShowShareDropdown(false);
  };

  const handleTwitterShare = () => {
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`, '_blank');
    setShowShareDropdown(false);
  };

  const handleFacebookShare = () => {
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`, '_blank');
    setShowShareDropdown(false);
  };

  const handleThreadsShare = () => {
    // Threads does not have a direct sharing intent URL like Twitter or Facebook.
    // A common workaround is to copy the link and instruct the user to paste it.
    // For a more integrated experience, one might need to use their API if available, or a universal share dialog.
    // For now, we'll copy the link and open Threads (if a universal link exists or prompt user).
    navigator.clipboard.writeText(shareUrl);
    alert('Link copied to clipboard. Please paste it in Threads.');
    // Optionally open Threads app/web if a universal link is known.
    setShowShareDropdown(false);
  };

  const handleWhatsappShare = () => {
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(shareText + " " + shareUrl)}`, '_blank');
    setShowShareDropdown(false);
  };

  const handleLinkedInShare = () => {
    window.open(`https://www.linkedin.com/shareArticle?mini=true&url=${encodeURIComponent(shareUrl)}&title=${encodeURIComponent(thread.title)}&summary=${encodeURIComponent(thread.content || '')}`, '_blank');
    setShowShareDropdown(false);
  };

  const handleInstagramShare = () => {
    // Instagram sharing is complex, usually done via their app with specific APIs.
    // A direct web intent is not straightforward for posts/stories like other platforms.
    // For now, we'll copy the link and inform the user.
    navigator.clipboard.writeText(shareUrl);
    alert('Link copied to clipboard. Please paste it in Instagram.');
    setShowShareDropdown(false);
  };

  const handleEmailShare = () => {
    window.open(`mailto:?subject=${encodeURIComponent(shareText)}&body=${encodeURIComponent(shareUrl)}`, '_blank');
    setShowShareDropdown(false);
  };

  const visibleParticipants = thread.participants?.slice(0, maxAvatars) || [];
  const extraParticipants = (thread.participants?.length || 0) - maxAvatars;

  // Share dropdown component
  const ShareDropdown = () => {
    if (!showShareDropdown || typeof window === 'undefined') return null;

    return createPortal(
      <>
        {/* Invisible backdrop */}
        <div
          className="fixed inset-0 z-[999]"
          onClick={() => setShowShareDropdown(false)}
        />
        <div
          className="fixed z-[1000] w-56 bg-gray-700 rounded-md shadow-xl py-1 share-dropdown-container"
          style={{
            top: `${dropdownPosition.top}px`,
            right: `${dropdownPosition.right}px`,
          }}
        >
          <button
            onClick={handleCopyLink}
            className="flex items-center gap-2 px-4 py-2 text-sm text-white hover:bg-gray-600 w-full text-left"
          >
            <FaShareAlt className="w-4 h-4" />
            Copy Link
          </button>
          <button
            onClick={handleTwitterShare}
            className="flex items-center gap-2 px-4 py-2 text-sm text-white hover:bg-gray-600 w-full text-left"
          >
            <FaTwitter className="w-4 h-4 text-blue-400" />
            Share on Twitter
          </button>
          <button
            onClick={handleFacebookShare}
            className="flex items-center gap-2 px-4 py-2 text-sm text-white hover:bg-gray-600 w-full text-left"
          >
            <FaFacebook className="w-4 h-4 text-blue-600" />
            Share on Facebook
          </button>
          <button
            onClick={handleThreadsShare}
            className="flex items-center gap-2 px-4 py-2 text-sm text-white hover:bg-gray-600 w-full text-left"
          >
            <FaTwitter className="w-4 h-4" />
            Share on Threads
          </button>
          <button
            onClick={handleWhatsappShare}
            className="flex items-center gap-2 px-4 py-2 text-sm text-white hover:bg-gray-600 w-full text-left"
          >
            <FaWhatsapp className="w-4 h-4 text-green-500" />
            Share on WhatsApp
          </button>
          <button
            onClick={handleLinkedInShare}
            className="flex items-center gap-2 px-4 py-2 text-sm text-white hover:bg-gray-600 w-full text-left"
          >
            <FaLinkedinIn className="w-4 h-4 text-blue-700" />
            Share on LinkedIn
          </button>
          <button
            onClick={handleInstagramShare}
            className="flex items-center gap-2 px-4 py-2 text-sm text-white hover:bg-gray-600 w-full text-left"
          >
            <FaInstagram className="w-4 h-4 text-pink-500" />
            Share on Instagram
          </button>
          <button
            onClick={handleEmailShare}
            className="flex items-center gap-2 px-4 py-2 text-sm text-white hover:bg-gray-600 w-full text-left"
          >
            <FaEnvelope className="w-4 h-4 text-gray-400" />
            Share via Email
          </button>
        </div>
      </>,
      document.body
    );
  };

  return (
    <div className="bg-gray-800/95 backdrop-blur-md border-b border-gray-800 flex-shrink-0 w-full max-w-full overflow-hidden"> {/* Enhanced background for fixed positioning */}
      <div className="px-3 md:px-4 py-2 md:py-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 md:gap-3 flex-1 min-w-0">
            <div className="flex-shrink-0 hidden sm:block">
              <div className="flex -space-x-3">
                {visibleParticipants.map(participant => (
                  <img
                    key={participant.id}
                    src={participant.avatar}
                    alt={participant.name}
                    className="w-8 h-8 md:w-9 md:h-9 rounded-full border-2 border-gray-900 object-cover"
                  />
                ))}
                {extraParticipants > 0 && (
                  <div className="w-8 h-8 md:w-9 md:h-9 rounded-full bg-gray-800 border-2 border-gray-900 flex items-center justify-center text-xs font-medium text-white">
                    +{extraParticipants}
                  </div>
                )}
              </div>
            </div>

            <div className="min-w-0 flex-1">
              <h1 className="text-white font-medium truncate text-sm md:text-base">
                {thread.title}
              </h1>
              <div className="flex items-center gap-1 md:gap-2 text-xs md:text-sm text-gray-400">
                <span className="truncate">By {thread.createdBy?.name || 'Anonymous'}</span>
                <span className="hidden sm:inline">•</span>
                {thread.expiresAt && !thread.isSaved && (
                  <span className="text-orange-500 hidden sm:inline">
                    Expires: {new Date(thread.expiresAt).toLocaleString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })} ({timeRemaining})
                  </span>
                )}
                {thread.isSaved && (
                  <span className="text-green-500 hidden sm:inline">Saved (Never expires)</span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 md:gap-4">
            {/* Mobile Sidebar Toggle */}
            <button
              onClick={onToggleSidebar}
              className="lg:hidden text-gray-400 hover:text-white transition-colors p-2 rounded-lg hover:bg-gray-700"
            >
              <FaBars className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 md:gap-4">
              <motion.button
                onClick={onLike}
                className="flex items-center gap-1 md:gap-1.5 hover:opacity-80 transition-opacity"
                whileTap={{ scale: 0.8 }}
              >
                {thread.hasLiked ? (
                  <FaHeart className="text-red-500 w-4 h-4 md:w-5 md:h-5" />
                ) : (
                  <FaRegHeart className="text-gray-400 w-4 h-4 md:w-5 md:h-5" />
                )}
                <span className="text-xs md:text-sm text-gray-400">{thread.likes}</span>
              </motion.button>
            </div>

            <div className="relative share-dropdown-container" ref={shareButtonRef}>
              <button
                onClick={() => setShowShareDropdown(!showShareDropdown)}
                className="text-gray-400 hover:text-white transition-colors p-2 rounded-full hover:bg-gray-700"
                title="Share thread"
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
