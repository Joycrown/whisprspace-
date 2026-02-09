'use client'

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, CreditCard, Lock, CheckCircle, AlertCircle, Gift } from 'lucide-react';

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

type PaymentMethod = 'card' | 'paypal' | 'crypto';
type PaymentStep = 'method' | 'details' | 'processing' | 'success' | 'error' | 'code';

export default function PaymentModal({
  isOpen,
  onClose,
  threadId,
  threadTitle,
  price,
  creatorId,
  onSuccess,
  onValidateCode,
}: PaymentModalProps) {
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('card');
  const [step, setStep] = useState<PaymentStep>('method');
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCVV, setCardCVV] = useState('');
  const [accessCode, setAccessCode] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // Calculate platform fee (30%) and creator earnings (70%)
  const platformFee = price * 0.30;
  const creatorEarnings = price * 0.70;

  const handlePayment = async () => {
    setStep('processing');
    setErrorMessage('');

    // Simulate payment processing
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Mock payment success (90% success rate for demo)
    const isSuccess = Math.random() > 0.1;

    if (isSuccess) {
      setStep('success');
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 2000);
    } else {
      setErrorMessage('Payment failed. Please try again or use a different payment method.');
      setStep('error');
    }
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
    } catch (error) {
      setErrorMessage('Failed to validate code. Please try again.');
      setStep('code');
    }
  };

  const resetModal = () => {
    setStep('method');
    setCardNumber('');
    setCardExpiry('');
    setCardCVV('');
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
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="bg-white rounded-xl shadow-2xl w-full max-w-md"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex justify-between items-center p-6 border-b border-gray-200">
            <h2 className="text-2xl font-bold text-gray-900">Premium Content Access</h2>
            <button
              onClick={handleClose}
              className="text-gray-500 hover:text-gray-700 transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6">
            {/* Thread Info */}
            <div className="mb-6 p-4 bg-purple-50 border border-purple-200 rounded-lg">
              <h3 className="font-semibold text-gray-900 mb-2">{threadTitle}</h3>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Price:</span>
                <span className="text-2xl font-bold text-purple-600">${price.toFixed(2)}</span>
              </div>
              <div className="mt-2 pt-2 border-t border-purple-200 text-xs text-gray-600">
                <div className="flex justify-between">
                  <span>Creator earnings (70%):</span>
                  <span className="font-medium text-green-600">${creatorEarnings.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Platform fee (30%):</span>
                  <span className="font-medium">${platformFee.toFixed(2)}</span>
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
                <h3 className="font-semibold text-gray-900 mb-4">Select Payment Method</h3>
                
                <button
                  onClick={() => setPaymentMethod('card')}
                  className={`w-full p-4 rounded-lg border-2 transition-all text-left ${
                    paymentMethod === 'card'
                      ? 'border-purple-500 bg-purple-50 ring-2 ring-purple-200'
                      : 'border-gray-200 hover:border-purple-300'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <CreditCard className={`w-6 h-6 ${paymentMethod === 'card' ? 'text-purple-600' : 'text-gray-600'}`} />
                    <div>
                      <p className="font-medium text-gray-900">Credit/Debit Card</p>
                      <p className="text-sm text-gray-600">Visa, Mastercard, Amex</p>
                    </div>
                  </div>
                </button>

                <button
                  onClick={() => setPaymentMethod('paypal')}
                  className={`w-full p-4 rounded-lg border-2 transition-all text-left ${
                    paymentMethod === 'paypal'
                      ? 'border-purple-500 bg-purple-50 ring-2 ring-purple-200'
                      : 'border-gray-200 hover:border-purple-300'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center ${paymentMethod === 'paypal' ? 'bg-blue-600' : 'bg-gray-400'}`}>
                      <span className="text-white text-xs font-bold">P</span>
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">PayPal</p>
                      <p className="text-sm text-gray-600">Fast & secure</p>
                    </div>
                  </div>
                </button>

                <button
                  onClick={() => setPaymentMethod('crypto')}
                  className={`w-full p-4 rounded-lg border-2 transition-all text-left ${
                    paymentMethod === 'crypto'
                      ? 'border-purple-500 bg-purple-50 ring-2 ring-purple-200'
                      : 'border-gray-200 hover:border-purple-300'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-6 h-6 ${paymentMethod === 'crypto' ? 'text-purple-600' : 'text-gray-600'}`}>₿</div>
                    <div>
                      <p className="font-medium text-gray-900">Cryptocurrency</p>
                      <p className="text-sm text-gray-600">BTC, ETH, USDT</p>
                    </div>
                  </div>
                </button>

                <button
                  onClick={() => setStep('details')}
                  className="w-full mt-6 py-3 bg-gradient-to-r from-purple-600 to-orange-500 text-white rounded-lg font-semibold hover:opacity-90 transition-opacity"
                >
                  Continue
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
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 font-mono text-center text-lg tracking-wider uppercase"
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

            {step === 'details' && paymentMethod === 'card' && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="space-y-4"
              >
                <h3 className="font-semibold text-gray-900 mb-4">Card Details</h3>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Card Number</label>
                  <input
                    type="text"
                    value={cardNumber}
                    onChange={(e) => setCardNumber(e.target.value.replace(/\s/g, '').replace(/(.{4})/g, '$1 ').trim())}
                    placeholder="1234 5678 9012 3456"
                    maxLength={19}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Expiry Date</label>
                    <input
                      type="text"
                      value={cardExpiry}
                      onChange={(e) => setCardExpiry(e.target.value.replace(/(\d{2})(\d)/, '$1/$2').slice(0, 5))}
                      placeholder="MM/YY"
                      maxLength={5}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">CVV</label>
                    <input
                      type="text"
                      value={cardCVV}
                      onChange={(e) => setCardCVV(e.target.value.replace(/\D/g, '').slice(0, 3))}
                      placeholder="123"
                      maxLength={3}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2 text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">
                  <Lock className="w-4 h-4" />
                  <span>Your payment information is encrypted and secure</span>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => setStep('method')}
                    className="flex-1 py-3 border border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-50 transition-colors"
                  >
                    Back
                  </button>
                  <button
                    onClick={handlePayment}
                    disabled={!cardNumber || !cardExpiry || !cardCVV}
                    className="flex-1 py-3 bg-gradient-to-r from-purple-600 to-orange-500 text-white rounded-lg font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
                  >
                    Pay ${price.toFixed(2)}
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
                <h3 className="text-xl font-semibold text-gray-900 mb-2">Processing Payment...</h3>
                <p className="text-gray-600">Please wait while we process your transaction</p>
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
    </AnimatePresence>
  );
}
