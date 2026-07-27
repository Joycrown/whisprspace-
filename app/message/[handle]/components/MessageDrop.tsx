'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageSquare, Send, ShieldCheck, Zap, AlertCircle } from 'lucide-react';
import * as rawAuth from '@/lib/core/supabase/raw-auth';
import { getOrCreateConversation, sendMessage } from '@/lib/messaging/messaging-service';
import SignupPromptModal from '@/components/auth/SignupPromptModal';

type MessageMode = 'one-time' | 'conversation';

const MAX_LENGTH = 500;

interface MessageDropProps {
  recipientId: string;
  recipientName: string;
}

// Deterministic identicon: maps first char to a gradient angle / colours
function Identicon({ name, size = 64 }: { name: string; size?: number }) {
  const char = name.charAt(0).toUpperCase() || '?';
  const seed = char.charCodeAt(0);
  const hue = (seed * 37) % 360;
  const hue2 = (hue + 60) % 360;
  return (
    <div
      className="flex items-center justify-center rounded-[22%] flex-shrink-0 font-semibold select-none"
      style={{
        width: size,
        height: size,
        background: `linear-gradient(135deg, hsl(${hue},70%,45%), hsl(${hue2},70%,55%))`,
        fontSize: size * 0.4,
        color: 'rgba(255,255,255,0.92)',
        letterSpacing: '-0.01em',
      }}
    >
      {char}
    </div>
  );
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
    const trimmed = message.trim();
    if (!trimmed) return;
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

        const { data: conversationData, error: convError } = await getOrCreateConversation(recipientId);
        if (convError || !conversationData) throw new Error(convError || 'Failed to start conversation');
        const { error: sendError } = await sendMessage(conversationData.id, trimmed);
        if (sendError) throw new Error(sendError);
        router.push(`/inbox/${conversationData.id}`);
        return;
      }

      const res = await fetch('/api/inbox/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipientId,
          content: trimmed,
          senderUserId: user?.id ?? null,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || 'Failed to send message');
      }

      setMessage('');
      setShowThanks(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to send message';
      setError(msg);
    } finally {
      setIsSending(false);
    }
  };

  const remaining = MAX_LENGTH - message.length;
  const isNearLimit = message.length >= MAX_LENGTH * 0.8;
  const isAtLimit = message.length >= MAX_LENGTH;

  return (
    <div className="w-full max-w-lg mx-auto">
      <AnimatePresence mode="wait">

        {/* ── Thanks / post-send ── */}
        {showThanks && (
          <motion.div
            key="thanks"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'spring', stiffness: 360, damping: 28 }}
            className="bg-[#12121A] border border-[#23232E] rounded-2xl p-8 text-center space-y-5"
          >
            <div className="flex justify-center">
              <div className="w-14 h-14 rounded-full flex items-center justify-center border border-[#5DCAA5]/30 bg-[#5DCAA5]/10">
                <ShieldCheck className="w-7 h-7 text-[#5DCAA5]" />
              </div>
            </div>
            <div className="space-y-1">
              <h2 className="text-xl font-medium text-[#F2F2F6] tracking-[-0.3px]">
                Sent. They&apos;ll never know it was you.
              </h2>
              <p className="text-[#8F8FA3] text-sm">Want people telling <em>you</em> the truth?</p>
            </div>
            <button
              onClick={() => router.push('/auth?force=1&view=signup&reason=inbox')}
              className="w-full h-[50px] rounded-[11px] text-sm font-medium text-white flex items-center justify-center gap-2 active:scale-[0.97] transition-all"
              style={{ background: 'linear-gradient(100deg, #8B5CF6 0%, #F97316 100%)' }}
            >
              Get your inbox — 10 seconds
            </button>
            <button
              onClick={() => setShowThanks(false)}
              className="w-full text-sm text-[#5C5C6E] hover:text-[#8F8FA3] transition-colors py-2"
            >
              Maybe later
            </button>
          </motion.div>
        )}

        {/* ── Compose ── */}
        {!showThanks && (
          <motion.div
            key="compose"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22 }}
            className="bg-[#12121A] border border-[#23232E] rounded-2xl p-6 md:p-8 space-y-6"
          >
            {/* Header */}
            <div className="flex flex-col items-center text-center gap-3">
              <div
                className="rounded-full p-[3px]"
                style={{ background: 'linear-gradient(135deg, #8B5CF6, #F97316)' }}
              >
                <div className="bg-[#12121A] rounded-full p-1">
                  <Identicon name={recipientName} size={56} />
                </div>
              </div>
              <div>
                <h1 className="text-xl font-medium text-[#F2F2F6] tracking-[-0.3px]">
                  Tell {recipientName} the truth.
                </h1>
                <p className="text-[#5C5C6E] text-sm mt-0.5">No name. No trace.</p>
              </div>
            </div>

            {/* Mode selector */}
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setMode('one-time')}
                className={`text-left rounded-xl p-3.5 border transition-all ${
                  mode === 'one-time'
                    ? 'border-[#8B5CF6]/50 bg-[#8B5CF6]/[0.08]'
                    : 'border-[#2A2A38] bg-white/[0.02] hover:border-[#8B5CF6]/30'
                }`}
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <Zap className={`w-4 h-4 ${mode === 'one-time' ? 'text-[#C4B5FD]' : 'text-[#5C5C6E]'}`} />
                  <span className="text-[#F2F2F6] text-sm font-medium">One-off</span>
                </div>
                <p className="text-[11px] text-[#5C5C6E]">No account needed</p>
              </button>

              <button
                onClick={() => setMode('conversation')}
                className={`text-left rounded-xl p-3.5 border transition-all ${
                  mode === 'conversation'
                    ? 'border-[#F97316]/50 bg-[#F97316]/[0.06]'
                    : 'border-[#2A2A38] bg-white/[0.02] hover:border-[#F97316]/30'
                }`}
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <MessageSquare className={`w-4 h-4 ${mode === 'conversation' ? 'text-[#FDA46A]' : 'text-[#5C5C6E]'}`} />
                  <span className="text-[#F2F2F6] text-sm font-medium">Conversation</span>
                </div>
                <p className="text-[11px] text-[#5C5C6E]">Account required</p>
              </button>
            </div>

            {/* Textarea */}
            <div className="relative">
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value.slice(0, MAX_LENGTH))}
                placeholder={
                  mode === 'one-time'
                    ? 'Say what you actually think...'
                    : 'Start the conversation...'
                }
                rows={5}
                className="w-full rounded-xl px-4 py-3 text-sm text-[#F2F2F6] placeholder-[#5C5C6E] bg-white/[0.03] border border-[#2A2A38] focus:outline-none focus:border-[#8B5CF6]/60 resize-none transition-colors"
              />
              <span
                className={`absolute bottom-3 right-3 text-[11px] tabular-nums pointer-events-none ${
                  isAtLimit ? 'text-[#E24B4A]' : isNearLimit ? 'text-[#EF9F27]' : 'text-[#5C5C6E]'
                }`}
              >
                {remaining}
              </span>
            </div>

            {/* Error */}
            {error && (
              <div className="flex items-center gap-2 rounded-xl border border-[#E24B4A]/30 bg-[#E24B4A]/[0.07] px-4 py-3 text-sm text-[#F2F2F6]">
                <AlertCircle className="w-4 h-4 text-[#E24B4A] flex-shrink-0" />
                {error}
              </div>
            )}

            {/* Send button */}
            <button
              onClick={handleSend}
              disabled={isSending || !message.trim()}
              className="w-full h-[50px] rounded-[11px] text-sm font-medium text-white flex items-center justify-center gap-2 active:scale-[0.97] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              style={{
                background: isSending || !message.trim()
                  ? 'rgba(255,255,255,0.05)'
                  : 'linear-gradient(100deg, #8B5CF6 0%, #F97316 100%)',
                color: isSending || !message.trim() ? '#5C5C6E' : 'white',
              }}
            >
              {isSending ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Sending…
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  {mode === 'one-time' ? 'Send it' : 'Start conversation'}
                </>
              )}
            </button>
          </motion.div>
        )}

      </AnimatePresence>

      <SignupPromptModal
        isOpen={showSignupModal}
        onClose={() => setShowSignupModal(false)}
      />
    </div>
  );
};

export default MessageDrop;
