'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Lock, MessageCircle, Reply, Bell, FolderOpen } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useUserStore } from '@/store/userStore';
import * as rawAuth from '@/lib/core/supabase/raw-auth';

interface SignupPromptModalProps {
  isOpen: boolean;
  onClose: () => void;
  /**
   * What the guest was trying to do. Drives the copy so the wall matches the
   * moment. Defaults to 'inbox' — the primary guest wall (reading/replying to
   * anonymous messages).
   */
  reason?: 'inbox' | 'thread';
}

const SignupPromptModal: React.FC<SignupPromptModalProps> = ({ isOpen, onClose, reason = 'inbox' }) => {
  const router = useRouter();
  const { session, sessionInfo } = useUserStore();

  const navigateToAuth = async (view: 'signup' | 'login' = 'signup') => {
    if (sessionInfo || session.user?.isAnonymous) {
      await rawAuth.signOut();
    }
    router.push(`/auth?force=1&view=${view}`);
  };

  if (!isOpen) return null;

  const isInbox = reason !== 'thread';

  const copy = isInbox
    ? {
        title: 'Sign up to keep talking',
        subtitle: 'So their reply has somewhere to land',
        intro:
          "You want them to actually reply back, we need somewhere anonymous for that reply to go.",
        benefits: [
          { icon: MessageCircle, color: 'text-purple-600', text: <>Get their reply the moment it comes in</> },
          { icon: Lock, color: 'text-orange-600', text: <>Stay completely anonymous — no name, ever</> },
          { icon: FolderOpen, color: 'text-green-600', text: <>Keep the whole back-and-forth in one place</> },
        ],
        note: <>Don&apos;t worry — this isn&apos;t a real name or a public profile. Just enough to make sure their reply finds you.</>,
        cta: 'Continue anonymously — 10 seconds',
      }
    : {
        title: 'Sign Up Required',
        subtitle: 'Unlock thread creation',
        intro: 'Create an account to start your own threads and join the conversation as a creator.',
        benefits: [
          { icon: MessageCircle, color: 'text-purple-600', text: <><strong>Create unlimited threads</strong> and start discussions</> },
          { icon: Reply, color: 'text-orange-600', text: <><strong>Reply and take part</strong> across the community</> },
          { icon: Bell, color: 'text-green-600', text: <><strong>Build trust</strong> through thoughtful participation</> },
        ],
        note: <>💡 <strong>Don&apos;t worry!</strong> Your likes and comments will be preserved when you sign up.</>,
        cta: 'Sign Up Now',
      };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center modal-safe-overlay"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="bg-white rounded-xl shadow-2xl w-full max-w-md modal-safe-panel overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="relative bg-gradient-to-br from-purple-500 to-orange-500 p-6 text-white">
            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-1 hover:bg-white/20 rounded-full transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            
            <div className="flex items-center gap-3 mb-3">
              <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                <Lock className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-xl font-bold">{copy.title}</h2>
                <p className="text-sm text-white/90">{copy.subtitle}</p>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="p-6 space-y-6">
            <div className="text-center">
              <p className="text-gray-700 mb-4">
                {copy.intro}
              </p>
            </div>

            {/* Benefits */}
            <div className="space-y-3">
              {!isInbox && (
                <h3 className="font-semibold text-gray-900 text-sm">With an account, you can:</h3>
              )}

              <div className="space-y-2.5">
                {copy.benefits.map(({ icon: Icon, color, text }, i) => (
                  <div key={i} className="flex items-start gap-3 text-sm text-gray-700">
                    <Icon className={`w-5 h-5 ${color} flex-shrink-0 mt-0.5`} />
                    <span>{text}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Current Session Note */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-xs text-blue-800">
                {copy.note}
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col gap-3">
              <button
                onClick={() => navigateToAuth('signup')}
                className="w-full py-3 bg-gradient-to-r from-purple-500 to-orange-500 text-white rounded-lg font-semibold hover:opacity-90 transition-opacity shadow-lg"
              >
                {copy.cta}
              </button>
              
              <button
                onClick={onClose}
                className="w-full py-3 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors"
              >
                Maybe Later
              </button>
            </div>

            <p className="text-xs text-center text-gray-500">
              Already have an account? <button onClick={() => navigateToAuth('login')} className="text-purple-600 hover:underline">Log in</button>
            </p>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default SignupPromptModal;
