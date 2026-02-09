'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { MessageSquare, Send, ShieldCheck, Zap, AlertCircle } from 'lucide-react';
import * as rawAuth from '@/lib/core/supabase/raw-auth';
import { createOneTimeConversation, getOrCreateConversation, sendMessage } from '@/lib/messaging/messaging-service';
import SignupPromptModal from '@/components/auth/SignupPromptModal';

type MessageMode = 'one-time' | 'conversation';

interface MessageDropProps {
  recipientId: string;
  recipientName: string;
}

const MessageDrop = ({ recipientId, recipientName }: MessageDropProps) => {
  const router = useRouter();
  const [message, setMessage] = useState('');
  const [mode, setMode] = useState<MessageMode>('one-time');
  const [isSending, setIsSending] = useState(false);
  const [showSignupModal, setShowSignupModal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showThanks, setShowThanks] = useState(false);

  const handleSend = async () => {
    if (!message.trim()) return;
    setIsSending(true);
    setError(null);

    try {
      const session = rawAuth.getSession();
      const user = session?.user;

      if (mode === 'conversation') {
        if (!user || user.is_anonymous) {
          setShowSignupModal(true);
          setIsSending(false);
          return;
        }
      }

      if (mode === 'one-time' && !user) {
        const { error: authError } = await rawAuth.signInAnonymously();
        if (authError) {
          throw new Error('Unable to send message right now. Please try again.');
        }
      }

      let conversationId: string;
      if (mode === 'one-time') {
        const { data: otData, error: otError } = await createOneTimeConversation(recipientId);
        if (otError || !otData) throw new Error(otError || 'Failed to send message');
        conversationId = otData.id;
      } else {
        const { data: conversationData, error: convError } = await getOrCreateConversation(recipientId);
        if (convError || !conversationData) throw new Error(convError || 'Failed to start conversation');
        conversationId = conversationData.id;
      }

      const { error: sendError } = await sendMessage(conversationId, message);
      if (sendError) throw new Error(sendError);

      setMessage('');
      if (mode === 'one-time') {
        setShowThanks(true);
      } else {
        router.push(`/inbox/${conversationId}`);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to send message');
    } finally {
      setIsSending(false);
    }
  };

  if (showThanks) {
    return (
      <div className="w-full max-w-xl mx-auto bg-[#151515] border border-gray-800 rounded-2xl p-8 text-center">
        <div className="w-14 h-14 rounded-full bg-purple-600/20 flex items-center justify-center mx-auto mb-4">
          <ShieldCheck className="w-6 h-6 text-purple-300" />
        </div>
        <h2 className="text-2xl font-semibold text-white mb-2">Thanks for contributing</h2>
        <p className="text-sm text-gray-400 mb-6">
          Your message was delivered anonymously. Want to start threads or polls of your own?
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={async () => {
              await rawAuth.signOut();
              router.push('/auth?force=1&view=signup');
            }}
            className="px-5 py-3 rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-semibold"
          >
            Create an account
          </button>
          <button
            onClick={() => setShowThanks(false)}
            className="px-5 py-3 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-200"
          >
            Send another message
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div className="bg-[#151515] border border-gray-800 rounded-2xl p-6 md:p-8 shadow-xl">
        <div className="text-center mb-6">
          <div className="w-16 h-16 rounded-full bg-purple-600/20 flex items-center justify-center mx-auto mb-3">
            <span className="text-2xl font-bold text-purple-200">
              {recipientName?.charAt(0)?.toUpperCase() || 'A'}
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-semibold text-white">
            Message {recipientName}
          </h1>
          <p className="text-sm text-gray-400 mt-2">
            Send a one-off message or start a conversation. One-off messages don’t need an account.
          </p>
        </div>

        <div className="grid gap-3 md:grid-cols-2 mb-5">
          <button
            onClick={() => setMode('one-time')}
            className={`text-left border rounded-xl p-4 transition-all ${
              mode === 'one-time'
                ? 'border-purple-500 bg-purple-900/30 ring-1 ring-purple-500/40'
                : 'border-gray-700 bg-gray-900/40 hover:border-purple-500/40'
            }`}
          >
            <div className="flex items-center gap-3 mb-2">
              <span className="w-10 h-10 rounded-full bg-purple-600/20 flex items-center justify-center">
                <Zap className="w-5 h-5 text-purple-300" />
              </span>
              <div>
                <p className="text-white font-semibold">One-off Message</p>
                <p className="text-xs text-gray-400">No account needed</p>
              </div>
            </div>
            <p className="text-xs text-gray-500">
              Drop a quick message and leave. Replies aren’t required.
            </p>
          </button>

          <button
            onClick={() => setMode('conversation')}
            className={`text-left border rounded-xl p-4 transition-all ${
              mode === 'conversation'
                ? 'border-orange-500 bg-orange-900/20 ring-1 ring-orange-500/30'
                : 'border-gray-700 bg-gray-900/40 hover:border-orange-500/40'
            }`}
          >
            <div className="flex items-center gap-3 mb-2">
              <span className="w-10 h-10 rounded-full bg-orange-500/20 flex items-center justify-center">
                <MessageSquare className="w-5 h-5 text-orange-300" />
              </span>
              <div>
                <p className="text-white font-semibold">Start Conversation</p>
                <p className="text-xs text-gray-400">Account required</p>
              </div>
            </div>
            <p className="text-xs text-gray-500">
              Start a private chat thread and receive replies.
            </p>
          </button>
        </div>

        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder={mode === 'one-time' ? 'Type your message...' : 'Start the conversation...'}
          className="w-full min-h-[140px] bg-gray-900/70 text-white rounded-xl p-4 border border-gray-700 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
        />

        {error && (
          <div className="mt-4 p-3 bg-red-900/40 border border-red-700 rounded-lg text-red-200 text-sm flex items-center gap-2">
            <AlertCircle className="w-4 h-4" /> {error}
          </div>
        )}

        <button
          onClick={handleSend}
          disabled={isSending || !message.trim()}
          className={`mt-5 w-full py-3 rounded-lg font-semibold flex items-center justify-center gap-2 transition-all ${
            isSending || !message.trim()
              ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
              : mode === 'one-time'
              ? 'bg-purple-600 hover:bg-purple-700 text-white'
              : 'bg-orange-600 hover:bg-orange-700 text-white'
          }`}
        >
          <Send className="w-4 h-4" />
          {mode === 'one-time' ? 'Send Message' : 'Start Conversation'}
        </button>
      </div>

      <SignupPromptModal
        isOpen={showSignupModal}
        onClose={() => setShowSignupModal(false)}
      />
    </div>
  );
};

export default MessageDrop;
