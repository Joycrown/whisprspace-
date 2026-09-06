import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabaseServerClient } from '@/lib/core/supabase/server'
import { createClient as createSupabaseAdminClient } from '@supabase/supabase-js'
import type {
  CreatorEarnings,
  CreatorEarningsResponse,
  CreatorEarningsSeries,
  CreatorEarningsTransaction,
  ThreadEarnings,
} from '@/types'

type EarningRow = {
  id: string
  thread_id: string | null
  amount: number | string | null
  platform_fee: number | string | null
  net_amount: number | string | null
  status: string | null
  created_at: string | null
  paid_at: string | null
}

type ThreadRow = {
  id: string
  title: string | null
  price: number | string | null
  created_at: string | null
}

type PayoutRow = {
  id: string
  tx_ref: string | null
  amount: number | string | null
  currency: string | null
  status: string | null
  occurred_at: string | null
}

const supabaseAdmin = createSupabaseAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
)

const DEFAULT_SERIES: CreatorEarningsSeries = {
  week: [0, 0, 0, 0, 0, 0, 0],
  month: [0, 0, 0, 0, 0, 0, 0, 0],
  all: Array.from({ length: 12 }, () => 0),
}

const toNumber = (value: unknown) => {
  const parsed = Number(value ?? 0)
  if (!Number.isFinite(parsed)) return 0
  return parsed
}

const roundCurrency = (value: number) => Number(value.toFixed(2))

const normalizeStatus = (value: unknown) => String(value || '').toLowerCase()

const decodeJwtPayload = (token: string): Record<string, unknown> | null => {
  try {
    const payload = token.split('.')[1]
    if (!payload) return null
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/')
    const padded = normalized.padEnd(
      normalized.length + ((4 - (normalized.length % 4)) % 4),
      '='
    )
    return JSON.parse(Buffer.from(padded, 'base64').toString('utf-8')) as Record<string, unknown>
  } catch {
    return null
  }
}

const resolveUserId = async (request: NextRequest) => {
  const authHeader = request.headers.get('authorization')
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice('Bearer '.length).trim()
    if (token) {
      try {
        const { data, error } = await supabaseAdmin.auth.getUser(token)
        if (!error && data?.user?.id) {
          return data.user.id
        }
      } catch (error) {
        console.error('Failed to resolve user from bearer token:', error)
      }

      if (process.env.NODE_ENV !== 'production') {
        const payload = decodeJwtPayload(token)
        const userId =
          (typeof payload?.sub === 'string' && payload.sub) ||
          (typeof payload?.user_id === 'string' && payload.user_id) ||
          null

        if (userId) {
          const { data: userRow } = await supabaseAdmin
            .from('users')
            .select('id')
            .eq('id', userId)
            .maybeSingle()

          if (userRow?.id) {
            return userRow.id
          }
        }
      }
    }
  }

  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.auth.getUser()
  if (error || !data?.user?.id) return null
  return data.user.id
}

const buildEarningsSeries = (rows: EarningRow[]): CreatorEarningsSeries => {
  if (!rows.length) return DEFAULT_SERIES

  const now = new Date()

  const weekBuckets = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(now)
    date.setDate(now.getDate() - (6 - index))
    date.setHours(0, 0, 0, 0)
    return { date, total: 0 }
  })

  const monthBuckets = Array.from({ length: 8 }, (_, index) => {
    const date = new Date(now)
    date.setDate(now.getDate() - 7 * (7 - index))
    date.setHours(0, 0, 0, 0)
    return { date, total: 0 }
  })

  const allBuckets = Array.from({ length: 12 }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - (11 - index), 1)
    return { date, total: 0 }
  })

  for (const row of rows) {
    const amount = toNumber(row.net_amount)
    if (!amount || !row.created_at) continue

    const createdAt = new Date(row.created_at)
    if (Number.isNaN(createdAt.getTime())) continue

    weekBuckets.forEach((bucket, index) => {
      const nextDay = new Date(bucket.date)
      nextDay.setDate(bucket.date.getDate() + 1)
      if (createdAt >= bucket.date && createdAt < nextDay) {
        weekBuckets[index].total += amount
      }
    })

    monthBuckets.forEach((bucket, index) => {
      const nextWeek = new Date(bucket.date)
      nextWeek.setDate(bucket.date.getDate() + 7)
      if (createdAt >= bucket.date && createdAt < nextWeek) {
        monthBuckets[index].total += amount
      }
    })

    allBuckets.forEach((bucket, index) => {
      const nextMonth = new Date(bucket.date.getFullYear(), bucket.date.getMonth() + 1, 1)
      if (createdAt >= bucket.date && createdAt < nextMonth) {
        allBuckets[index].total += amount
      }
    })
  }

  return {
    week: weekBuckets.map((bucket) => roundCurrency(bucket.total)),
    month: monthBuckets.map((bucket) => roundCurrency(bucket.total)),
    all: allBuckets.map((bucket) => roundCurrency(bucket.total)),
  }
}

