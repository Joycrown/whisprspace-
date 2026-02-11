import { useState, useEffect } from 'react'
import { useUserStore } from '@/store/userStore'
import * as premiumService from './stripe-service'
import { createThreadPurchaseSession } from '@/lib/flutterwave/flutterwave-service'

/**
 * Hook for managing premium thread access
 */
export const usePremiumThread = (threadId: string | null) => {
  const { session } = useUserStore()
  const [hasAccess, setHasAccess] = useState(false)
  const [isChecking, setIsChecking] = useState(true)
  const [isPurchasing, setIsPurchasing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!threadId || !session.user) {
      setIsChecking(false)
      return
    }

    checkAccess()
  }, [threadId, session.user?.id])

  const checkAccess = async () => {
    if (!threadId || !session.user) return

    setIsChecking(true)
    const access = await premiumService.hasThreadAccess(threadId, session.user.id)
    setHasAccess(access)
    setIsChecking(false)
  }

  const purchaseAccess = async (country?: string, currency?: string) => {
    if (!threadId || !session.user) {
      setError('Missing required information')
      return false
    }

    setIsPurchasing(true)
    setError(null)

    const { url, error, alreadyPurchased } = await createThreadPurchaseSession(threadId, country, currency)

    setIsPurchasing(false)

    if (alreadyPurchased) {
      setHasAccess(true)
      return true
    }

    if (error) {
      setError(error)
      return false
    }

    if (url) {
      // Redirect to Flutterwave Checkout
      window.location.href = url
      return true
    }

    return false
  }

  const redeemInvite = async (code: string) => {
    if (!session.user) {
      setError('Must be logged in to redeem invite')
      return false
    }

    setIsPurchasing(true)
    setError(null)

    const { threadId: redeemedThreadId, error } = await premiumService.redeemThreadInvite(
      code,
      session.user.id
    )

    setIsPurchasing(false)

    if (error) {
      setError(error)
      return false
    }

    if (redeemedThreadId) {
      setHasAccess(true)
      return true
    }

    return false
  }

  return {
    hasAccess,
    isChecking,
    isPurchasing,
    error,
    purchaseAccess,
    redeemInvite,
    clearError: () => setError(null),
  }
}

/**
 * Hook for creator earnings
 */
export const useCreatorEarnings = (creatorId: string | null) => {
  const [earnings, setEarnings] = useState<any[]>([])
  const [summary, setSummary] = useState({
    totalEarnings: 0,
    totalFees: 0,
    netEarnings: 0,
    pendingEarnings: 0,
    paidEarnings: 0,
    transactionCount: 0,
  })
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!creatorId) {
      setIsLoading(false)
      return
    }

    fetchEarnings()
  }, [creatorId])

  const fetchEarnings = async () => {
    if (!creatorId) return

    setIsLoading(true)
    const data = await premiumService.getCreatorEarnings(creatorId)
    setEarnings(data.earnings)
    setSummary(data.summary)
    setIsLoading(false)
  }

  return {
    earnings,
    summary,
    isLoading,
    refresh: fetchEarnings,
  }
}

/**
 * Hook for thread purchase statistics (for creators)
 */
export const useThreadPurchaseStats = (threadId: string | null) => {
  const [stats, setStats] = useState({
    totalRevenue: 0,
    purchaseCount: 0,
    purchases: [],
  })
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!threadId) {
      setIsLoading(false)
      return
    }

    fetchStats()
  }, [threadId])

  const fetchStats = async () => {
    if (!threadId) return

    setIsLoading(true)
    const data = await premiumService.getThreadPurchaseStats(threadId)
    setStats(data)
    setIsLoading(false)
  }

  return {
    ...stats,
    isLoading,
    refresh: fetchStats,
  }
}

/**
 * Hook for generating and managing thread invites
 */
export const useThreadInvites = (threadId: string | null, creatorId: string | null) => {
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const generateInvite = async (maxUses: number = 1, expiresInDays: number = 7) => {
    if (!threadId || !creatorId) {
      setError('Missing thread or creator information')
      return null
    }

    setIsGenerating(true)
    setError(null)

    const { code, error } = await premiumService.generateThreadInvite(
      threadId,
      creatorId,
      maxUses,
      expiresInDays
    )

    setIsGenerating(false)

    if (error) {
      setError(error)
      return null
    }

    return code
  }

  return {
    generateInvite,
    isGenerating,
    error,
    clearError: () => setError(null),
  }
}
