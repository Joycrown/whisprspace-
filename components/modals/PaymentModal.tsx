'use client'

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, CreditCard, CheckCircle, AlertCircle, Gift } from 'lucide-react';
import { getSession as getRawSession } from '@/lib/core/supabase/raw-auth';
import { createThreadPurchaseSession } from '@/lib/flutterwave/flutterwave-service';
import { getUserCountry } from '@/lib/payments/geo';
import { convertPrice, formatCurrency, getCurrencyForCountry } from '@/lib/payments/currency';

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  threadId: string;
  threadTitle: string;
  price: number;
  creatorId: string;
  onSuccess: () => void;
  onValidateCode?: (code: string) => Promise<boolean>;
}

type PaymentStep = 'method' | 'processing' | 'success' | 'error' | 'code';

export default function PaymentModal({
  isOpen,
  onClose,
  threadId,
  threadTitle,
  price,
  onSuccess,
  onValidateCode,
}: PaymentModalProps) {
  const [step, setStep] = useState<PaymentStep>('method');
  const [accessCode, setAccessCode] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [userCountry, setUserCountry] = useState('US');
  const currency = getCurrencyForCountry(userCountry);
  const threadPurchaseTxRefKey = `whispr_thread_tx_ref_${threadId}`;
  const localPrice = convertPrice(price, currency);
  // Calculate platform fee (30%) and creator earnings (70%)
  const platformFee = price * 0.30;
  const creatorEarnings = price * 0.70;
  const localPlatformFee = convertPrice(platformFee, currency);
  const localCreatorEarnings = convertPrice(creatorEarnings, currency);

  useEffect(() => {
    if (!isOpen) return;
    let isActive = true;

    getUserCountry()
      .then((country) => {
        if (isActive && country) {
          setUserCountry(country);
        }
      })
      .catch(() => {
        if (isActive) {
          setUserCountry('US');
        }
      });

    return () => {
      isActive = false;
    };
  }, [isOpen]);

  const handlePayment = async () => {
    setErrorMessage('');
    const rawSession = getRawSession();
    if (!rawSession?.access_token) {
      setErrorMessage('Your session expired. Please log in again.');
      setStep('error');
      return;
    }

    setStep('processing');
    const { url, txRef, error, alreadyPurchased } = await createThreadPurchaseSession(
      threadId,
      userCountry,
      currency
    );

    if (alreadyPurchased) {
      localStorage.removeItem(threadPurchaseTxRefKey);
      setStep('success');
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 1200);
      return;
    }

    if (error || !url) {
      setErrorMessage(error || 'Payment link unavailable. Please try again.');
      setStep('error');
      return;
    }

    if (txRef) {
      localStorage.setItem(threadPurchaseTxRefKey, txRef);
    }

    window.location.href = url;
  };

  const handleValidateAccessCode = async () => {
    if (!accessCode.trim()) {
      setErrorMessage('Please enter an access code');
      return;
    }

    setStep('processing');
    setErrorMessage('');

    try {
      if (onValidateCode) {
        const isValid = await onValidateCode(accessCode.toUpperCase());
        if (isValid) {
          setStep('success');
          setTimeout(() => {
            onSuccess();
            onClose();
          }, 2000);
        } else {
          setErrorMessage('Invalid or expired access code. Please try again.');
          setStep('code');
        }
      }
    } catch {
      setErrorMessage('Failed to validate code. Please try again.');
      setStep('code');
    }
  };

  const resetModal = () => {
    setStep('method');
    setAccessCode('');
    setErrorMessage('');
  };

  const handleClose = () => {
    resetModal();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60]">
        <div className="flex min-h-full items-center justify-center modal-safe-overlay">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="bg-white rounded-xl shadow-2xl w-full max-w-md modal-safe-panel overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
          {/* Header */}
          <div className="flex justify-between items-center p-4 sm:p-6 border-b border-gray-200">
            <h2 className="text-2xl font-bold text-gray-900">Premium Content Access</h2>
            <button
              onClick={handleClose}
              className="text-gray-500 hover:text-gray-700 transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Content */}
          <div className="p-4 sm:p-6 pb-[calc(env(safe-area-inset-bottom)+1rem)]">
            {/* Thread Info */}
            <div className="mb-6 p-4 bg-purple-50 border border-purple-200 rounded-lg">
              <h3 className="font-semibold text-gray-900 mb-2">{threadTitle}</h3>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Price:</span>
                <div className="text-right">
                  <span className="block text-2xl font-bold text-purple-600">
                    {formatCurrency(localPrice, currency)}
                  </span>
                  {currency !== 'USD' && (
                    <span className="text-xs text-gray-500">USD {price.toFixed(2)}</span>
                  )}
                </div>
              </div>
              <div className="mt-2 pt-2 border-t border-purple-200 text-xs text-gray-600">
                <div className="flex justify-between">
                  <span>Creator earnings (70%):</span>
                  <span className="font-medium text-green-600">{formatCurrency(localCreatorEarnings, currency)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Platform fee (30%):</span>
                  <span className="font-medium">{formatCurrency(localPlatformFee, currency)}</span>
                </div>
              </div>
            </div>

            {/* Payment Steps */}
            {step === 'method' && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="space-y-4"
              >
                <h3 className="font-semibold text-gray-900 mb-4">Secure Checkout</h3>

                <div className="w-full p-4 rounded-lg border-2 border-purple-500 bg-purple-50 ring-2 ring-purple-200 text-left">
                  <div className="flex items-center gap-3">
                    <CreditCard className="w-6 h-6 text-purple-600" />
                    <div>
                      <p className="font-medium text-gray-900">Secure Checkout</p>
                      <p className="text-sm text-gray-600">Pay securely with card or bank transfer</p>
                    </div>
                  </div>
                </div>

                <button
                  onClick={handlePayment}
                  className="w-full mt-6 py-3 bg-gradient-to-r from-purple-600 to-orange-500 text-white rounded-lg font-semibold hover:opacity-90 transition-opacity"
                >
                  Proceed to Payment
                </button>

                {/* Access Code Option */}
                <div className="mt-6 flex items-center gap-3">
                  <div className="flex-1 h-px bg-gray-300"></div>
                  <span className="text-sm text-gray-500">OR</span>
                  <div className="flex-1 h-px bg-gray-300"></div>
                </div>

                <button
                  onClick={() => setStep('code')}
                  className="w-full mt-4 py-3 border-2 border-purple-300 text-purple-600 rounded-lg font-semibold hover:bg-purple-50 transition-colors flex items-center justify-center gap-2"
                >
                  <Gift className="w-5 h-5" />
                  I have an access code
                </button>
              </motion.div>
            )}

            {step === 'code' && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="space-y-4"
              >
                <h3 className="font-semibold text-gray-900 mb-4">Enter Access Code</h3>
                
                <p className="text-sm text-gray-600 mb-4">
                  If you have an invite code from the creator, enter it below to get free access to this premium thread.
                </p>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Access Code</label>
                  <input
                    type="text"
                    value={accessCode}
                    onChange={(e) => setAccessCode(e.target.value.toUpperCase())}
                    placeholder="ENTER-CODE-HERE"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-white text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 font-mono text-center text-lg tracking-wider uppercase"
                  />
                </div>

                {errorMessage && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-sm text-red-600">{errorMessage}</p>
                  </div>
                )}

                <div className="flex gap-3">
                  <button
                    onClick={() => setStep('method')}
                    className="flex-1 py-3 border border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-50 transition-colors"
                  >
                    Back
                  </button>
                  <button
                    onClick={handleValidateAccessCode}
                    disabled={!accessCode.trim()}
                    className="flex-1 py-3 bg-gradient-to-r from-purple-600 to-orange-500 text-white rounded-lg font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
                  >
                    Redeem Code
                  </button>
                </div>
              </motion.div>
            )}

            {step === 'processing' && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="py-8 text-center"
              >
                <div className="w-16 h-16 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin mx-auto mb-4"></div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">Redirecting to secure checkout...</h3>
                <p className="text-gray-600">Please wait while we prepare your payment</p>
              </motion.div>
            )}

            {step === 'success' && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="py-8 text-center"
              >
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="w-10 h-10 text-green-600" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">Payment Successful!</h3>
                <p className="text-gray-600">You now have access to this premium thread</p>
              </motion.div>
            )}

            {step === 'error' && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="space-y-4"
              >
                <div className="py-8 text-center">
                  <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <AlertCircle className="w-10 h-10 text-red-600" />
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">Payment Failed</h3>
                  <p className="text-gray-600">{errorMessage}</p>
                </div>
                <button
                  onClick={() => setStep('method')}
                  className="w-full py-3 bg-gradient-to-r from-purple-600 to-orange-500 text-white rounded-lg font-semibold hover:opacity-90 transition-opacity"
                >
                  Try Again
                </button>
              </motion.div>
            )}
          </div>
          </motion.div>
        </div>
      </div>
    </AnimatePresence>
  );
}
