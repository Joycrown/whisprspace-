'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Lock, Zap, Crown, MessageCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useUserStore } from '@/store/userStore';
import * as rawAuth from '@/lib/core/supabase/raw-auth';

interface SignupPromptModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SignupPromptModal: React.FC<SignupPromptModalProps> = ({ isOpen, onClose }) => {
  const router = useRouter();
  const { session, sessionInfo } = useUserStore();

  const navigateToAuth = async (view: 'signup' | 'login' = 'signup') => {
    if (sessionInfo || session.user?.isAnonymous) {
      await rawAuth.signOut();
    }
    router.push(`/auth?force=1&view=${view}`);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden"
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
                <h2 className="text-xl font-bold">Sign Up Required</h2>
                <p className="text-sm text-white/90">Unlock thread creation</p>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="p-6 space-y-6">
            <div className="text-center">
              <p className="text-gray-700 mb-4">
                Create an account to start your own threads and join the conversation as a creator.
              </p>
            </div>

            {/* Benefits */}
            <div className="space-y-3">
              <h3 className="font-semibold text-gray-900 text-sm">With an account, you can:</h3>
              
              <div className="space-y-2">
                <div className="flex items-start gap-3 text-sm text-gray-700">
                  <MessageCircle className="w-5 h-5 text-purple-600 flex-shrink-0 mt-0.5" />
                  <span><strong>Create unlimited threads</strong> and start discussions</span>
                </div>
                
                <div className="flex items-start gap-3 text-sm text-gray-700">
                  <Crown className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
                  <span><strong>Launch premium threads</strong> and earn from your content</span>
                </div>
                
                <div className="flex items-start gap-3 text-sm text-gray-700">
                  <Zap className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <span><strong>Build trust</strong> through thoughtful participation</span>
                </div>
              </div>
            </div>

            {/* Current Session Note */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-xs text-blue-800">
                💡 <strong>Don't worry!</strong> Your likes and comments will be preserved when you sign up.
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col gap-3">
              <button
                onClick={() => navigateToAuth('signup')}
                className="w-full py-3 bg-gradient-to-r from-purple-500 to-orange-500 text-white rounded-lg font-semibold hover:opacity-90 transition-opacity shadow-lg"
              >
                Sign Up Now
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
