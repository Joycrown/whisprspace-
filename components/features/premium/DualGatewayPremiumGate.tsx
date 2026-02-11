'use client'

/**
 * Flutterwave Premium Thread Gate
 * Single gateway checkout for premium threads
 */

import { useState, useEffect } from 'react'
import { usePremiumThread } from '@/lib/stripe/usePremiumThread'
import { getUserCountry } from '@/lib/payments/geo'
import { getCurrencyForCountry, convertPrice, formatCurrency } from '@/lib/payments/currency'

interface DualGatewayPremiumGateProps {
  threadId: string
  price: number // USD price
  children: React.ReactNode
}

export function DualGatewayPremiumGate({
  threadId,
  price,
  children,
}: DualGatewayPremiumGateProps) {
  const [userCountry, setUserCountry] = useState<string>('US')
  const [isDetecting, setIsDetecting] = useState(true)
  const [showInviteInput, setShowInviteInput] = useState(false)
  const [inviteCode, setInviteCode] = useState('')

  const {
    hasAccess,
    isChecking,
    isPurchasing,
    error,
    purchaseAccess,
    redeemInvite,
    clearError,
  } = usePremiumThread(threadId)

  useEffect(() => {
    getUserCountry().then((country) => {
      setUserCountry(country)
      setIsDetecting(false)
    })
  }, [])

  const handlePurchase = async () => {
    const currency = getCurrencyForCountry(userCountry)
    await purchaseAccess(userCountry, currency)
  }

  if (isChecking || isDetecting) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500" />
      </div>
    )
  }

  if (hasAccess) {
    return <>{children}</>
  }

  const currency = getCurrencyForCountry(userCountry)
  const localPrice = convertPrice(price, currency)
  const displayPrice = formatCurrency(localPrice, currency)

  return (
    <div className="max-w-2xl mx-auto p-8">
      <div className="bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 rounded-2xl p-8 shadow-lg">
        <div className="flex justify-center mb-6">
          <div className="w-20 h-20 bg-purple-500 rounded-full flex items-center justify-center">
            <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
        </div>

        <h2 className="text-3xl font-bold text-center mb-4">Premium Content</h2>

        <p className="text-center text-gray-600 dark:text-gray-300 mb-8">
          This is a premium thread. Purchase access to view the full content and participate.
        </p>

        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 mb-6 text-center">
          <div className="text-4xl font-bold text-purple-600 dark:text-purple-400">
            {displayPrice}
          </div>
          <div className="text-sm text-gray-500 mt-2">
            One-time payment - Lifetime access
          </div>
        </div>

        <div className="space-y-3 mb-8">
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0">
              <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            </div>
            <span>Lifetime access to thread content</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0">
              <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            </div>
            <span>Participate in discussions</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0">
              <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            </div>
            <span>Support the creator (70% goes to them)</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0">
              <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            </div>
            <span>Pay with cards, bank transfer, mobile money, or USSD (where supported)</span>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
            <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>
            <button
              onClick={clearError}
              className="text-red-600 dark:text-red-400 text-xs underline mt-2"
            >
              Dismiss
            </button>
          </div>
        )}

        <button
          onClick={handlePurchase}
          disabled={isPurchasing}
          className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 disabled:opacity-50 text-white font-semibold py-4 px-6 rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl disabled:cursor-not-allowed"
        >
          {isPurchasing ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Processing...
            </span>
          ) : (
            `Purchase Access - ${displayPrice}`
          )}
        </button>

        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-300 dark:border-gray-600" />
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-4 bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 text-gray-500">Or</span>
          </div>
        </div>

        {!showInviteInput ? (
          <button
            onClick={() => setShowInviteInput(true)}
            className="w-full text-purple-600 dark:text-purple-400 hover:underline text-sm font-medium"
          >
            Have an invite code?
          </button>
        ) : (
          <div className="space-y-3">
            <input
              type="text"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
              placeholder="Enter invite code"
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 dark:bg-gray-800"
            />
            <div className="flex gap-2">
              <button
                onClick={() => redeemInvite(inviteCode)}
                disabled={!inviteCode || isPurchasing}
                className="flex-1 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-medium py-2 px-4 rounded-lg transition-colors disabled:cursor-not-allowed"
              >
                {isPurchasing ? 'Redeeming...' : 'Redeem Code'}
              </button>
              <button
                onClick={() => {
                  setShowInviteInput(false)
                  setInviteCode('')
                }}
                className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
            </svg>
            Secure payment powered by Flutterwave
          </div>
        </div>
      </div>
    </div>
  )
}
