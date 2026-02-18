'use client'

import { useState, useEffect, useRef } from 'react';
import type { ChangeEvent } from 'react';
import { createPortal } from 'react-dom';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, Send, Loader2, Check, CheckCheck, Clock, Image as ImageIcon, X } from 'lucide-react';
import { createReadReceipt, markConversationDelivered, markConversationRead, useConversationQuery, useMessagesQuery, useSendMessageMutation } from '@/lib/messaging';
import type { DirectMessage, MessageDeliveryReceipt, MessageReadReceipt } from '@/lib/messaging';
import { useUserStore } from '@/store/userStore';
import { uploadService } from '@/lib/utils/upload-service';
import * as rawRealtime from '@/lib/core/supabase/raw-realtime';
import AppLoadingState from '@/components/ui/AppLoadingState';

export default function ConversationPage() {
  const router = useRouter();
  const params = useParams();
  const conversationId = params.messageId as string;
  const { session, sessionValidated } = useUserStore();

  const isAuthed = Boolean(sessionValidated && session.user);
  const { conversation, isLoading: isConversationLoading, error: conversationError } =
    useConversationQuery(conversationId, { enabled: isAuthed && !!conversationId });
  const { messages, isLoading: isMessagesLoading, error: messagesError } =
    useMessagesQuery(conversationId, { enabled: isAuthed && !!conversationId });
  const sendMessageMutation = useSendMessageMutation(conversationId);

  const isLoading = !sessionValidated || isConversationLoading || isMessagesLoading;
  const error = conversationError || messagesError;
  const orderedMessages = [...messages].reverse();

  const [messageText, setMessageText] = useState('');
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [activeImage, setActiveImage] = useState<{ url: string; name?: string } | null>(null);
  const [isOtherTyping, setIsOtherTyping] = useState(false);
  const [isOtherOnline, setIsOtherOnline] = useState(false);
  const typingChannelRef = useRef<ReturnType<typeof rawRealtime.createChannel> | null>(null);
  const presenceChannelRef = useRef<ReturnType<typeof rawRealtime.createChannel> | null>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!selectedImage) {
      setImagePreviewUrl(null);
      return;
    }
    const previewUrl = URL.createObjectURL(selectedImage);
    setImagePreviewUrl(previewUrl);
    return () => {
      URL.revokeObjectURL(previewUrl);
    };
  }, [selectedImage]);

  useEffect(() => {
    if (!activeImage) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setActiveImage(null);
      }
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [activeImage]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [orderedMessages.length]);

  const otherUser = session.user && conversation?.participants
    ? conversation.participants.find((p) => p.userId !== session.user?.id) || null
    : null;

  useEffect(() => {
    if (!sessionValidated || session.user) return;
    router.replace(`/auth?redirect=${encodeURIComponent(`/inbox/${conversationId}`)}`);
  }, [sessionValidated, session.user, conversationId, router]);

  useEffect(() => {
    if (!sessionValidated || !session.user) return;
    if (isLoading || !conversation) return;
    if (conversation.type !== 'one_time') return;
    router.replace(`/inbox?conversationId=${encodeURIComponent(conversationId)}`);
  }, [sessionValidated, session.user, isLoading, conversation, conversationId, router]);

  useEffect(() => {
    if (!session.user || !conversationId) return;

    const hasUndelivered = orderedMessages.some((msg) =>
      msg.senderId !== session.user?.id &&
      !msg.deliveryReceipts?.some((receipt) => receipt.userId === session.user?.id)
    );

    if (hasUndelivered) {
      markConversationDelivered(conversationId);
    }

    orderedMessages.forEach((msg) => {
      if (msg.senderId === session.user?.id) return;

      const alreadyRead = msg.readReceipts?.some(
        (receipt) => receipt.userId === session.user?.id
      );

      if (!alreadyRead) {
        createReadReceipt(msg.id);
      }
    });

    if (orderedMessages.length > 0) {
      markConversationRead(conversationId);
    }
  }, [orderedMessages, session.user, conversationId]);

  useEffect(() => {
    if (!session.user || !conversationId) return;

    const channel = rawRealtime.createChannel({
      channelName: `realtime:typing:${conversationId}`,
      onBroadcast: (payload) => {
        if (payload?.event !== 'typing') return;
        const typingPayload = payload?.payload || {};
        if (typingPayload.userId === session.user?.id) return;
        setIsOtherTyping(Boolean(typingPayload.isTyping));
      },
    });

    typingChannelRef.current = channel;
    channel.subscribe();

    return () => {
      if (channel && session.user?.id) {
        channel.broadcast('typing', {
          userId: session.user.id,
          isTyping: false,
        });
      }
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      channel.unsubscribe();
      typingChannelRef.current = null;
    };
  }, [conversationId, session.user]);

  useEffect(() => {
    if (!session.user || !conversationId) return;

    const otherUserId = otherUser?.user?.id || otherUser?.userId;
    if (!otherUserId) return;

    const channel = rawRealtime.createChannel({
      channelName: `realtime:presence:dm:${conversationId}`,
      config: { presence: { key: session.user.id } },
      onPresenceSync: (payload) => {
        if (!payload) return;
        if (payload.joins || payload.leaves) {
          if (payload.joins?.[otherUserId]) {
            setIsOtherOnline(true);
          }
          if (payload.leaves?.[otherUserId]) {
            setIsOtherOnline(false);
          }
          return;
        }

        const isOnline = Boolean(payload?.[otherUserId]?.length);
        setIsOtherOnline(isOnline);
      },
    });

    presenceChannelRef.current = channel;
    channel.subscribe().then(() => {
      channel.track({ onlineAt: new Date().toISOString() });
    });

    return () => {
      channel.unsubscribe();
      presenceChannelRef.current = null;
    };
  }, [conversationId, session.user, otherUser?.user?.id, otherUser?.userId]);

  const handleSend = async () => {
    const trimmedContent = messageText.trim();
    if ((!trimmedContent && !selectedImage) || !conversationId) return;

    if (typingChannelRef.current && session.user) {
      typingChannelRef.current.broadcast('typing', {
        userId: session.user.id,
        isTyping: false,
      });
    }

    try {
      if (selectedImage) {
        setIsUploadingImage(true);
        const upload = await uploadService.uploadFile(
          selectedImage,
          'thread-attachments',
          `direct-messages/${conversationId}`
        );
        await sendMessageMutation.mutateAsync({
          content: trimmedContent,
          messageType: 'image',
          attachmentUrl: upload.url,
        });
        setSelectedImage(null);
        if (imageInputRef.current) {
          imageInputRef.current.value = '';
        }
      } else {
        await sendMessageMutation.mutateAsync({
          content: trimmedContent,
          messageType: 'text',
        });
      }
      setMessageText('');
    } catch (sendError) {
      console.error('Failed to send message:', sendError);
    } finally {
      setIsUploadingImage(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleTyping = (value: string) => {
    setMessageText(value);
    if (!session.user || !typingChannelRef.current) return;

    if (!value.trim()) {
      typingChannelRef.current.broadcast('typing', {
        userId: session.user.id,
        isTyping: false,
      });
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      return;
    }

    typingChannelRef.current.broadcast('typing', {
      userId: session.user.id,
      isTyping: true,
    });

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      typingChannelRef.current?.broadcast('typing', {
        userId: session.user?.id,
        isTyping: false,
      });
    }, 1200);
  };

  const handleImageSelect = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;
    setSelectedImage(file);
  };

  const clearSelectedImage = () => {
    setSelectedImage(null);
    if (imageInputRef.current) {
      imageInputRef.current.value = '';
    }
  };

  if (isLoading) {
    return <AppLoadingState title="Syncing your conversations..." />;
  }

  if (!session.user) {
    return <AppLoadingState title="Taking you to sign in..." />;
  }

  if (error || !conversation) {
    return (
      <div className="min-h-screen bg-[#121212] flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-gray-400 mb-4">{error?.message || 'Conversation not found'}</p>
          <button
            onClick={() => router.push('/inbox')}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg text-white"
          >
            Back to Inbox
          </button>
        </div>
      </div>
    );
  }

  const formatLastSeen = (timestamp?: string) => {
    if (!timestamp) return 'Last seen recently';
    const lastSeen = new Date(timestamp);
    const diffMs = Date.now() - lastSeen.getTime();
    const diffMinutes = Math.floor(diffMs / 60000);

    if (diffMinutes < 1) return 'Last seen just now';
    if (diffMinutes < 60) return `Last seen ${diffMinutes}m ago`;
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `Last seen ${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `Last seen ${diffDays}d ago`;
  };

  const getMessageStatus = (msg: DirectMessage) => {
    if (!session.user || msg.senderId !== session.user.id) return null;
    if (msg.id?.startsWith('temp-')) return 'Sending...';
    const otherUserId = otherUser?.user?.id || otherUser?.userId;
    if (
      otherUserId &&
      msg.readReceipts?.some((receipt: MessageReadReceipt) => receipt.userId === otherUserId)
    ) {
      return 'Read';
    }
    if (
      otherUserId &&
      msg.deliveryReceipts?.some((receipt: MessageDeliveryReceipt) => receipt.userId === otherUserId)
    ) {
      return 'Delivered';
    }
    return 'Sent';
  };

  const renderTypingDots = () => (
    <span className="inline-flex items-center gap-1">
      <span className="inline-block w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
      <span className="inline-block w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
      <span className="inline-block w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
    </span>
  );

  return (
    <div className="flex flex-col bg-[#121212] h-[calc(100dvh-4rem)] md:h-screen overflow-hidden">
      {/* Header */}
      <div className="shrink-0 flex items-center gap-3 p-4 border-b border-gray-800 bg-gray-900/50 backdrop-blur-sm sticky top-0 z-20">
        <button
          onClick={() => router.push('/inbox')}
          className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-gray-400" />
        </button>

        <div className="flex items-center gap-3">
          <div className="relative w-10 h-10 bg-purple-500/20 rounded-full flex items-center justify-center">
            <span className="text-sm font-semibold text-purple-400">
              {otherUser?.user?.anonymousId?.charAt(0) || 'A'}
            </span>
            <span
              className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[#121212] ${isOtherOnline ? 'bg-green-400' : 'bg-gray-500'
                }`}
            />
          </div>
          <div>
            <p className="font-semibold text-white">
              {otherUser?.user?.anonymousId || 'Anonymous User'}
            </p>
            <p className="text-xs text-gray-500">
              {isOtherTyping ? (
                <span className="flex items-center gap-2 text-purple-300">
                  Typing {renderTypingDots()}
                </span>
              ) : isOtherOnline ? (
                <span className="text-green-400">Online</span>
              ) : (
                formatLastSeen(otherUser?.lastReadAt)
              )}
            </p>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 min-h-0 overflow-y-auto p-4">
        {orderedMessages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-400">
            <p>No messages yet. Start the conversation!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {orderedMessages.map((msg) => {
              const isMyMessage = msg.senderId === session.user?.id;
              const status = getMessageStatus(msg);

              return (
                <div
                  key={msg.id}
                  className={`flex ${isMyMessage ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[75%] rounded-lg p-3 ${isMyMessage
                      ? 'bg-purple-600 text-white'
                      : 'bg-gray-800 text-gray-200'
                      }`}
                  >
                    {msg.isDeleted ? (
                      <p className="text-sm italic opacity-60">Message deleted</p>
                    ) : msg.messageType === 'image' && msg.attachmentUrl ? (
                      <div className="space-y-2">
                        <button
                          type="button"
                          className="block max-w-[240px] cursor-zoom-in rounded-lg overflow-hidden focus:outline-none focus:ring-2 focus:ring-purple-400/60"
                          onClick={() => setActiveImage({ url: msg.attachmentUrl, name: 'Image' })}
                          aria-label="Open image preview"
                        >
                          <img
                            src={msg.attachmentUrl}
                            alt="Message attachment"
                            className="w-full h-auto max-h-64 object-cover"
                            draggable={false}
                            onContextMenu={(event) => event.preventDefault()}
                          />
                        </button>
                        {msg.content?.trim() && (
                          <p className="text-sm whitespace-pre-wrap leading-relaxed">
                            {msg.content}
                          </p>
                        )}
                        {msg.isEdited && (
                          <p className="text-xs opacity-60">Edited</p>
                        )}
                      </div>
                    ) : (
                      <>
                        <p className="text-sm whitespace-pre-wrap leading-relaxed">
                          {msg.content}
                        </p>
                        {msg.isEdited && (
                          <p className="text-xs opacity-60 mt-1">Edited</p>
                        )}
                      </>
                    )}
                    <div className="mt-1 flex items-center justify-between gap-2 text-xs opacity-70">
                      <span>
                        {new Date(msg.createdAt).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                      {status && (
                        <span className="flex items-center gap-1">
                          {status === 'Sending...' && <Clock className="w-3 h-3" />}
                          {status === 'Sent' && <Check className="w-3 h-3" />}
                          {status === 'Delivered' && <CheckCheck className="w-3 h-3" />}
                          {status === 'Read' && <CheckCheck className="w-3 h-3 text-green-300" />}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Message Input - Fixed at bottom */}
      <div className="shrink-0 border-t border-gray-800 bg-gray-900/95 backdrop-blur-sm p-4 sticky bottom-0 z-20 pb-[calc(1rem+env(safe-area-inset-bottom))]">
        <div className="max-w-4xl mx-auto flex items-end gap-2">
          <div className="flex-1 flex flex-col space-y-2">
            {imagePreviewUrl && (
              <div className="relative w-20 h-20 rounded-lg overflow-hidden border border-gray-700">
                <img
                  src={imagePreviewUrl}
                  alt="Selected image"
                  className="w-full h-full object-cover"
                  draggable={false}
                  onContextMenu={(event) => event.preventDefault()}
                />
                <button
                  type="button"
                  onClick={clearSelectedImage}
                  className="absolute top-1 right-1 w-6 h-6 rounded-full bg-gray-900/80 text-white flex items-center justify-center hover:bg-gray-800"
                  aria-label="Remove image"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}

            <div className="flex items-end bg-gray-800 border border-gray-700 rounded-xl focus-within:ring-2 focus-within:ring-purple-500 transition-all">
              <textarea
                value={messageText}
                onChange={(e) => handleTyping(e.target.value)}
                onKeyPress={handleKeyPress}
                onBlur={() => {
                  typingChannelRef.current?.broadcast('typing', {
                    userId: session.user?.id,
                    isTyping: false,
                  });
                }}
                placeholder="Your message..."
                rows={1}
                className="flex-1 px-4 py-3 bg-transparent text-white text-sm placeholder-gray-500 focus:outline-none resize-none"
              />
              <input
                ref={imageInputRef}
                type="file"
                accept="image/*"
                hidden
                onChange={handleImageSelect}
              />
              <button
                type="button"
                onClick={() => imageInputRef.current?.click()}
                disabled={sendMessageMutation.isPending || isUploadingImage}
                className="p-3 text-gray-400 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label="Add image"
              >
                <ImageIcon className="w-5 h-5" />
              </button>
            </div>
          </div>

          <button
            onClick={handleSend}
            disabled={(!messageText.trim() && !selectedImage) || sendMessageMutation.isPending || isUploadingImage}
            className="shrink-0 w-11 h-11 bg-purple-600 hover:bg-purple-700 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-white transition-all flex items-center justify-center mb-0.5"
            aria-label="Send message"
          >
            {sendMessageMutation.isPending || isUploadingImage ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </button>
        </div>
      </div>
      {activeImage && typeof window !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 z-[1100] bg-black/80 backdrop-blur-sm flex items-center justify-center modal-safe-overlay"
          onClick={() => setActiveImage(null)}
          onWheel={(event) => event.preventDefault()}
          onTouchMove={(event) => event.preventDefault()}
          role="dialog"
          aria-modal="true"
        >
          <button
            type="button"
            className="absolute top-4 right-4 md:top-6 md:right-6 inline-flex items-center gap-2 rounded-full bg-white/10 text-white border border-white/20 px-3 py-1.5 text-xs uppercase tracking-widest hover:bg-white/20 backdrop-blur"
            onClick={() => setActiveImage(null)}
            aria-label="Close image preview"
          >
            Close
          </button>
          <div
            className="relative max-w-[96vw] max-h-[calc(var(--app-viewport-height)-2rem)]"
            onClick={(event) => event.stopPropagation()}
          >
            <img
              src={activeImage.url}
              alt={activeImage.name || 'Image preview'}
              className="max-w-[96vw] max-h-[calc(var(--app-viewport-height)-2rem)] object-contain rounded-2xl shadow-2xl"
              draggable={false}
              onContextMenu={(event) => event.preventDefault()}
            />
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
