import { supabase } from '@/lib/core/supabase/client'

/**
 * Create a Flutterwave Checkout session for thread purchase
 */
export const createThreadPurchaseSession = async (
  threadId: string
): Promise<{ url: string | null; error: string | null }> => {
  try {
    // Call Flutterwave checkout initialization
    const response = await fetch('/api/flutterwave/initialize', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        threadId,
      }),
    })

    if (!response.ok) {
      const error = await response.json()
      const message = error?.error || error?.message || 'Failed to create checkout session'
      return { url: null, error: message }
    }

    const { url } = await response.json()
    return { url, error: null }
  } catch (error) {
    console.error('Create checkout session error:', error)
    return { url: null, error: 'An unexpected error occurred' }
  }
}

/**
 * Check if user has purchased a thread
 */
export const hasThreadAccess = async (
  threadId: string,
  userId: string
): Promise<boolean> => {
  try {
    const { data, error } = await supabase
      .from('thread_purchases')
      .select('id')
      .eq('thread_id', threadId)
      .eq('user_id', userId)
      .single()

    if (error) {
      // No purchase found is not an error
      if (error.code === 'PGRST116') return false
      throw error
    }

    return !!data
  } catch (error) {
    console.error('Check thread access error:', error)
    return false
  }
}

/**
 * Get creator earnings summary
 */
export const getCreatorEarnings = async (creatorId: string) => {
  try {
    const { data, error } = await supabase
      .from('creator_earnings')
      .select('*')
      .eq('creator_id', creatorId)
      .order('created_at', { ascending: false })

    if (error) throw error

    // Calculate totals
    const totalEarnings = data?.reduce((sum, earning) => sum + parseFloat(earning.amount), 0) || 0
    const totalFees = data?.reduce((sum, earning) => sum + parseFloat(earning.platform_fee), 0) || 0
    const netEarnings = data?.reduce((sum, earning) => sum + parseFloat(earning.net_amount), 0) || 0
    const pendingEarnings = data?.filter(e => e.status === 'pending')
      .reduce((sum, earning) => sum + parseFloat(earning.net_amount), 0) || 0
    const paidEarnings = data?.filter(e => e.status === 'paid')
      .reduce((sum, earning) => sum + parseFloat(earning.net_amount), 0) || 0

    return {
      earnings: data || [],
      summary: {
        totalEarnings,
        totalFees,
        netEarnings,
        pendingEarnings,
        paidEarnings,
        transactionCount: data?.length || 0,
      },
    }
  } catch (error) {
    console.error('Get creator earnings error:', error)
    return {
      earnings: [],
      summary: {
        totalEarnings: 0,
        totalFees: 0,
        netEarnings: 0,
        pendingEarnings: 0,
        paidEarnings: 0,
        transactionCount: 0,
      },
    }
  }
}

/**
 * Generate thread invite code
 */
export const generateThreadInvite = async (
  threadId: string,
  creatorId: string,
  maxUses: number = 1,
  expiresInDays: number = 7
): Promise<{ code: string | null; error: string | null }> => {
  try {
    // Generate random code
    const code = Math.random().toString(36).substring(2, 10).toUpperCase()
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + expiresInDays)

    const { data, error } = await supabase
      .from('thread_invites')
      .insert({
        thread_id: threadId,
        code,
        created_by: creatorId,
        max_uses: maxUses,
        expires_at: expiresAt.toISOString(),
      })
      .select('code')
      .single()

    if (error) throw error

    return { code: data.code, error: null }
  } catch (error) {
    console.error('Generate invite error:', error)
    return { code: null, error: 'Failed to generate invite code' }
  }
}

/**
 * Redeem thread invite code
 */
export const redeemThreadInvite = async (
  code: string,
  userId: string
): Promise<{ threadId: string | null; error: string | null }> => {
  try {
    // Get invite
    const { data: invite, error: inviteError } = await supabase
      .from('thread_invites')
      .select('*, thread:threads(*)')
      .eq('code', code)
      .single()

    if (inviteError) {
      return { threadId: null, error: 'Invalid invite code' }
    }

    // Check if expired
    if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
      return { threadId: null, error: 'Invite code has expired' }
    }

    // Check if max uses reached
    if (invite.current_uses >= invite.max_uses) {
      return { threadId: null, error: 'Invite code has been fully used' }
    }

    // Grant access (create purchase with $0)
    const { error: purchaseError } = await supabase
      .from('thread_purchases')
      .insert({
        thread_id: invite.thread_id,
        user_id: userId,
        amount: 0, // Free access via invite
      })

    if (purchaseError) {
      // Check if already purchased
      if (purchaseError.code === '23505') {
        return { threadId: invite.thread_id, error: null }
      }
      throw purchaseError
    }

    // Increment uses
    await supabase
      .from('thread_invites')
      .update({ current_uses: invite.current_uses + 1 })
      .eq('id', invite.id)

    return { threadId: invite.thread_id, error: null }
  } catch (error) {
    console.error('Redeem invite error:', error)
    return { threadId: null, error: 'Failed to redeem invite code' }
  }
}

/**
 * Get thread purchase statistics
 */
export const getThreadPurchaseStats = async (threadId: string) => {
  try {
    const { data, error } = await supabase
      .from('thread_purchases')
      .select('*')
      .eq('thread_id', threadId)

    if (error) throw error

    const totalRevenue = data?.reduce((sum, purchase) => sum + parseFloat(purchase.amount), 0) || 0
    const purchaseCount = data?.length || 0

    return {
      totalRevenue,
      purchaseCount,
      purchases: data || [],
    }
  } catch (error) {
    console.error('Get purchase stats error:', error)
    return {
      totalRevenue: 0,
      purchaseCount: 0,
      purchases: [],
    }
  }
}
