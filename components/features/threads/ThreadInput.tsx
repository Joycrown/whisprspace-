'use client'
import React, { useState, useRef, useEffect } from 'react';
import {
  FaPaperPlane, FaImage, FaPaperclip, FaTimes
} from 'react-icons/fa';
import { Message } from '@/types';

interface ThreadInputProps {
  onSendMessage: (message: string, attachments?: File[]) => void;
  replyPreview?: string;
  onCancelReply?: () => void;
  replyTo: Message | null;
  onTypingStart?: () => void; // Added prop
  onTypingEnd?: () => void;   // Added prop
  onTypingCard?: () => void;
  isLoading?: boolean;
  isDisabled?: boolean;
  disabledMessage?: string;
}

const ThreadInput: React.FC<ThreadInputProps> = ({
  onSendMessage,
  replyPreview,
  onCancelReply,
  replyTo,
  onTypingStart,
  onTypingEnd,
  onTypingCard,
  isLoading,
  isDisabled = false,
  disabledMessage
}) => {
  const [message, setMessage] = useState('');
  const [attachments, setAttachments] = useState<File[]>([]);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 128)}px`;
    }
  }, [message]);

  const handleSend = () => {
    if (isDisabled) return;
    console.log('🔵 ThreadInput handleSend called', { message, attachmentsCount: attachments.length });
    if (message.trim() || attachments.length > 0) {
      console.log('🟢 Calling onSendMessage');
      onSendMessage(message, attachments);
      setMessage('');
      setAttachments([]);
      onCancelReply?.();
    } else {
      console.log('🔴 Message empty, not sending');
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      setAttachments(prev => [...prev, ...Array.from(files)]);
    }
  };

  return (
    <div className="bg-gray-700 border-t border-gray-800 p-3 pb-5 md:p-4 w-full">
      <div className="max-w-4xl mx-auto">
        {isDisabled && (
          <div className="mb-3 text-xs md:text-sm text-red-300 bg-red-900/30 border border-red-800 rounded px-3 py-2">
            {disabledMessage || 'You cannot send messages in this thread.'}
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

        {/* Attachment Previews */}
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

        <div className="flex items-end gap-2">
          <div className="flex items-end bg-gray-800 rounded-2xl flex-1 min-h-[44px]">
            <textarea
              ref={textareaRef}
              placeholder="Type your message..."
              value={message}
              onChange={(e) => {
                setMessage(e.target.value);
                onTypingStart?.();
              }}
              onBlur={() => onTypingEnd?.()} // Optional: clear typing on blur
              className="w-full bg-transparent p-2 md:p-3 rounded-2xl focus:outline-none text-sm md:text-base resize-none overflow-y-auto"
              onKeyPress={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
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

              <input
                type="file"
                multiple
                hidden
                ref={fileInputRef}
                onChange={handleFileUpload}
                disabled={isDisabled}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="text-gray-400 hover:text-purple-400 transition-colors p-1"
                type="button"
                disabled={isDisabled}
              >
                <FaPaperclip className="w-4 h-4" />
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
      </div>
    </div>
  );
};

export default ThreadInput;