export async function GET(request: NextRequest) {
  try {
    const userId = await resolveUserId(request)

    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const [earningsResult, threadsResult, payoutsResult, payoutRequestsResult] = await Promise.all([
      supabaseAdmin
        .from('creator_earnings')
        .select('id,thread_id,amount,platform_fee,net_amount,status,created_at,paid_at,payout_request_id')
        .eq('creator_id', userId)
        .order('created_at', { ascending: false }),
      supabaseAdmin
        .from('threads')
        .select('id,title,price,created_at')
        .eq('creator_id', userId),
      supabaseAdmin
        .from('transaction_ledger')
        .select('id,tx_ref,amount,currency,status,occurred_at')
        .eq('creator_id', userId)
        .eq('payment_type', 'payout')
        .order('occurred_at', { ascending: false })
        .limit(50),
      supabaseAdmin
        .from('payout_requests')
        .select('id,amount_usd,currency,status,created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(50),
    ])

    if (earningsResult.error) {
      console.error('Failed to load creator earnings:', earningsResult.error)
      return NextResponse.json({ error: 'Failed to load earnings data' }, { status: 500 })
    }

    if (threadsResult.error) {
      console.error('Failed to load creator threads:', threadsResult.error)
      return NextResponse.json({ error: 'Failed to load discussion data' }, { status: 500 })
    }

    if (payoutsResult.error) {
      console.error('Failed to load payout history:', payoutsResult.error)
      return NextResponse.json({ error: 'Failed to load payout history' }, { status: 500 })
    }

    const earningsRows = (earningsResult.data || []) as (EarningRow & { payout_request_id: string | null })[]
    const threadRows = (threadsResult.data || []) as ThreadRow[]
    const payoutRows = (payoutsResult.data || []) as PayoutRow[]
    const payoutRequestRows = (payoutRequestsResult?.data || []) as any[]

    const threadById = new Map<
      string,
      {
        title: string
        price: number
        createdAt: string
      }
    >()

    for (const row of threadRows) {
      threadById.set(row.id, {
        title: row.title || 'Untitled Discussion',
        price: toNumber(row.price),
        createdAt: row.created_at || new Date().toISOString(),
      })
    }

    const settledSaleRows = earningsRows.filter((row) => {
      const status = normalizeStatus(row.status)
      return status !== 'refunded' && status !== 'failed'
    })

    const totalSales = settledSaleRows.reduce((sum, row) => sum + toNumber(row.amount), 0)
    const totalEarnings = settledSaleRows.reduce((sum, row) => sum + toNumber(row.net_amount), 0)

    const pendingEarnings = settledSaleRows
      .filter((row) => {
        const status = normalizeStatus(row.status)
        return status === 'pending'
      })
      .reduce((sum, row) => sum + toNumber(row.net_amount), 0)

    const processingPayouts = payoutRequestRows
      .filter(row => row.status === 'pending_admin' || row.status === 'approved')
      .reduce((sum, row) => sum + toNumber(row.amount_usd), 0)

    const paidEarnings = settledSaleRows
      .filter((row) => {
        const status = normalizeStatus(row.status)
        return status === 'paid' || status === 'completed'
      })
      .reduce((sum, row) => sum + toNumber(row.net_amount), 0)

    const threadsSold = settledSaleRows.length
    const averagePrice = threadsSold > 0 ? totalSales / threadsSold : 0

    const threadMap = new Map<string, ThreadEarnings>()
    for (const row of settledSaleRows) {
      if (!row.thread_id) continue

      const threadInfo = threadById.get(row.thread_id)
      const existing = threadMap.get(row.thread_id)
      const next: ThreadEarnings = existing || {
        threadId: row.thread_id,
        threadTitle: threadInfo?.title || 'Unknown Discussion',
        price: threadInfo?.price || toNumber(row.amount),
        totalSales: 0,
        purchaseCount: 0,
        creatorEarnings: 0,
        platformFees: 0,
        createdAt: threadInfo?.createdAt || new Date().toISOString(),
      }

      next.totalSales += toNumber(row.amount)
      next.purchaseCount += 1
      next.creatorEarnings += toNumber(row.net_amount)
      next.platformFees += toNumber(row.platform_fee)

      if (row.created_at) {
        if (!next.lastSaleAt || new Date(row.created_at) > new Date(next.lastSaleAt)) {
          next.lastSaleAt = row.created_at
        }
      }

      threadMap.set(row.thread_id, next)
    }

    const threadEarnings = Array.from(threadMap.values())
      .map((row) => ({
        ...row,
        totalSales: roundCurrency(row.totalSales),
        creatorEarnings: roundCurrency(row.creatorEarnings),
        platformFees: roundCurrency(row.platformFees),
        price: roundCurrency(row.price),
      }))
      .sort((a, b) => b.totalSales - a.totalSales)

    const lastCompletedPayout = payoutRows.find(
      (row) => normalizeStatus(row.status) === 'completed'
    )

    const now = new Date()
    const nextPayoutAt = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)
    ).toISOString()

    const earnings: CreatorEarnings = {
      userId,
      totalEarnings: roundCurrency(totalEarnings),
      pendingEarnings: roundCurrency(pendingEarnings),
      processingPayouts: roundCurrency(processingPayouts),
      paidEarnings: roundCurrency(paidEarnings),
      threadsSold,
      totalSales: roundCurrency(totalSales),
      averagePrice: roundCurrency(averagePrice),
      lastPayoutAt: lastCompletedPayout?.occurred_at || undefined,
      nextPayoutAt,
    } as any

    const saleTransactions: CreatorEarningsTransaction[] = earningsRows
      .filter((row) => !!row.created_at)
      .map((row) => {
        const status = normalizeStatus(row.status || 'pending')
        const grossAmount = roundCurrency(toNumber(row.amount))
        const netAmount = roundCurrency(toNumber(row.net_amount))
        const isReversal = status === 'refunded' || status === 'failed'

        return {
          id: `sale_${row.id}`,
          type: 'sale',
          status,
          threadId: row.thread_id,
          threadTitle: row.thread_id ? threadById.get(row.thread_id)?.title || 'Unknown Thread' : null,
          grossAmount: isReversal ? -Math.abs(grossAmount) : grossAmount,
          netAmount: isReversal ? -Math.abs(netAmount) : netAmount,
          currency: 'USD',
          occurredAt: row.created_at || new Date().toISOString(),
        }
      })

    const payoutTransactions: CreatorEarningsTransaction[] = payoutRows
      .filter((row) => !!row.occurred_at)
      .map((row) => {
        const payoutAmount = Math.abs(toNumber(row.amount))
        return {
          id: `payout_ledger_${row.id}`,
          type: 'payout',
          status: String(row.status || 'pending').toLowerCase(),
          threadId: null,
          threadTitle: null,
          grossAmount: roundCurrency(payoutAmount),
          netAmount: roundCurrency(-payoutAmount),
          currency: String(row.currency || 'USD').toUpperCase(),
          occurredAt: row.occurred_at || new Date().toISOString(),
        }
      })

    const payoutRequestTransactions: CreatorEarningsTransaction[] = payoutRequestRows
      .map((row) => {
        const amount = toNumber(row.amount_usd)
        const status = row.status === 'pending_admin' ? 'processing' : row.status === 'approved' ? 'approved' : row.status
        return {
          id: `payout_req_${row.id}`,
          type: 'payout',
          status,
          threadId: null,
          threadTitle: null,
          grossAmount: roundCurrency(amount),
          netAmount: roundCurrency(-amount),
          currency: 'USD',
          occurredAt: row.created_at || new Date().toISOString(),
        }
      })

    const recentTransactions = [...saleTransactions, ...payoutTransactions, ...payoutRequestTransactions]
      .sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime())
      .slice(0, 50)

    const response: CreatorEarningsResponse = {
      earnings,
      threadEarnings,
      earningsSeries: buildEarningsSeries(settledSaleRows),
      recentTransactions,
    }

    return NextResponse.json(response, { status: 200 })
  } catch (error) {
    console.error('Creator earnings API error:', error)
    return NextResponse.json({ error: 'Failed to load earnings' }, { status: 500 })
  }
}
