'use client';

import React, { useState } from 'react';
import { CreditCard, Smartphone, Loader2, CheckCircle, XCircle, Crown, ArrowLeft } from 'lucide-react';

interface PremiumPaymentFormProps {
  plan: 'monthly' | 'annual';
  onSuccess: () => void;
  onCancel: () => void;
}

export default function PremiumPaymentForm({
  plan,
  onSuccess,
  onCancel
}: PremiumPaymentFormProps) {
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'apple_pay' | 'google_pay'>('card');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const planDetails = {
    monthly: { price: 9.99, name: 'Monthly Plan', period: 'month' },
    annual: { price: 89.99, name: 'Annual Plan', period: 'year', savings: '25%' }
  };

  const selectedPlanDetails = planDetails[plan];

  // Simulate payment processing (replace with actual Flutterwave integration)
  const handlePayment = async () => {
    setIsProcessing(true);
    setError(null);

    try {
      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 2000));

      // TODO: Integrate actual Flutterwave Payment Intents API for subscription
      // const subscription = await createSubscription({
      //   priceId: plan === 'monthly' ? 'price_monthly_id' : 'price_annual_id',
      //   customerId: userId,
      //   paymentMethod: paymentMethodId
      // });

      // Simulate successful payment
      const success = Math.random() > 0.1; // 90% success rate for demo

      if (success) {
        onSuccess();
      } else {
        throw new Error('Payment failed. Please try again.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Payment failed');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 pb-20 sm:pb-4">
      <div className="relative w-full max-w-md max-h-[85vh] sm:max-h-[90vh] bg-white dark:bg-gray-900 rounded-2xl shadow-2xl p-4 sm:p-6 overflow-y-auto mb-4 sm:mb-0">
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
          <div className="flex items-center justify-between p-4 bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 rounded-lg">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Plan</p>
              <p className="font-semibold text-gray-900 dark:text-white">{selectedPlanDetails.name}</p>
              {plan === 'annual' && (
                <p className="text-xs text-green-600 dark:text-green-400 font-medium">Save {selectedPlanDetails.savings}!</p>
              )}
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-600 dark:text-gray-400">Total</p>
              <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                ${selectedPlanDetails.price.toFixed(2)}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">per {selectedPlanDetails.period}</p>
            </div>
          </div>
        </div>

        {/* Payment Method Selection */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
            Payment Method
          </label>
          
          <div className="space-y-2">
            {/* Apple Pay (if available) */}
            <button
              onClick={() => setPaymentMethod('apple_pay')}
              className={`w-full p-3 sm:p-4 rounded-lg border-2 flex items-center gap-3 transition-all ${
                paymentMethod === 'apple_pay'
                  ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                  : 'border-gray-200 dark:border-gray-700 hover:border-purple-300'
              }`}
            >
              <Smartphone className={paymentMethod === 'apple_pay' ? 'text-purple-500' : 'text-gray-400'} size={20} />
              <div className="flex-1 text-left">
                <p className="font-medium text-gray-900 dark:text-white text-sm sm:text-base">Apple Pay</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Fast & secure</p>
              </div>
              {paymentMethod === 'apple_pay' && (
                <CheckCircle className="text-purple-500" size={18} />
              )}
            </button>

            {/* Google Pay (if available) */}
            <button
              onClick={() => setPaymentMethod('google_pay')}
              className={`w-full p-3 sm:p-4 rounded-lg border-2 flex items-center gap-3 transition-all ${
                paymentMethod === 'google_pay'
                  ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                  : 'border-gray-200 dark:border-gray-700 hover:border-purple-300'
              }`}
            >
              <Smartphone className={paymentMethod === 'google_pay' ? 'text-purple-500' : 'text-gray-400'} size={20} />
              <div className="flex-1 text-left">
                <p className="font-medium text-gray-900 dark:text-white text-sm sm:text-base">Google Pay</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">One-tap checkout</p>
              </div>
              {paymentMethod === 'google_pay' && (
                <CheckCircle className="text-purple-500" size={18} />
              )}
            </button>

            {/* Credit/Debit Card */}
            <button
              onClick={() => setPaymentMethod('card')}
              className={`w-full p-3 sm:p-4 rounded-lg border-2 flex items-center gap-3 transition-all ${
                paymentMethod === 'card'
                  ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                  : 'border-gray-200 dark:border-gray-700 hover:border-purple-300'
              }`}
            >
              <CreditCard className={paymentMethod === 'card' ? 'text-purple-500' : 'text-gray-400'} size={20} />
              <div className="flex-1 text-left">
                <p className="font-medium text-gray-900 dark:text-white text-sm sm:text-base">Credit / Debit Card</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Visa, Mastercard, Amex</p>
              </div>
              {paymentMethod === 'card' && (
                <CheckCircle className="text-purple-500" size={18} />
              )}
            </button>
          </div>
        </div>

        {/* Card Form (only show if card is selected) */}
        {paymentMethod === 'card' && (
          <div className="mb-6 space-y-3 sm:space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Card Number
              </label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="1234 5678 9012 3456"
                  className="w-full px-4 py-2.5 sm:py-3 pl-12 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm sm:text-base"
                  maxLength={19}
                />
                <CreditCard className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Expiry
                </label>
                <input
                  type="text"
                  placeholder="MM/YY"
                  className="w-full px-4 py-2.5 sm:py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm sm:text-base"
                  maxLength={5}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  CVC
                </label>
                <input
                  type="text"
                  placeholder="123"
                  className="w-full px-4 py-2.5 sm:py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm sm:text-base"
                  maxLength={4}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Name (Optional)
              </label>
              <input
                type="text"
                placeholder="Anonymous User"
                className="w-full px-4 py-2.5 sm:py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm sm:text-base"
              />
            </div>
          </div>
        )}

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
            🔒 Secure payment powered by Flutterwave. Your payment information is encrypted and never stored on our servers. Cancel anytime.
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
                Subscribe ${selectedPlanDetails.price.toFixed(2)}/{selectedPlanDetails.period}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

