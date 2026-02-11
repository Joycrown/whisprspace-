'use client'

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Send, MessageCircle } from 'lucide-react';
import { createOneTimeConversation, getOrCreateConversation, sendMessage } from '@/lib/messaging';
import { useUserStore } from '@/store/userStore';

interface PageProps {
  params: Promise<{
    userId: string;
  }>;
}

export default function DMPage({ params }: PageProps) {
  const resolvedParams = use(params);
  const { userId } = resolvedParams;
  const router = useRouter();
  const { session, loginAnonymously } = useUserStore();
  
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const recipientAnonymousId = userId;
  const isLoggedIn = session?.isAuthenticated || false;
  const [mode, setMode] = useState<'one-time' | 'conversation'>('conversation');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const modeParam = new URLSearchParams(window.location.search).get('mode');
    if (modeParam === 'one-time' || modeParam === 'conversation') {
      setMode(modeParam);
    }
  }, []);

  const handleSend = async () => {
    if (!message.trim()) return;

    if (mode === 'conversation' && !isLoggedIn) {
      const redirect = encodeURIComponent(`/dm/${userId}?mode=conversation`);
      router.push(`/auth?redirect=${redirect}`);
      return;
    }

    setIsSending(true);
    setErrorMessage(null);

    try {
      if (!session?.user) {
        await loginAnonymously();
      }

      let conversationId: string | null = null;
      if (mode === 'one-time') {
        const { data: otConversation, error: otError } = await createOneTimeConversation(userId);
        if (otError || !otConversation) {
          setErrorMessage(otError || 'Failed to send one-time message');
          setIsSending(false);
          return;
        }
        conversationId = otConversation.id;
      } else {
        const { data: conversation, error: convError } = await getOrCreateConversation(userId);
        if (convError || !conversation) {
          setErrorMessage(convError || 'Failed to create conversation');
          setIsSending(false);
          return;
        }
        conversationId = conversation.id;
      }

      // Send message
      const { error: msgError } = await sendMessage(conversationId, message, 'text');
      
      if (msgError) {
        setErrorMessage(msgError);
        setIsSending(false);
        return;
      }

      if (mode === 'conversation') {
        setIsSending(false);
        router.push(`/inbox/${conversationId}`);
      } else {
        setShowSuccess(true);
        setMessage('');
        setIsSending(false);
      }
    } catch (error: any) {
      setErrorMessage(error.message || 'Failed to send message');
      setIsSending(false);
    }
  };


  return (
    <div className="min-h-screen bg-[#121212] py-4 md:py-8 lg:py-12 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-6 md:mb-8">
          <div className="w-12 h-12 md:w-16 md:h-16 bg-gradient-to-br from-purple-500 to-orange-400 rounded-full flex items-center justify-center mx-auto mb-3 md:mb-4">
            <MessageCircle className="w-6 h-6 md:w-8 md:h-8 text-white" />
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">
            Send Anonymous Message
          </h1>
          <p className="text-sm md:text-base text-gray-400">
            to <span className="text-purple-400 font-semibold">{recipientAnonymousId}</span>
          </p>
        </div>

        {/* Message Form */}
        <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 md:p-6 mb-4 md:mb-6">
          <label className="block text-sm font-medium text-gray-300 mb-2 md:mb-3">
            Your Message
          </label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={mode === 'one-time' ? 'Type your one-off message...' : 'Start the conversation...'}
            maxLength={500}
            rows={6}
            style={{ fontSize: '16px' }}
            className="w-full px-3 md:px-4 py-2.5 md:py-3 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none text-base"
          />
          <div className="flex justify-between items-center mt-2">
            <span className="text-sm text-gray-500">
              {message.length}/500 characters
            </span>
          </div>
        </div>

        {/* Login Required Notice */}
        {mode === 'conversation' && !isLoggedIn && (
          <div className="bg-orange-900/20 border border-orange-500/30 rounded-lg p-4 md:p-6 mb-4 md:mb-6">
            <h3 className="text-base md:text-lg font-semibold text-white mb-2">
              Login Required
            </h3>
            <p className="text-xs md:text-sm text-gray-400">
              You need to be logged in to send messages. Click the button below to continue to the inbox conversation.
            </p>
          </div>
        )}

        {/* Error Message */}
        {errorMessage && (
          <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-4 mb-4">
            <p className="text-sm text-red-300">{errorMessage}</p>
          </div>
        )}
        {showSuccess && (
          <div className="bg-green-900/20 border border-green-500/30 rounded-lg p-4 mb-4">
            <p className="text-sm text-green-300">One-off message sent.</p>
          </div>
        )}

        {/* Info Box */}
        <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-3 md:p-4 mb-4 md:mb-6">
          <p className="text-xs md:text-sm text-blue-300">
            <strong>🔒 Your privacy is protected:</strong>{' '}
            {mode === 'one-time'
              ? "This is a one-time message. The recipient won't be able to reply in a conversation."
              : isLoggedIn
                ? 'Your message will be sent with your anonymous ID. The recipient can reply to you in a conversation.'
                : 'You need to log in to start a conversation. Your identity will remain anonymous.'}
          </p>
        </div>

        {/* Send Button */}
        <button
          onClick={handleSend}
          disabled={!message.trim() || isSending}
          className="w-full py-3 md:py-4 bg-gradient-to-r from-purple-600 to-orange-500 hover:opacity-90 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-white text-base md:text-lg font-semibold flex items-center justify-center gap-2 transition-all min-h-[48px]"
        >
          {isSending ? (
            <>
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              Sending...
            </>
          ) : (
            <>
              <Send className="w-5 h-5" />
              {mode === 'conversation'
                ? (isLoggedIn ? 'Start Conversation' : 'Continue to Login')
                : 'Send One-Off Message'}
            </>
          )}
        </button>

        {/* Share Your Link */}
        {isLoggedIn && (
          <div className="mt-8 md:mt-12 pt-6 md:pt-8 border-t border-gray-800">
            <h3 className="text-lg md:text-xl font-bold text-white mb-2 md:mb-3">Your Message Link</h3>
            <p className="text-sm md:text-base text-gray-400 mb-3 md:mb-4">
              Share your message link so others can send you a one-off message or start a conversation
            </p>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                value={`${typeof window !== 'undefined' ? window.location.origin : ''}/message/${session?.user?.username || session?.user?.anonymousId || 'your-id'}`}
                readOnly
                className="flex-1 px-3 md:px-4 py-2.5 md:py-3 bg-gray-900 border border-gray-700 rounded-lg text-gray-300 text-xs md:text-sm"
              />
              <button
                onClick={() => {
                  navigator.clipboard.writeText(`${window.location.origin}/message/${session?.user?.username || session?.user?.anonymousId}`);
                }}
                className="px-4 md:px-6 py-2.5 md:py-3 bg-purple-600 hover:bg-purple-700 active:scale-95 rounded-lg text-white font-semibold transition-all min-h-[44px]"
              >
                Copy
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
