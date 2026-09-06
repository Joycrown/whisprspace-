'use client'

/**
 * Flutterwave Premium Thread Gate
 * Single gateway checkout for premium threads
 */

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { usePremiumThread } from '@/lib/stripe/usePremiumThread'
import { getUserCountry } from '@/lib/payments/geo'
import { getCurrencyForCountry, formatCurrency, SupportedCurrency } from '@/lib/payments/currency'

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
  const [localPrice, setLocalPrice] = useState<number | null>(null)
  const [localCurrency, setLocalCurrency] = useState<SupportedCurrency>('USD')
  const [showInviteInput, setShowInviteInput] = useState(false)
  const [inviteCode, setInviteCode] = useState('')
  const [buyerLikes, setBuyerLikes] = useState<{ liked: number; total: number } | null>(null)

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
    getUserCountry().then(async (country) => {
      setUserCountry(country)
      const currency = getCurrencyForCountry(country)
      setLocalCurrency(currency)

      try {
        const res = await fetch(
          `/api/flutterwave/rate?currency=${currency}&amount=${price}`
        )
        if (res.ok) {
          const data = await res.json()
          setLocalPrice(data.convertedAmount)
        } else {
          // Fallback: keep null → show loading state replaced by USD price
          setLocalPrice(price)
        }
      } catch {
        setLocalPrice(price)
        setLocalCurrency('USD')
      }

      setIsDetecting(false)
    })
  }, [price])

  useEffect(() => {
    // Fetch buyer likes signal — only surfaces on paywall once ≥10 paid buyers exist
    fetch(`/api/threads/${threadId}/buyer-likes`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data && data.paid_buyer_count >= 10) {
          setBuyerLikes({ liked: data.liked_count, total: data.paid_buyer_count })
        }
      })
      .catch(() => {})
  }, [threadId])

  useEffect(() => {
    if (hasAccess) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [hasAccess])

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

  const currency = localCurrency
  const displayPrice = localPrice != null
    ? formatCurrency(localPrice, currency)
    : formatCurrency(price, 'USD')

  const modal = (
    <div className="fixed inset-0 z-[1200] bg-black/75 backdrop-blur-sm flex items-center justify-center modal-safe-overlay">
      <div className="w-full max-w-md modal-safe-panel rounded-2xl border border-gray-800 bg-[#121212] shadow-2xl p-6 overflow-y-auto">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-600 to-orange-500 flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">Premium Discussion</h2>
            <p className="text-xs text-gray-400">Unlock full access to view and participate.</p>
          </div>
        </div>

        <div className="rounded-xl border border-gray-800 bg-gray-900/60 p-4 text-center mb-4">
          <div className="text-3xl font-bold text-white">{displayPrice}</div>
          <div className="text-xs text-gray-400 mt-1">One-time payment · Lifetime access</div>
          {buyerLikes && (
            <div className="mt-2 text-xs text-purple-300">
              {buyerLikes.liked} of {buyerLikes.total} buyers liked this
            </div>
          )}
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/40 rounded-lg p-3 mb-3">
            <p className="text-red-200 text-xs">{error}</p>
            <button
              onClick={clearError}
              className="text-red-200 text-xs underline mt-2"
            >
              Dismiss
            </button>
          </div>
        )}

        <button
          onClick={handlePurchase}
          disabled={isPurchasing}
          className="w-full bg-gradient-to-r from-purple-600 to-orange-500 hover:from-purple-700 hover:to-orange-600 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition-all duration-200 shadow-lg disabled:cursor-not-allowed"
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
            `Unlock for ${displayPrice}`
          )}
        </button>

        <div className="relative my-4">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-800" />
          </div>
          <div className="relative flex justify-center text-xs">
            <span className="px-3 bg-[#121212] text-gray-500">Invite code</span>
          </div>
        </div>

        {!showInviteInput ? (
          <button
            onClick={() => setShowInviteInput(true)}
            className="w-full text-sm text-purple-300 hover:text-purple-200 transition-colors"
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
              className="w-full px-4 py-2.5 border border-gray-800 rounded-lg bg-gray-900 text-white text-sm focus:ring-2 focus:ring-purple-500"
            />
            <div className="flex gap-2">
              <button
                onClick={() => redeemInvite(inviteCode)}
                disabled={!inviteCode || isPurchasing}
                className="flex-1 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-sm font-medium py-2.5 px-4 rounded-lg transition-colors disabled:cursor-not-allowed"
              >
                {isPurchasing ? 'Redeeming...' : 'Redeem Code'}
              </button>
              <button
                onClick={() => {
                  setShowInviteInput(false)
                  setInviteCode('')
                }}
                className="px-4 py-2.5 text-gray-400 hover:text-gray-200 text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )

  return typeof window === 'undefined' ? null : (
    <>
      {createPortal(modal, document.body)}
    </>
  )
}
