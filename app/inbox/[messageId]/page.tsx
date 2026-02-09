'use client'

import { useState, useEffect, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, Send, Loader2, Check, CheckCheck, Clock } from 'lucide-react';
import { createReadReceipt, markConversationRead, useConversationQuery, useMessagesQuery, useSendMessageMutation } from '@/lib/messaging';
import { useUserStore } from '@/store/userStore';
import * as rawRealtime from '@/lib/core/supabase/raw-realtime';

export default function ConversationPage() {
  const router = useRouter();
  const params = useParams();
  const conversationId = params.messageId as string;
  const { session } = useUserStore();

  const isAuthed = !!session.user;
  const { conversation, isLoading: isConversationLoading, error: conversationError } =
    useConversationQuery(conversationId, { enabled: isAuthed });
  const { messages, isLoading: isMessagesLoading, error: messagesError } =
    useMessagesQuery(conversationId, { enabled: isAuthed });
  const sendMessageMutation = useSendMessageMutation(conversationId);

  const isLoading = isConversationLoading || isMessagesLoading;
  const error = conversationError || messagesError;
  const orderedMessages = [...messages].reverse();

  const [messageText, setMessageText] = useState('');
  const [isOtherTyping, setIsOtherTyping] = useState(false);
  const [isOtherOnline, setIsOtherOnline] = useState(false);
  const typingChannelRef = useRef<ReturnType<typeof rawRealtime.createChannel> | null>(null);
  const presenceChannelRef = useRef<ReturnType<typeof rawRealtime.createChannel> | null>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [orderedMessages.length]);

  const otherUser = session.user && conversation?.participants
    ? conversation.participants.find((p) => p.userId !== session.user?.id) || null
    : null;

  useEffect(() => {
    if (!session.user || !conversationId) return;

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
    if (!messageText.trim() || !conversationId) return;

    if (typingChannelRef.current && session.user) {
      typingChannelRef.current.broadcast('typing', {
        userId: session.user.id,
        isTyping: false,
      });
    }

    sendMessageMutation.mutate({
      content: messageText,
      messageType: 'text',
    }, {
      onSuccess: () => {
        setMessageText('');
      }
    });
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

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#121212] flex items-center justify-center p-4">
        <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
      </div>
    );
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

  const getMessageStatus = (msg: any) => {
    if (!session.user || msg.senderId !== session.user.id) return null;
    if (msg.id?.startsWith('temp-')) return 'Sending...';
    const otherUserId = otherUser?.user?.id || otherUser?.userId;
    if (otherUserId && msg.readReceipts?.some((receipt: any) => receipt.userId === otherUserId)) {
      return 'Read';
    }
    return 'Delivered';
  };

  const renderTypingDots = () => (
    <span className="inline-flex items-center gap-1">
      <span className="inline-block w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
      <span className="inline-block w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
      <span className="inline-block w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
    </span>
  );

  return (
    <div className="flex flex-col h-screen bg-[#121212]">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b border-gray-800 bg-gray-900/50 backdrop-blur-sm sticky top-0 z-10">
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
              className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[#121212] ${
                isOtherOnline ? 'bg-green-400' : 'bg-gray-500'
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
      <div className="flex-1 overflow-y-auto p-4">
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
                          {status === 'Delivered' && <Check className="w-3 h-3" />}
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
      <div className="border-t border-gray-800 bg-gray-900/95 backdrop-blur-sm p-4">
        <div className="flex gap-2">
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
            placeholder="Type a message..."
            rows={1}
            className="flex-1 px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
          />
          <button
            onClick={handleSend}
            disabled={!messageText.trim() || sendMessageMutation.isPending}
            className="px-4 py-3 bg-purple-600 hover:bg-purple-700 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-white font-semibold transition-all flex items-center justify-center gap-2"
          >
            {sendMessageMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
