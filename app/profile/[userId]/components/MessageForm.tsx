'use client';

import React, { useState } from 'react';
import { Send, MessageSquare, Zap, Check, AlertCircle } from 'lucide-react';
// import { supabase } from '@/lib/core/supabase/client'; // REMOVED
import * as rawAuth from '@/lib/core/supabase/raw-auth';
import { getOrCreateConversation, sendMessage, createOneTimeConversation } from '@/lib/messaging/messaging-service';
import SignupPromptModal from '@/components/auth/SignupPromptModal';
import { useRouter } from 'next/navigation';
import { User } from '@/types';

interface MessageFormProps {
  recipientId: string;
  recipientName: string;
}

type MessageMode = 'one-time' | 'conversation';

const MessageForm: React.FC<MessageFormProps> = ({ recipientId, recipientName }) => {
  const router = useRouter();
  const [message, setMessage] = useState('');
  const [mode, setMode] = useState<MessageMode>('one-time');
  const [isSending, setIsSending] = useState(false);
  const [showSignupModal, setShowSignupModal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSend = async () => {
    if (!message.trim()) return;
    setIsSending(true);
    setError(null);

    try {
      const session = rawAuth.getSession();
      const user = session?.user;

      // Case 1: Start Conversation (Requires Auth)
      if (mode === 'conversation') {
        if (!user || user.is_anonymous) {
          // Trigger auth modal
          setShowSignupModal(true);
          setIsSending(false);
          return;
        }
      }

      // Case 2: One-time Message (Anonymous allowed)
      // If not logged in, sign in anonymously first
      if (!user) {
        const { error: authError } = await rawAuth.signInAnonymously();
        if (authError) throw new Error('Failed to establish anonymous session: ' + authError.message);
      }

      // Identify conversation ID
      let conversationId: string;

      if (mode === 'one-time') {
        // Create a dedicated one-time conversation
        const { data: otData, error: otError } = await createOneTimeConversation(recipientId);
        if (otError || !otData) throw new Error(otError || 'Failed to send one-time message');
        conversationId = otData.id;
      } else {
        // Get or create persistent conversation
        const { data: conversationData, error: convError } = await getOrCreateConversation(recipientId);
        if (convError || !conversationData) throw new Error(convError || 'Failed to start conversation');
        conversationId = conversationData.id;
      }

      // Send message
      const { error: sendError } = await sendMessage(conversationId, message);

      if (sendError) {
        throw new Error(sendError);
      }

      setSuccess(mode === 'conversation' ? 'Conversation started!' : 'Message sent successfully!');
      setMessage('');

      // Redirect if conversation started
      if (mode === 'conversation') {
        setTimeout(() => router.push('/inbox'), 1500);
      }

    } catch (err: any) {
      console.error('Message failed:', err);
      setError(err.message || 'Failed to send message');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="bg-gray-800 rounded-lg p-6 shadow-lg border border-gray-700">
      <h3 className="text-xl font-bold text-white mb-4">Send a Message to {recipientName}</h3>

      {/* Mode Selection */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div
          onClick={() => setMode('one-time')}
          className={`cursor-pointer border rounded-lg p-4 transition-all ${mode === 'one-time'
            ? 'bg-purple-900/40 border-purple-500 ring-1 ring-purple-500'
            : 'bg-gray-700/50 border-gray-600 hover:bg-gray-700'
            }`}
        >
          <div className="flex items-center gap-3 mb-2">
            <div className={`p-2 rounded-full ${mode === 'one-time' ? 'bg-purple-600' : 'bg-gray-600'}`}>
              <Zap className="w-4 h-4 text-white" />
            </div>
            <span className="font-semibold text-white">One-time Message</span>
          </div>
          <p className="text-sm text-gray-400 pl-11">
            Send a quick message. No account needed. No reply expected.
          </p>
        </div>

        <div
          onClick={() => setMode('conversation')}
          className={`cursor-pointer border rounded-lg p-4 transition-all ${mode === 'conversation'
            ? 'bg-orange-900/40 border-orange-500 ring-1 ring-orange-500'
            : 'bg-gray-700/50 border-gray-600 hover:bg-gray-700'
            }`}
        >
          <div className="flex items-center gap-3 mb-2">
            <div className={`p-2 rounded-full ${mode === 'conversation' ? 'bg-orange-600' : 'bg-gray-600'}`}>
              <MessageSquare className="w-4 h-4 text-white" />
            </div>
            <span className="font-semibold text-white">Start Conversation</span>
          </div>
          <p className="text-sm text-gray-400 pl-11">
            Start a chat thread. Requires an account to receive replies.
          </p>
        </div>
      </div>

      {/* Message Input */}
      <div className="mb-4">
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder={mode === 'one-time' ? "Type your anonymous message..." : "Start the conversation..."}
          className="w-full bg-gray-900 text-white rounded-lg p-4 border border-gray-700 focus:ring-2 focus:ring-purple-500 focus:border-transparent min-h-[120px]"
        />
      </div>

      {/* Error/Success Messages */}
      {error && (
        <div className="mb-4 p-3 bg-red-900/50 border border-red-700 rounded-lg text-red-200 text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4" /> {error}
        </div>
      )}
      {success && (
        <div className="mb-4 p-3 bg-green-900/50 border border-green-700 rounded-lg text-green-200 text-sm">
          {success}
        </div>
      )}

      {/* Send Button */}
      <button
        onClick={handleSend}
        disabled={isSending || !message.trim()}
        className={`w-full py-3 rounded-lg font-bold text-white flex items-center justify-center gap-2 transition-all ${isSending || !message.trim()
          ? 'bg-gray-600 cursor-not-allowed'
          : mode === 'one-time'
            ? 'bg-purple-600 hover:bg-purple-700'
            : 'bg-orange-600 hover:bg-orange-700'
          }`}
      >
        {isSending ? (
          'Sending...'
        ) : (
          <>
            <Send className="w-4 h-4" />
            {mode === 'one-time' ? 'Send Anonymously' : 'Start Chat'}
          </>
        )}
      </button>

      {/* Legal/Info Text */}
      <p className="text-xs text-center text-gray-500 mt-4">
        {mode === 'one-time'
          ? "Your identity will be hidden. You won't receive a notification if they reply."
          : "You'll be notified when they reply to this thread."}
      </p>

      <SignupPromptModal
        isOpen={showSignupModal}
        onClose={() => setShowSignupModal(false)}
      />
    </div>
  );
};

export default MessageForm;
