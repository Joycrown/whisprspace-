'use client';

import React, { useState } from 'react';
import { Loader2, XCircle, Crown, ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useUserStore } from '@/store/userStore';
import { createPremiumUpgradeSession } from '@/lib/flutterwave/flutterwave-service';
import { getUserCountry } from '@/lib/payments/geo';
import { getCurrencyForCountry, convertPrice, formatCurrency } from '@/lib/payments/currency';
import posthog from 'posthog-js';

interface PremiumPaymentFormProps {
  initialPlan?: 'monthly' | 'annual';
  onSuccess: () => void;
  onCancel: () => void;
}

export default function PremiumPaymentForm({
  initialPlan = 'monthly',
  onSuccess,
  onCancel
}: PremiumPaymentFormProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<'monthly' | 'annual'>(initialPlan);
  const router = useRouter();
  const { session } = useUserStore();
  const [userCountry, setUserCountry] = useState<string>('US');

  React.useEffect(() => {
    getUserCountry().then(setUserCountry);
  }, []);

  const currency = getCurrencyForCountry(userCountry);
  void onSuccess;

  type PlanDetail = {
    price: number;
    name: string;
    period: string;
    savings?: string;
  };

  const planDetails: Record<'monthly' | 'annual', PlanDetail> = {
    monthly: { price: 2.0, name: 'Monthly Plan', period: 'month' },
    annual: { price: 18.0, name: 'Annual Plan', period: 'year', savings: '25%' }
  };

  const selectedPlanDetails = planDetails[selectedPlan];

  // Start premium upgrade checkout
  const handlePayment = async () => {
    setIsProcessing(true);
    setError(null);

    try {
      if (!session?.user?.id) {
        onCancel();
        router.push('/auth');
        return;
      }

      const { url, txRef, error: checkoutError } = await createPremiumUpgradeSession(selectedPlan, currency);
      if (checkoutError || !url) {
        throw new Error(checkoutError || 'Payment link unavailable. Please try again.');
      }

      try {
        posthog.capture('premium_upgrade_started', {
          plan: selectedPlan,
          currency,
        });
      } catch {
        // ignore analytics errors
      }

      if (txRef && typeof window !== 'undefined') {
        localStorage.setItem('whispr_premium_tx_ref', txRef);
      }

      window.location.href = url;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Payment failed');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm modal-safe-overlay">
      <div className="relative w-full max-w-md modal-safe-panel bg-white dark:bg-gray-900 rounded-2xl shadow-2xl p-4 sm:p-6 overflow-y-auto">
        {/* Back Button */}
        <button
          onClick={onCancel}
          className="absolute top-4 left-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
        >
          <ArrowLeft size={20} />
        </button>

        {/* Header */}
        <div className="mb-6 pt-8">
          <div className="flex items-center justify-center mb-4">
            <div className="p-3 bg-gradient-to-br from-purple-500 to-blue-600 rounded-full">
              <Crown className="text-white" size={28} />
            </div>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white mb-2 text-center">
            Complete Your Upgrade
          </h2>

          {/* Plan Toggle */}
          <div className="flex justify-center mb-6">
            <div className="bg-gray-100 dark:bg-gray-800 p-1 rounded-lg inline-flex">
              <button
                onClick={() => setSelectedPlan('monthly')}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${selectedPlan === 'monthly'
                  ? 'bg-white dark:bg-gray-700 text-purple-600 dark:text-white shadow-sm'
                  : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                  }`}
              >
                Monthly
              </button>
              <button
                onClick={() => setSelectedPlan('annual')}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${selectedPlan === 'annual'
                  ? 'bg-white dark:bg-gray-700 text-purple-600 dark:text-white shadow-sm'
                  : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                  }`}
              >
                Annual <span className="text-xs text-green-500 ml-1">(-25%)</span>
              </button>
            </div>
          </div>
          <div className="flex items-center justify-between p-4 bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 rounded-lg">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Plan</p>
              <p className="font-semibold text-gray-900 dark:text-white">{selectedPlanDetails.name}</p>
              {selectedPlan === 'annual' && (
                <p className="text-xs text-green-600 dark:text-green-400 font-medium">Save {selectedPlanDetails.savings}!</p>
              )}
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-600 dark:text-gray-400">Total</p>
              <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                {formatCurrency(convertPrice(selectedPlanDetails.price, currency), currency)}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">per {selectedPlanDetails.period}</p>
            </div>
          </div>
        </div>

        <div className="mb-6">
          <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg space-y-2">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              You will be redirected to complete payment.
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Your subscription renews every {selectedPlanDetails.period}. Cancel anytime.
            </p>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-4 p-3 sm:p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-start gap-3">
            <XCircle className="text-red-500 flex-shrink-0 mt-0.5" size={18} />
            <div>
              <p className="font-medium text-red-900 dark:text-red-100 text-sm">Payment Failed</p>
              <p className="text-xs sm:text-sm text-red-700 dark:text-red-300">{error}</p>
            </div>
          </div>
        )}

        {/* Payment Info */}
        <div className="mb-6 p-3 sm:p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <p className="text-xs text-gray-600 dark:text-gray-400 text-center">
            Secure payment. Your payment information is encrypted and never stored on our servers.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
          <button
            onClick={onCancel}
            disabled={isProcessing}
            className="w-full sm:flex-1 py-2.5 sm:py-3 px-4 border-2 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base"
          >
            Cancel
          </button>

          <button
            onClick={handlePayment}
            disabled={isProcessing}
            className="w-full sm:flex-1 py-2.5 sm:py-3 px-4 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg font-medium hover:from-purple-700 hover:to-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm sm:text-base"
          >
            {isProcessing ? (
              <>
                <Loader2 className="animate-spin" size={18} />
                Processing...
              </>
            ) : (
              <>
                <Crown size={18} />
                Proceed to payment
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
