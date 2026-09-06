'use client'
import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import {
  FaPaperPlane, FaImage, FaTimes, FaPaperclip
} from 'react-icons/fa';
import { Message, Participant } from '@/types';

type MentionSuggestion = {
  id: string;
  handle: string;
  displayName: string;
  secondaryLabel?: string;
  messageCount: number;
};

interface ThreadInputProps {
  onSendMessage: (message: string, attachments?: File[]) => void;
  replyPreview?: string;
  onCancelReply?: () => void;
  replyTo: Message | null;
  onTypingStart?: () => void;
  onTypingEnd?: () => void;
  participants?: Participant[];
  currentUserId?: string;
  isLoading?: boolean;
  isDisabled?: boolean;
  disabledMessage?: string;
}

const ThreadInput: React.FC<ThreadInputProps> = ({
  onSendMessage,
  replyPreview,
  onCancelReply,
  onTypingStart,
  onTypingEnd,
  participants = [],
  currentUserId,
  isLoading,
  isDisabled = false,
  disabledMessage
}) => {
  const [message, setMessage] = useState('');
  const [attachments, setAttachments] = useState<File[]>([]);
  const [isMentionMenuOpen, setIsMentionMenuOpen] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionStartIndex, setMentionStartIndex] = useState<number | null>(null);
  const [activeMentionIndex, setActiveMentionIndex] = useState(0);

  const imageInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Thread senders are no longer identified, so there is no handle to mention.
  // Offering one would expose the persistent anonymous_id this is meant to hide.
  const MENTIONS_ENABLED_IN_THREADS = false;

  const mentionCandidates = useMemo<MentionSuggestion[]>(() => {
    if (!MENTIONS_ENABLED_IN_THREADS) return [];

    const isMentionSafe = (value?: string) => {
      if (!value) return false;
      return /^[a-zA-Z0-9_]+$/.test(value);
    };

    const isAnonymousId = (value?: string) => {
      if (!value) return false;
      return /^ANON_\d{8}$/i.test(value);
    };

    const seenHandles = new Set<string>();

    return participants
      .filter((participant) => participant.id && participant.id !== currentUserId)
      .map((participant) => {
        const name = (participant.name || '').trim();
        const anonymousId = (participant.anonymousId || '').trim();

        const anonHandle = isMentionSafe(anonymousId) ? anonymousId : null;
        const nameHandle = isMentionSafe(name) && isAnonymousId(name) ? name : null;

        const handle = anonHandle || nameHandle;
        if (!handle) return null;

        const lowerHandle = handle.toLowerCase();
        if (seenHandles.has(lowerHandle)) return null;
        seenHandles.add(lowerHandle);

        return {
          id: participant.id,
          handle,
          displayName: handle,
          messageCount: participant.messageCount || 0,
        };
      })
      .filter((entry): entry is MentionSuggestion => Boolean(entry))
      .sort((a, b) => {
        if (b.messageCount !== a.messageCount) {
          return b.messageCount - a.messageCount;
        }
        return a.displayName.localeCompare(b.displayName);
      });
  }, [participants, currentUserId]);

  const filteredMentionSuggestions = useMemo(() => {
    const normalizedQuery = mentionQuery.toLowerCase();

    return mentionCandidates
      .filter((candidate) => {
        if (!normalizedQuery) return true;
        if (candidate.handle.toLowerCase().includes(normalizedQuery)) return true;
        if (candidate.displayName.toLowerCase().includes(normalizedQuery)) return true;
        if (candidate.secondaryLabel?.toLowerCase().includes(normalizedQuery)) return true;
        return false;
      })
      .slice(0, 8);
  }, [mentionCandidates, mentionQuery]);

  const closeMentionMenu = useCallback(() => {
    setIsMentionMenuOpen(false);
    setMentionQuery('');
    setMentionStartIndex(null);
    setActiveMentionIndex(0);
  }, []);

  const updateMentionContext = useCallback(
    (nextValue: string, cursorPosition: number | null) => {
      if (cursorPosition === null || mentionCandidates.length === 0) {
        closeMentionMenu();
        return;
      }

      const textBeforeCursor = nextValue.slice(0, cursorPosition);
      const atIndex = textBeforeCursor.lastIndexOf('@');

      if (atIndex < 0) {
        closeMentionMenu();
        return;
      }

      if (atIndex > 0) {
        const charBeforeAt = textBeforeCursor.charAt(atIndex - 1);
        if (/[a-zA-Z0-9_]/.test(charBeforeAt)) {
          closeMentionMenu();
          return;
        }
      }

      const tokenAfterAt = textBeforeCursor.slice(atIndex + 1);

      if (tokenAfterAt.length > 32 || /[^a-zA-Z0-9_]/.test(tokenAfterAt)) {
        closeMentionMenu();
        return;
      }

      setMentionStartIndex(atIndex);
      setMentionQuery(tokenAfterAt);
      setActiveMentionIndex(0);
      setIsMentionMenuOpen(true);
    },
    [mentionCandidates.length, closeMentionMenu]
  );

  const syncMentionContextFromTextarea = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) {
      closeMentionMenu();
      return;
    }

    updateMentionContext(textarea.value, textarea.selectionStart);
  }, [updateMentionContext, closeMentionMenu]);

  const applyMentionSelection = useCallback(
    (candidate: MentionSuggestion) => {
      const textarea = textareaRef.current;
      if (!textarea) return;

      const cursorPosition = textarea.selectionStart ?? message.length;
      const safeMentionStart =
        mentionStartIndex !== null && mentionStartIndex <= cursorPosition
          ? mentionStartIndex
          : message.slice(0, cursorPosition).lastIndexOf('@');

      if (safeMentionStart < 0) return;

      const replacement = `@${candidate.handle} `;
      const nextMessage =
        message.slice(0, safeMentionStart) +
        replacement +
        message.slice(cursorPosition);

      setMessage(nextMessage);
      closeMentionMenu();

      window.requestAnimationFrame(() => {
        const nextCursorPosition = safeMentionStart + replacement.length;
        textarea.focus();
        textarea.setSelectionRange(nextCursorPosition, nextCursorPosition);
      });
    },
    [message, mentionStartIndex, closeMentionMenu]
  );

  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 128)}px`;
    }
  }, [message]);

  useEffect(() => {
    if (!isMentionMenuOpen) return;
    if (filteredMentionSuggestions.length > 0) return;
    closeMentionMenu();
  }, [isMentionMenuOpen, filteredMentionSuggestions.length, closeMentionMenu]);

  useEffect(() => {
    if (!isMentionMenuOpen) return;
    if (activeMentionIndex < filteredMentionSuggestions.length) return;
    setActiveMentionIndex(0);
  }, [activeMentionIndex, filteredMentionSuggestions.length, isMentionMenuOpen]);

  const handleSend = () => {
    if (isDisabled) return;
    if (message.trim() || attachments.length > 0) {
      onSendMessage(message, attachments);
      setMessage('');
      setAttachments([]);
      closeMentionMenu();
      onTypingEnd?.();
      onCancelReply?.();
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      const imageFiles = Array.from(files).filter((file) => file.type.startsWith('image/'));
      if (imageFiles.length === 0) return;
      setAttachments(prev => [...prev, ...imageFiles]);
    }
  };

  return (
    <div className="bg-gray-700 border-t border-gray-800 p-3 pb-5 md:p-4 w-full">
      <div className="max-w-4xl mx-auto">
        {isDisabled && (
          <div className="mb-3 text-xs md:text-sm text-red-300 bg-red-900/30 border border-red-800 rounded px-3 py-2">
            {disabledMessage || 'You cannot send messages in this discussion.'}
          </div>
        )}
        {replyPreview && (
          <div className="mb-2 text-sm text-gray-400 bg-gray-800 p-2 rounded flex justify-between items-center">
            <span>{replyPreview}</span>
            <button
              onClick={onCancelReply}
              className="text-red-500 hover:text-red-400"
            >
              <FaTimes className="w-4 h-4" />
            </button>
          </div>
        )}

        {attachments.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-2 mb-2 px-1 scrollbar-hide">
            {attachments.map((file, i) => (
              <div key={i} className="relative group flex-shrink-0">
                {file.type.startsWith('image/') ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={URL.createObjectURL(file)}
                    alt="Preview"
                    className="h-20 w-20 object-cover rounded-lg border border-gray-600"
                    onLoad={(e) => URL.revokeObjectURL(e.currentTarget.src)}
                  />
                ) : (
                  <div className="h-20 w-20 bg-gray-800 rounded-lg flex flex-col items-center justify-center border border-gray-600 p-2 text-center">
                    <FaPaperclip className="text-gray-400 mb-1" />
                    <span className="text-[10px] text-gray-300 truncate w-full">{file.name}</span>
                  </div>
                )}
                <button
                  onClick={() => setAttachments(prev => prev.filter((_, idx) => idx !== i))}
                  className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-lg hover:bg-red-600 transition-colors z-10"
                  type="button"
                >
                  <FaTimes size={10} />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-end gap-2 w-full max-w-full">
          <div className="relative flex items-end bg-gray-800 rounded-2xl flex-1 min-w-0 min-h-[44px] max-w-full">
            {isMentionMenuOpen && filteredMentionSuggestions.length > 0 && (
              <div className="absolute bottom-full left-0 right-0 mb-2 max-h-56 overflow-y-auto rounded-xl border border-gray-700 bg-[#111827] shadow-2xl z-30">
                {filteredMentionSuggestions.map((candidate, index) => {
                  const isActive = index === activeMentionIndex;
                  return (
                    <button
                      key={`${candidate.id}-${candidate.handle}`}
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        applyMentionSelection(candidate);
                      }}
                      className={`w-full px-3 py-2 text-left flex items-center gap-3 transition-colors ${isActive ? 'bg-indigo-600/30' : 'hover:bg-gray-700/60'}`}
                    >
                      <div className="h-8 w-8 rounded-full bg-indigo-500/30 border border-indigo-400/40 flex items-center justify-center text-xs font-semibold text-indigo-200 flex-shrink-0">
                        {(candidate.displayName || candidate.handle).charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-white truncate">
                          {candidate.displayName}
                        </p>
                        <p className="text-xs text-gray-300 truncate">
                          @{candidate.handle}
                          {candidate.secondaryLabel ? ` · ${candidate.secondaryLabel}` : ''}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            <textarea
              ref={textareaRef}
              placeholder="Type your message..."
              value={message}
              onChange={(e) => {
                const nextValue = e.target.value;
                setMessage(nextValue);
                onTypingStart?.();
                updateMentionContext(nextValue, e.target.selectionStart);
              }}
              onBlur={() => {
                onTypingEnd?.();
                window.setTimeout(() => {
                  closeMentionMenu();
                }, 100);
              }}
              className="w-full min-w-0 max-w-full bg-transparent p-2 md:p-3 rounded-2xl focus:outline-none text-base md:text-base resize-none overflow-y-auto"
              onKeyDown={(e) => {
                if (isMentionMenuOpen && filteredMentionSuggestions.length > 0) {
                  if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    setActiveMentionIndex((prev) =>
                      prev + 1 >= filteredMentionSuggestions.length ? 0 : prev + 1
                    );
                    return;
                  }

                  if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    setActiveMentionIndex((prev) =>
                      prev - 1 < 0 ? filteredMentionSuggestions.length - 1 : prev - 1
                    );
                    return;
                  }

                  if ((e.key === 'Enter' && !e.shiftKey) || e.key === 'Tab') {
                    e.preventDefault();
                    const selected = filteredMentionSuggestions[activeMentionIndex];
                    if (selected) {
                      applyMentionSelection(selected);
                    }
                    return;
                  }

                  if (e.key === 'Escape') {
                    e.preventDefault();
                    closeMentionMenu();
                    return;
                  }
                }

                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              onKeyUp={syncMentionContextFromTextarea}
              onClick={syncMentionContextFromTextarea}
              rows={1}
              inputMode="text"
              autoComplete="off"
              autoCapitalize="sentences"
              spellCheck="true"
              disabled={isDisabled}
              style={{
                scrollbarWidth: 'thin',
                scrollbarColor: '#4B5563 transparent',
                minHeight: '44px',
                maxHeight: '128px',
                touchAction: 'manipulation',
              }}
            />

            <div className={`flex items-center gap-2 mr-2 mb-2 ${(isLoading || isDisabled) ? 'opacity-50 pointer-events-none' : ''}`}>
              <input
                type="file"
                accept="image/*"
                multiple
                hidden
                ref={imageInputRef}
                onChange={handleFileUpload}
                disabled={isDisabled}
              />
              <button
                onClick={() => imageInputRef.current?.click()}
                className="text-gray-400 hover:text-purple-400 transition-colors p-1"
                type="button"
                disabled={isDisabled}
              >
                <FaImage className="w-5 h-5" />
              </button>
            </div>
          </div>

          <button
            onClick={handleSend}
            disabled={isDisabled || (!message.trim() && attachments.length === 0)}
            className={`p-2.5 md:p-3 rounded-full transition-colors flex-shrink-0 mb-1 ${(!message.trim() && attachments.length === 0)
              ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
              : 'bg-gradient-to-br from-purple-900 to-orange-700 text-white hover:bg-gradient-to-br from-purple-800 to-orange-600'
              }`}
          >
            <FaPaperPlane className="w-4 h-4 md:w-5 md:h-5" />
          </button>
        </div>

        <div className="mt-2 flex items-start gap-1.5 px-1 text-[11px] md:text-xs text-gray-400 min-w-0">
          <span className="min-w-0 break-words leading-snug">Press Ctrl/Cmd + Enter to send.</span>
        </div>
      </div>
    </div>
  );
};

export default ThreadInput;
