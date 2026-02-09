'use client'

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useUserStore } from '@/store/userStore';
import { motion } from 'framer-motion';
import { Settings, TrendingUp, Calendar, Clock, ArrowLeft, DollarSign, Crown, Edit3 } from 'lucide-react';
import NotificationPreferencesModal from '@/components/features/notifications/NotificationPreferencesModal';
import ActivityFeed from '@/components/features/profile/ActivityFeed';
import PremiumPaymentForm from '@/components/features/premium/PremiumPaymentForm';
import UsernameChanger from '@/components/features/profile/UsernameChanger';

const ProfilePage = () => {
  const router = useRouter();
  const { session } = useUserStore();
  const [showPreferencesModal, setShowPreferencesModal] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<'monthly' | 'annual' | null>(null);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [showUsernameModal, setShowUsernameModal] = useState(false);

  const currentUser = useMemo(() => session.user, [session.user]);

  const handleUpgradeSuccess = () => {
    // TODO: Update user premium status in backend
    alert('🎉 Welcome to Premium! Your account has been upgraded successfully.');
    setShowUpgradeModal(false);
    setShowPaymentForm(false);
    setSelectedPlan(null);
  };


  if (!currentUser) {
    return <div className="flex flex-col items-center justify-center h-screen bg-[#121212] text-white">Please log in to view your profile.</div>;
  }

  return (
    <div className="flex flex-col h-screen bg-[#121212]">
      <div className="flex items-center justify-between p-4 border-b border-gray-800">
        <button onClick={() => router.back()} className="text-gray-400 hover:text-white"><ArrowLeft className="w-5 h-5" /></button>
        <h1 className="text-xl font-bold text-white">My Profile</h1>
        <button onClick={() => setShowPreferencesModal(true)} className="text-gray-400 hover:text-white">
          <Settings className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-hide p-4 pb-28 sm:pb-4">
        <div className="bg-[#1E1E1E] rounded-lg p-6 mb-6">
          <div className="flex items-center gap-4 mb-4">
            <div
              className="w-20 h-20 rounded-full flex items-center justify-center text-white text-3xl font-bold bg-purple-600"
            >
              {(currentUser.username || currentUser.anonymousId).charAt(0).toUpperCase()}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h2 className="text-2xl font-bold text-white">{currentUser.username || currentUser.anonymousId}</h2>
                <button
                  onClick={() => setShowUsernameModal(true)}
                  className="p-2 hover:bg-gray-700 rounded-full transition-colors group"
                  title="Edit username"
                >
                  <Edit3 className="w-5 h-5 text-gray-400 group-hover:text-purple-400 transition-colors" />
                </button>
              </div>
              <p className="text-gray-400">Anonymous User</p>
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
          <div className="bg-[#1E1E1E] rounded-lg p-6 border border-gray-800">
            <h3 className="text-xl font-bold text-white mb-4">Premium Status</h3>
            {currentUser.isPremium ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-green-400">
                  <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                  <span className="font-medium">Active Premium Member</span>
                </div>
                <button className="w-full px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors">Manage Subscription</button>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-gray-400 text-sm">Unlock exclusive features with Premium.</p>
                <button
                  onClick={() => setShowUpgradeModal(true)}
                  className="w-full px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  <Crown className="w-4 h-4" />
                  Upgrade to Premium
                </button>
              </div>
            )}
          </div>

          {/* Creator Earnings */}
          <div className="bg-[#1E1E1E] rounded-lg p-6 border border-gray-800">
            <h3 className="text-xl font-bold text-white mb-4">Creator Earnings</h3>
            <div className="space-y-3">
              <p className="text-gray-400 text-sm">Track your premium content earnings</p>
              <button
                onClick={() => router.push('/profile/earnings')}
                className="w-full px-4 py-2 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                <DollarSign className="w-4 h-4" />
                View Earnings
              </button>
            </div>
          </div>
        </div>


      </div>

      {/* Notification Preferences Modal */}
      <NotificationPreferencesModal
        isOpen={showPreferencesModal}
        onClose={() => setShowPreferencesModal(false)}
      />


      {/* Upgrade to Premium Modal */}
      {showUpgradeModal && !showPaymentForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 pb-20 sm:pb-4">
          <div className="relative w-full max-w-2xl max-h-[85vh] sm:max-h-[90vh] bg-gradient-to-br from-purple-900 to-blue-900 rounded-2xl shadow-2xl p-4 sm:p-6 md:p-8 text-white overflow-y-auto mb-4 sm:mb-0">
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
                <div className="text-xl sm:text-2xl font-bold mb-1">$9.99/mo</div>
                <div className="text-xs sm:text-sm text-purple-200">Monthly Plan</div>
              </button>
              <button
                onClick={() => setSelectedPlan('annual')}
                className={`bg-white/10 backdrop-blur rounded-lg p-4 border-2 transition-all hover:bg-white/20 ${selectedPlan === 'annual' ? 'border-yellow-500' : 'border-transparent'
                  }`}
              >
                <div className="text-xl sm:text-2xl font-bold mb-1">$89.99/yr</div>
                <div className="text-xs sm:text-sm text-purple-200">
                  Annual Plan <span className="text-green-400 font-semibold">(Save 25%)</span>
                </div>
              </button>
            </div>

            <div className="space-y-2 sm:space-y-3 mb-6 sm:mb-8">
              <h3 className="font-semibold text-base sm:text-lg mb-2 sm:mb-3">Premium Features:</h3>
              <div className="flex items-start gap-2 sm:gap-3">
                <div className="w-4 h-4 sm:w-5 sm:h-5 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 text-xs sm:text-sm">✓</div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm sm:text-base">Create Premium Threads</div>
                  <div className="text-xs sm:text-sm text-purple-200">Monetize your content with $1-$4.99 pricing</div>
                </div>
              </div>
              <div className="flex items-start gap-2 sm:gap-3">
                <div className="w-4 h-4 sm:w-5 sm:h-5 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 text-xs sm:text-sm">✓</div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm sm:text-base">Higher Revenue Split</div>
                  <div className="text-xs sm:text-sm text-purple-200">Earn 70% on all sales (vs 60% for free users)</div>
                </div>
              </div>
              <div className="flex items-start gap-2 sm:gap-3">
                <div className="w-4 h-4 sm:w-5 sm:h-5 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 text-xs sm:text-sm">✓</div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm sm:text-base">Unlimited Polls</div>
                  <div className="text-xs sm:text-sm text-purple-200">Create as many polls as you want</div>
                </div>
              </div>
              <div className="flex items-start gap-2 sm:gap-3">
                <div className="w-4 h-4 sm:w-5 sm:h-5 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 text-xs sm:text-sm">✓</div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm sm:text-base">Priority Support</div>
                  <div className="text-xs sm:text-sm text-purple-200">Get help faster with dedicated support</div>
                </div>
              </div>
              <div className="flex items-start gap-2 sm:gap-3">
                <div className="w-4 h-4 sm:w-5 sm:h-5 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 text-xs sm:text-sm">✓</div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm sm:text-base">Premium Badge</div>
                  <div className="text-xs sm:text-sm text-purple-200">Stand out with an exclusive badge</div>
                </div>
              </div>
              <div className="flex items-start gap-2 sm:gap-3">
                <div className="w-4 h-4 sm:w-5 sm:h-5 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 text-xs sm:text-sm">✓</div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm sm:text-base">Advanced Analytics</div>
                  <div className="text-xs sm:text-sm text-purple-200">Track your content performance in detail</div>
                </div>
              </div>
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
          plan={selectedPlan}
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-[#1E1E1E] rounded-xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto"
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
