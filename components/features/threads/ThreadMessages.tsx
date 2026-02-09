import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FaReply, FaMicrophone, FaRegLaugh, FaRegLaughBeam,
  FaRegHeart, FaHeart, FaRegSmile, FaRegAngry, FaAngry, FaSpinner, FaCheckCircle, FaTimesCircle
} from 'react-icons/fa';
import { FiImage, FiFile } from 'react-icons/fi';
import { Attachment, Message, ReactionType } from '@/types';
import { formatTimestamp } from '@/lib/utils/utils/helpers/threadHelpers';
import MessageUserButton from './MessageUserButton';
import { getAvatarUrl } from '@/lib/utils/avatar';

interface ThreadMessagesProps {
  messages: Message[];
  currentUserId: string;
  threadId: string;
  threadCreatorId: string; // ID of the thread creator
  onReply: (message: Message) => void;
  onReact: (messageId: string, reaction: string) => void;
  getRepliedMessage: (messageId: string) => Message | undefined;
  messageFilter?: { senderId?: string; keyword?: string };
  typingUsers?: string[]; // Added typingUsers prop
  onRetry?: (message: Message) => void; // Added onRetry prop
}

const ThreadMessages: React.FC<ThreadMessagesProps> = ({
  messages,
  currentUserId,
  threadId,
  threadCreatorId,
  onReply,
  onReact,
  messageFilter,
  typingUsers = [], // Default to empty array
  onRetry
}) => {
  const messagesEndRef = React.useRef<HTMLDivElement>(null);
  const messagesContainerRef = React.useRef<HTMLDivElement>(null);

  const messagesMap = useMemo(() => {
    const map: { [key: string]: Message } = {};
    messages.forEach(msg => map[msg.id] = msg);
    return map;
  }, [messages]);

  const getRepliedMessage = (messageId: string) => messagesMap[messageId];

  const visibleMessages = useMemo(() => {
    if (!messageFilter) return messages;

    let filtered = messages;

    if (messageFilter.senderId) {
      filtered = filtered.filter(msg => msg.sender.id === messageFilter.senderId);
    }

    if (messageFilter.keyword) {
      const keywordLower = messageFilter.keyword.toLowerCase();
      filtered = filtered.filter(msg =>
        msg.content.toLowerCase().includes(keywordLower) ||
        msg.sender.name.toLowerCase().includes(keywordLower)
      );
    }

    return filtered;
  }, [messages, messageFilter]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    const scrollToBottom = () => {
      if (messagesEndRef.current) {
        messagesEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
      }
    };

    // Small delay to ensure DOM has updated
    const timeoutId = setTimeout(scrollToBottom, 100);
    return () => clearTimeout(timeoutId);
  }, [visibleMessages]);

  return (
    <div ref={messagesContainerRef} className="px-3 md:px-4 py-4 space-y-4 w-full max-w-full overflow-x-hidden scroll-smooth">
      <AnimatePresence mode="popLayout">
        {visibleMessages.map((message, index) => (
          <motion.div
            key={message.id}
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{
              duration: 0.3,
              delay: index * 0.05,
              ease: [0.4, 0, 0.2, 1]
            }}
          >
            <div id={`message-${message.id}`} className="transition-colors duration-1000">
              <MessageItem
                message={message}
                threadId={threadId}
                threadCreatorId={threadCreatorId}
                onReply={onReply}
                onReact={onReact}
                isCurrentUser={message.sender.id === currentUserId}
                currentUserId={currentUserId}
                getRepliedMessage={getRepliedMessage}
                onQuoteClick={(id) => {
                  const el = document.getElementById(`message-${id}`);
                  if (el) {
                    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    el.classList.add('bg-purple-900/20');
                    setTimeout(() => el.classList.remove('bg-purple-900/20'), 2000);
                  }
                }}
                onRetry={onRetry}
              />
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
      {/* Invisible div at the end to scroll to */}
      <div ref={messagesEndRef} />

      {/* Typing Indicator */}
      <AnimatePresence>
        {typingUsers && typingUsers.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="px-4 pb-2"
          >
            <div className="flex items-center gap-2 text-sm text-gray-400 italic">
              <div className="flex gap-1">
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.15s]" />
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" />
              </div>
              <span>
                {typingUsers.length === 1
                  ? 'Someone is typing...'
                  : `${typingUsers.length} people are typing...`}
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div >
  );
};

const MessageItem: React.FC<{
  message: Message;
  threadId: string;
  threadCreatorId: string; // ID of the thread creator
  onReply: (message: Message) => void;
  onReact: (messageId: string, reaction: string) => void;
  isCurrentUser: boolean;
  currentUserId: string;
  getRepliedMessage: (messageId: string) => Message | undefined;
  onQuoteClick?: (messageId: string) => void;
  onRetry?: (message: Message) => void;
}> = ({ message, threadId, threadCreatorId, onReply, onReact, isCurrentUser, currentUserId, getRepliedMessage, onQuoteClick, onRetry }) => {
  const [showReactions, setShowReactions] = useState(false);
  const [pickerPosition, setPickerPosition] = useState<{ top: number; left: number; showBelow: boolean }>({
    top: 0,
    left: 0,
    showBelow: false
  });
  const buttonRef = React.useRef<HTMLButtonElement>(null);
  const repliedMessage = message.replyToId ? getRepliedMessage(message.replyToId) : null;

  const handleReaction = (reaction: string) => {
    onReact(message.id, reaction);
    setShowReactions(false);
  };

  const toggleReactionPicker = () => {
    if (!showReactions && buttonRef.current) {
      // Get button position in viewport
      const rect = buttonRef.current.getBoundingClientRect();
      const spaceAbove = rect.top;
      const spaceBelow = window.innerHeight - rect.bottom;
      const showBelow = spaceAbove < 100 && spaceBelow > 100;

      // Calculate fixed position for portal
      setPickerPosition({
        top: showBelow ? rect.bottom + 8 : rect.top - 60, // 60px = approx picker height
        left: rect.left,
        showBelow
      });
    }
    setShowReactions(!showReactions);
  };

  const userHasReacted = (reactionType: string) => {
    return message.reactions?.[reactionType as ReactionType]?.users.includes(currentUserId);
  };

  const reactionIcons = {
    'like': <FaRegHeart className="w-4 h-4" />,
    'love': <FaHeart className="w-4 h-4 text-red-500" />,
    'laugh': <FaRegLaughBeam className="w-4 h-4 text-yellow-500" />,
    'angry': <FaAngry className="w-4 h-4 text-orange-500" />,
  };

  const renderAttachment = (attachment: Attachment) => {
    if (attachment.type === 'file') {
      return attachment.fileType === 'image' ? (
        <div className="relative max-w-[200px] overflow-hidden rounded-lg">
          <img
            src={attachment.url}
            alt={attachment.fileName}
            className="w-full h-auto object-cover max-h-48"
          />
          <div className="absolute top-2 right-2 p-1 rounded bg-black/50">
            <FiImage className="w-4 h-4 text-white" />
          </div>
        </div>
      ) : (
        <div className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-800 border border-gray-700">
          <FiFile className="w-4 h-4 text-blue-400" />
          <span className="text-sm text-gray-200">{attachment.fileName}</span>
        </div>
      );
    }

    if (attachment.type === 'voice') {
      return (
        <div className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-800 border border-gray-700">
          <FaMicrophone className="w-4 h-4 text-green-400" />
          <span className="text-sm text-gray-200">Voice: {attachment.duration}s</span>
        </div>
      );
    }

    // Handle LinkAttachment
    if (attachment.type === 'link') {
      return (
        <div className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-800 border border-gray-700">
          <FiFile className="w-4 h-4 text-blue-400" />
          <span className="text-sm text-gray-200">{attachment.title}</span>
        </div>
      );
    }

    // Handle ImageAttachment
    return (
      <div className="relative max-w-[200px] overflow-hidden rounded-lg">
        <img
          src={attachment.url}
          alt={attachment.fileName || 'Image'}
          className="w-full h-auto object-cover max-h-48"
        />
      </div>
    );
  };

  return (
    <div className={`space-y-3 w-full max-w-full overflow-visible hover:bg-gray-900/30 rounded-xl p-2 transition-all duration-200 ${message.status === 'sending' ? 'opacity-70' : ''}`}>
      {repliedMessage && (
        <motion.div
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          className="ml-0 p-3 bg-gradient-to-r from-purple-900/20 to-transparent rounded-lg border-l-2 border-purple-500 mb-2 cursor-pointer w-full max-w-full hover:from-purple-900/30 transition-all"
          onClick={() => onQuoteClick?.(repliedMessage.id)}
        >
          <div className="flex items-center gap-2 mb-1">
            <img
              src={getAvatarUrl(repliedMessage.sender.id)}
              alt={repliedMessage.sender.name}
              className="w-6 h-6 rounded-full border border-purple-500/50 ring-1 ring-purple-500/20"
            />
            <span className="text-sm font-semibold text-purple-400">
              {repliedMessage.sender.id === currentUserId ? 'You' : repliedMessage.sender.name}
            </span>
          </div>
          <p className="text-sm text-gray-300 line-clamp-2 break-words">
            {repliedMessage.content || 'Attachment'}
          </p>
        </motion.div>
      )}

      <div className="flex gap-2 md:gap-4 group relative w-full max-w-full">
        <motion.div
          className="flex-shrink-0"
          whileHover={{ scale: 1.1 }}
          transition={{ type: "spring", stiffness: 400 }}
        >
          <img
            src={getAvatarUrl(message.sender.id)}
            alt={message.sender.name}
            className="w-8 h-8 md:w-10 md:h-10 rounded-full border-2 border-gray-700 object-cover ring-2 ring-purple-500/20 hover:ring-purple-500/40 transition-all"
          />
        </motion.div>

        <div className="flex-1 min-w-0 space-y-2 max-w-full overflow-hidden">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-white truncate bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
              {isCurrentUser ? 'You' : message.sender.name}
            </span>
            <span className="text-xs text-gray-500 font-medium flex items-center gap-1">
              {formatTimestamp(message.timestamp)}
              {message.status === 'sending' && <FaSpinner className="animate-spin w-3 h-3 text-purple-400" />}
              {message.status === 'sent' && <FaCheckCircle className="w-3 h-3 text-green-500" />}
              {message.status === 'error' && (
                <button
                  onClick={() => onRetry?.(message)}
                  className="flex items-center gap-1 text-red-500 hover:text-red-400 text-xs font-bold underline"
                >
                  <FaTimesCircle className="w-3 h-3" /> Retry
                </button>
              )}
            </span>
            {/* Show creator badge only if this message is from the thread creator */}
            {message.sender.id === threadCreatorId && (
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="text-xs px-2 py-0.5 rounded-full bg-gradient-to-r from-purple-600 to-pink-600 text-white flex-shrink-0 font-semibold shadow-lg shadow-purple-500/30"
              >
                ✨ creator
              </motion.span>
            )}
          </div>

          <p className="text-gray-100 whitespace-pre-wrap break-words overflow-wrap-anywhere w-full text-[15px] leading-relaxed">{message.content}</p>

          {message.attachments && (
            <div className="flex flex-wrap gap-3">
              {message.attachments.map((attachment, index) => (
                <React.Fragment key={index}>
                  {renderAttachment(attachment)}
                </React.Fragment>
              ))}
            </div>
          )}

          {message.reactions && Object.entries(message.reactions).length > 0 && (
            <div className="flex items-center gap-2">
              {Object.entries(message.reactions).map(([reaction, { count }]) => (
                <motion.button
                  key={reaction}
                  onClick={() => handleReaction(reaction)}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs transition-colors ${userHasReacted(reaction)
                    ? 'bg-purple-600/80 text-white'
                    : 'bg-gray-800 hover:bg-gray-700 text-gray-300'
                    }`}
                  whileTap={{ scale: 0.8 }}
                >
                  {reactionIcons[reaction as keyof typeof reactionIcons]}
                  <span>{count}</span>
                </motion.button>
              ))}
            </div>
          )}

          <div className="flex items-center gap-4 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
            <button
              ref={buttonRef}
              onClick={toggleReactionPicker}
              className="text-gray-400 hover:text-gray-200 transition-colors"
              title="Add reaction"
            >
              <FaRegLaugh className="w-4 h-4" />
            </button>

            <button
              onClick={() => onReply(message)}
              className="inline-flex items-center gap-1.5 text-gray-400 hover:text-gray-200 transition-colors text-sm"
            >
              <FaReply className="w-3.5 h-3.5" />
              Quote
            </button>

            {!isCurrentUser && (
              <MessageUserButton
                userId={message.sender.id}
                userAnonymousId={message.sender.name}
                threadId={threadId}
                variant="icon"
              />
            )}
          </div>

          {showReactions && typeof window !== 'undefined' && createPortal(
            <>
              {/* Invisible backdrop to close picker */}
              <div
                className="fixed inset-0 z-[1001]"
                onClick={() => setShowReactions(false)}
              />
              <div
                className="fixed z-[1002] bg-gray-800 rounded-full p-1.5 flex gap-1 shadow-xl border border-gray-700"
                style={{
                  top: `${pickerPosition.top}px`,
                  left: `${pickerPosition.left}px`,
                }}
              >
                {Object.entries({
                  laugh: <FaRegLaughBeam className="w-5 h-5 hover:text-yellow-500" />,
                  love: <FaRegHeart className="w-5 h-5 hover:text-red-500" />,
                  like: <FaRegSmile className="w-5 h-5 hover:text-blue-500" />,
                  angry: <FaRegAngry className="w-5 h-5 hover:text-orange-500" />,
                }).map(([reaction, icon]) => (
                  <button
                    key={reaction}
                    onClick={() => handleReaction(reaction)}
                    className="p-1.5 rounded-full hover:bg-gray-700 transition-all hover:scale-110"
                  >
                    {icon}
                  </button>
                ))}
              </div>
            </>,
            document.body
          )}
        </div>
      </div>
    </div>
  );
};

export default ThreadMessages;
