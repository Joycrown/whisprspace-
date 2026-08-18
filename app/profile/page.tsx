'use client'

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useUserStore } from '@/store/userStore';
import { motion } from 'framer-motion';
import { Settings, TrendingUp, Calendar, Clock, ArrowLeft, DollarSign, Crown, Edit3, BarChart3, Shield } from 'lucide-react';
import NotificationPreferencesModal from '@/components/features/notifications/NotificationPreferencesModal';
import ActivityFeed from '@/components/features/profile/ActivityFeed';
import PremiumPaymentForm from '@/components/features/premium/PremiumPaymentForm';
import UsernameChanger from '@/components/features/profile/UsernameChanger';
import { getUserPollStats } from '@/lib/threads/thread-service';
import { confirmPremiumUpgrade } from '@/lib/flutterwave/flutterwave-service';
import AppLoadingState from '@/components/ui/AppLoadingState';
import { useIsAdmin } from '@/lib/admin';

const ProfilePage = () => {
  const router = useRouter();
  const { session, refreshUser, applyPremiumUpgrade, sessionValidated } = useUserStore();
  const { isAdmin } = useIsAdmin();
  const [showPreferencesModal, setShowPreferencesModal] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<'monthly' | 'annual' | null>(null);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [showUsernameModal, setShowUsernameModal] = useState(false);
  const [pollStats, setPollStats] = useState<{ weeklyCount: number; activeCount: number } | null>(null);
  const premiumConfirmRef = useRef(false);

  const currentUser = useMemo(() => session.user, [session.user]);

  // Auth Redirect Logic
  useEffect(() => {
    // Only redirect if session check is complete and user is not authenticated
    if (sessionValidated && !currentUser) {
      router.push('/auth');
    }
  }, [sessionValidated, currentUser, router]);

  useEffect(() => {
    if (!currentUser?.id) return;
    if (premiumConfirmRef.current) return;

    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const upgrade = params.get('upgrade');
    const gateway = params.get('gateway');
    const status = params.get('status');
    const transactionId = params.get('transaction_id');
    const txRef = params.get('tx_ref');
    const storedTxRef = typeof window !== 'undefined'
      ? localStorage.getItem('whispr_premium_tx_ref')
      : null;

    if (upgrade !== 'success' || gateway !== 'flutterwave') {
      if (!storedTxRef) return;
    }

    if (status && !['successful', 'success', 'succeeded', 'completed'].includes(status.toLowerCase())) {
      return;
    }

    premiumConfirmRef.current = true;

    (async () => {
      const result = await confirmPremiumUpgrade({ transactionId, txRef: txRef || storedTxRef });
      if (result.success) {
        applyPremiumUpgrade(result.premiumExpiresAt);
        await refreshUser();
        if (typeof window !== 'undefined') {
          localStorage.removeItem('whispr_premium_tx_ref');
        }
        router.replace('/profile');
        return;
      }

      console.warn('Premium confirmation failed:', result.error);
    })();
  }, [currentUser?.id, applyPremiumUpgrade, refreshUser, router]);

  useEffect(() => {
    if (!currentUser?.id) return;

    let isActive = true;
    getUserPollStats(currentUser.id).then((stats) => {
      if (isActive) {
        setPollStats(stats);
      }
    });

    return () => {
      isActive = false;
    };
  }, [currentUser?.id]);

  const handleUpgradeSuccess = async () => {
    alert('🎉 Welcome to Premium! Your account has been upgraded successfully.');
    applyPremiumUpgrade();
    await refreshUser();
    setShowUpgradeModal(false);
    setShowPaymentForm(false);
    setSelectedPlan(null);
  };


  if (!sessionValidated || !currentUser) {
    return <AppLoadingState title="Gathering your details..." />;
  }

  return (
    <div className="flex flex-col app-full-height bg-[#121212]">
      <div className="flex items-center justify-between p-4 border-b border-gray-800">
        <button onClick={() => router.push('/threads')} className="text-gray-400 hover:text-white"><ArrowLeft className="w-5 h-5" /></button>
        <h1 className="text-xl font-bold text-white">My Profile</h1>
        <button onClick={() => setShowPreferencesModal(true)} className="text-gray-400 hover:text-white">
          <Settings className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-hide p-4 pb-28 sm:pb-4">
        <div className="bg-[#1E1E1E] rounded-lg p-6 mb-6">
          <div className="flex items-center gap-4 mb-4">
            <div
              className="w-12 h-12 sm:w-16 sm:h-16 rounded-full flex items-center justify-center text-white text-lg sm:text-2xl font-bold bg-purple-600 flex-shrink-0"
            >
              {(currentUser.username || currentUser.anonymousId).charAt(0).toUpperCase()}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 min-w-0">
                <h2 className="text-2xl font-bold text-white flex-1 min-w-0">
                  {currentUser.username || currentUser.anonymousId}
                </h2>
                {currentUser.isPremium && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-300 text-xs font-semibold flex-shrink-0">
                    <Crown className="w-3 h-3" />
                    Premium
                  </span>
                )}
                <button
                  onClick={() => setShowUsernameModal(true)}
                  className="p-2 hover:bg-gray-700 rounded-full transition-colors group flex-shrink-0"
                  title="Edit username"
                >
                  <Edit3 className="w-5 h-5 text-gray-400 group-hover:text-purple-400 transition-colors" />
                </button>
              </div>
              <p className="text-gray-400">
                {currentUser.isPremium ? 'Premium Member' : 'Anonymous User'}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6 text-gray-300">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-blue-400" />
              <span>Engagement: Active</span>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-yellow-400" />
              <span>Joined: {new Date(currentUser.joinedAt).toLocaleDateString()}</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-orange-400" />
              <span>Last Active: {new Date(currentUser.lastActiveAt).toLocaleString()}</span>
            </div>
            <div className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-purple-400" />
              <span>Active Polls: {pollStats ? pollStats.activeCount : '0'}</span>
            </div>
          </div>
        </div>

        {/* User Activity */}
        <div className="bg-[#1E1E1E] rounded-lg p-6 mb-6">
          <h3 className="text-xl font-bold text-white mb-4">My Activity</h3>
          <ActivityFeed userId={currentUser.id} />
        </div>


        {/* Quick Access Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          {/* Premium Status */}
          <div className="bg-[#1E1E1E] rounded-lg p-6 border border-gray-800 h-full flex flex-col">
            <h3 className="text-xl font-bold text-white mb-4">Premium Status</h3>
            {currentUser.isPremium ? (
              <div className="flex flex-col flex-1">
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-green-400">
                    <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                    <span className="font-medium">Active Premium Member</span>
                  </div>
                  {currentUser.premiumExpiresAt && (
                    <p className="text-sm text-gray-400">
                      Renews on {new Date(currentUser.premiumExpiresAt).toLocaleDateString()}
                    </p>
                  )}
                </div>
                <button className="w-full px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors mt-auto">Manage Subscription</button>
              </div>
            ) : (
              <div className="flex flex-col flex-1">
                <p className="text-gray-400 text-sm">Unlock exclusive features with Premium.</p>
                <button
                  onClick={() => setShowUpgradeModal(true)}
                  className="w-full px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white rounded-lg transition-colors flex items-center justify-center gap-2 mt-auto"
                >
                  <Crown className="w-4 h-4" />
                  Upgrade to Premium
                </button>
              </div>
            )}
          </div>

          {/* Creator Earnings */}
          <div className="bg-[#1E1E1E] rounded-lg p-6 border border-gray-800 h-full flex flex-col">
            <h3 className="text-xl font-bold text-white mb-4">Creator Earnings</h3>
            <div className="flex flex-col flex-1">
              <p className="text-gray-400 text-sm">Track your premium content earnings</p>
              <button
                onClick={() => router.push('/profile/earnings')}
                className="w-full px-4 py-2 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white rounded-lg transition-colors flex items-center justify-center gap-2 mt-auto"
              >
                <DollarSign className="w-4 h-4" />
                View Earnings
              </button>
            </div>
          </div>

          {/* Admin Panel (Conditional) */}
          {isAdmin && (
            <div className="bg-[#1E1E1E] rounded-lg p-6 border border-purple-500/30 h-full flex flex-col">
              <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                <Shield className="w-5 h-5 text-purple-400" />
                Admin Panel
              </h3>
              <div className="flex flex-col flex-1">
                <p className="text-gray-400 text-sm">Manage users, reports, and payouts</p>
                <button
                  onClick={() => router.push('/admin')}
                  className="w-full px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white rounded-lg transition-colors flex items-center justify-center gap-2 mt-auto"
                >
                  <Shield className="w-4 h-4" />
                  Go to Dashboard
                </button>
              </div>
            </div>
          )}
        </div>

      </div>

      {/* Notification Preferences Modal */}
      <NotificationPreferencesModal
        isOpen={showPreferencesModal}
        onClose={() => setShowPreferencesModal(false)}
      />


      {/* Upgrade to Premium Modal */}
      {showUpgradeModal && !showPaymentForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm modal-safe-overlay">
          <div className="relative w-full max-w-2xl modal-safe-panel bg-gradient-to-br from-purple-900 to-blue-900 rounded-2xl shadow-2xl p-4 sm:p-6 md:p-8 text-white overflow-y-auto">
            <button
              onClick={() => setShowUpgradeModal(false)}
              className="absolute top-4 right-4 text-white/60 hover:text-white transition-colors"
            >
              ✕
            </button>

            <div className="text-center mb-4 sm:mb-6">
              <div className="inline-flex items-center justify-center w-12 h-12 sm:w-16 sm:h-16 bg-yellow-500 rounded-full mb-3 sm:mb-4">
                <Crown className="w-6 h-6 sm:w-8 sm:h-8 text-white" />
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold mb-2">Upgrade to Premium</h2>
              <p className="text-sm sm:text-base text-purple-200">Unlock exclusive features and boost your experience</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mb-6 sm:mb-8">
              <button
                onClick={() => setSelectedPlan('monthly')}
                className={`bg-white/10 backdrop-blur rounded-lg p-4 border-2 transition-all hover:bg-white/20 ${selectedPlan === 'monthly' ? 'border-yellow-500' : 'border-transparent'
                  }`}
              >
                <div className="text-xl sm:text-2xl font-bold mb-1">$2.50/mo</div>
                <div className="text-xs sm:text-sm text-purple-200">Monthly Plan</div>
              </button>
              <button
                onClick={() => setSelectedPlan('annual')}
                className={`bg-white/10 backdrop-blur rounded-lg p-4 border-2 transition-all hover:bg-white/20 ${selectedPlan === 'annual' ? 'border-yellow-500' : 'border-transparent'
                  }`}
              >
                <div className="text-xl sm:text-2xl font-bold mb-1">$22.50/yr</div>
                <div className="text-xs sm:text-sm text-purple-200">
                  Annual Plan <span className="text-green-400 font-semibold">(Save 25%)</span>
                </div>
              </button>
            </div>

            <div className="space-y-2 mb-6 sm:mb-8">
              <h3 className="font-semibold text-base sm:text-lg mb-2 sm:mb-3">Premium Features:</h3>
              {[
                'Save threads forever',
                'Extend threads by 7 days',
                'Earn more from premium threads',
                "Manage who's in your thread",
                'Change username every 7 days',
                'Premium badge',
              ].map((feature) => (
                <div key={feature} className="flex items-center gap-2 sm:gap-3">
                  <div className="w-4 h-4 sm:w-5 sm:h-5 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0 text-xs sm:text-sm">✓</div>
                  <div className="font-medium text-sm sm:text-base">{feature}</div>
                </div>
              ))}
            </div>

            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
              <button
                onClick={() => {
                  setShowUpgradeModal(false);
                  setSelectedPlan(null);
                }}
                className="w-full sm:flex-1 py-2.5 sm:py-3 px-4 border-2 border-white/30 text-white rounded-lg font-medium hover:bg-white/10 transition-colors text-sm sm:text-base"
              >
                Maybe Later
              </button>
              <button
                onClick={() => {
                  if (!selectedPlan) {
                    alert('Please select a plan first');
                    return;
                  }
                  setShowPaymentForm(true);
                }}
                disabled={!selectedPlan}
                className="w-full sm:flex-1 py-2.5 sm:py-3 px-4 bg-gradient-to-r from-yellow-500 to-orange-500 text-white rounded-lg font-medium hover:from-yellow-600 hover:to-orange-600 transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base"
              >
                <Crown className="w-4 h-4 sm:w-5 sm:h-5" />
                Continue to Payment
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Premium Payment Form */}
      {showPaymentForm && selectedPlan && (
        <PremiumPaymentForm
          initialPlan={selectedPlan}
          onSuccess={handleUpgradeSuccess}
          onCancel={() => {
            setShowPaymentForm(false);
            setSelectedPlan(null);
            setShowUpgradeModal(false);
          }}
        />
      )}

      {/* Username Edit Modal */}
      {showUsernameModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm modal-safe-overlay">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-[#1E1E1E] rounded-xl shadow-2xl max-w-lg w-full modal-safe-panel overflow-y-auto"
          >
            <div className="sticky top-0 bg-[#1E1E1E] border-b border-gray-700 p-4 flex items-center justify-between z-10">
              <h2 className="text-xl font-bold text-white">Edit Username</h2>
              <button
                onClick={() => setShowUsernameModal(false)}
                className="p-2 hover:bg-gray-700 rounded-full transition-colors"
              >
                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6">
              <UsernameChanger onSuccess={() => setShowUsernameModal(false)} />
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default ProfilePage;
