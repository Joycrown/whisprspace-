import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabaseServerClient } from '@/lib/core/supabase/server'
import { createClient as createSupabaseAdminClient } from '@supabase/supabase-js'
import crypto from 'crypto'

const supabaseAdmin = createSupabaseAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
)

type ResolvedRequestUser = {
  id: string
}

type FlutterwaveBank = {
  id?: number | string
  code?: string | number
  name?: string
}

const SUPPORTED_PAYOUT_CURRENCIES = ['USD', 'NGN', 'GHS', 'KES', 'ZAR', 'UGX', 'TZS', 'RWF'] as const
type PayoutCurrency = (typeof SUPPORTED_PAYOUT_CURRENCIES)[number]

const CURRENCY_TO_COUNTRY: Record<PayoutCurrency, string> = {
  USD: 'US',
  NGN: 'NG',
  GHS: 'GH',
  KES: 'KE',
  ZAR: 'ZA',
  UGX: 'UG',
  TZS: 'TZ',
  RWF: 'RW',
}

// Static conversion rates for payouts (1 USD = rate)
const USD_TO_PAYOUT_RATE: Record<PayoutCurrency, number> = {
  USD: 1,
  NGN: 1500,
  GHS: 15.5,
  KES: 160,
  ZAR: 19,
  UGX: 3800,
  TZS: 2550,
  RWF: 1280,
}

const normalizeStatus = (status?: string | null) => {
  const value = String(status || '').toLowerCase()
  if (value.includes('success')) return 'completed'
  if (value.includes('fail')) return 'failed'
  return 'pending'
}

const sanitizeTransferPayload = (payload: unknown) => {
  if (!payload || typeof payload !== 'object') return payload
  const cloned = JSON.parse(JSON.stringify(payload))
  const stripSensitive = (value: unknown) => {
    if (!value || typeof value !== 'object') return
    const keys = [
      'account_number',
      'accountNumber',
      'account_name',
      'beneficiary_name',
      'full_name',
    ]
    for (const key of keys) {
      if (key in value) {
        value[key] = null
      }
    }
    for (const child of Object.values(value as Record<string, unknown>)) {
      if (child && typeof child === 'object') {
        stripSensitive(child)
      }
    }
  }

  stripSensitive(cloned)
  return cloned
}

const sanitizeTransferMetadata = (metadata: Record<string, unknown>) => {
  if (!metadata || typeof metadata !== 'object') return {}
  const cleaned = { ...metadata }
  delete cleaned.accountNumber
  delete cleaned.account_number
  delete cleaned.accountBank
  delete cleaned.account_bank
  return cleaned
}

const decodeJwtPayload = (token: string): Record<string, unknown> | null => {
  try {
    const payload = token.split('.')[1]
    if (!payload) return null
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/')
    const padded = normalized.padEnd(normalized.length + (4 - (normalized.length % 4)) % 4, '=')
    return JSON.parse(Buffer.from(padded, 'base64').toString('utf-8')) as Record<string, unknown>
  } catch {
    return null
  }
}

const resolveUserFromRequest = async (request: NextRequest) => {
  let user: ResolvedRequestUser | null = null

  const authHeader = request.headers.get('authorization')
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice('Bearer '.length)
    if (process.env.NODE_ENV === 'production') {
      try {
        const { data, error } = await supabaseAdmin.auth.getUser(token)
        if (!error && data?.user?.id) {
          user = { id: data.user.id }
        }
      } catch (error) {
        console.error('Supabase auth getUser failed for payout:', error)
      }
    } else {
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
          user = { id: userRow.id }
        }
      }
    }
  }

  if (!user) {
    const supabase = await createSupabaseServerClient()
    const {
      data: { user: cookieUser },
      error: userError,
    } = await supabase.auth.getUser()

    if (!userError && cookieUser?.id) {
      user = { id: cookieUser.id }
    }
  }

  return user
}

const resolveCurrency = (raw: unknown): PayoutCurrency => {
  const value = String(raw || 'USD').toUpperCase()
  return (SUPPORTED_PAYOUT_CURRENCIES as readonly string[]).includes(value)
    ? (value as PayoutCurrency)
    : 'USD'
}

const convertUsdToCurrency = (amountUsd: number, currency: PayoutCurrency) => {
  const rate = USD_TO_PAYOUT_RATE[currency] || 1
  return Number((amountUsd * rate).toFixed(2))
}

const fetchFlutterwaveBanks = async (secretKey: string, country: string) => {
  const response = await fetch(`https://api.flutterwave.com/v3/banks/${encodeURIComponent(country)}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${secretKey}`,
      'Content-Type': 'application/json',
    },
  })

  if (!response.ok) {
    const payload = await response.json().catch(() => null)
    throw new Error(payload?.message || `Failed to load banks for ${country}`)
  }

  const payload = await response.json().catch(() => null)
  const rows = Array.isArray(payload?.data) ? (payload.data as FlutterwaveBank[]) : []
  return rows
    .map((row) => {
      const code = row.code !== undefined ? String(row.code).trim() : ''
      const name = row.name !== undefined ? String(row.name).trim() : ''
      if (!code || !name) return null
      return { code, name }
    })
    .filter((row): row is { code: string; name: string } => Boolean(row))
    .sort((a, b) => a.name.localeCompare(b.name))
}

export async function GET(request: NextRequest) {
  try {
    const flutterwaveSecretKey = process.env.FLW_SECRET_KEY
    if (!flutterwaveSecretKey) {
      return NextResponse.json(
        { error: 'Flutterwave is not configured' },
        { status: 500 }
      )
    }

    const currencyParam = request.nextUrl.searchParams.get('currency')
    const currency = resolveCurrency(currencyParam)
    const country = CURRENCY_TO_COUNTRY[currency]

    let banks: Array<{ code: string; name: string }> = []
    try {
      banks = await fetchFlutterwaveBanks(flutterwaveSecretKey, country)
    } catch (error) {
      console.error('Failed to fetch Flutterwave banks:', error)
    }

    return NextResponse.json({
      currency,
      country,
      supportedCurrencies: SUPPORTED_PAYOUT_CURRENCIES,
      banks,
      requiresBankCode: true,
    })
  } catch (error) {
    console.error('Flutterwave payout options error:', error)
    return NextResponse.json(
      { error: 'Failed to load payout options' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const flutterwaveSecretKey = process.env.FLW_SECRET_KEY
    if (!flutterwaveSecretKey) {
      return NextResponse.json(
        { error: 'Flutterwave is not configured' },
        { status: 500 }
      )
    }

    const payload = await request.json()
    const currency = resolveCurrency(payload?.currency)
    const accountBank = String(payload?.accountBank || payload?.account_bank || '')
    const accountNumber = String(payload?.accountNumber || payload?.account_number || '')
    const narration = payload?.narration ? String(payload?.narration) : 'Creator payout'
    const reference = payload?.reference ? String(payload?.reference) : ''
    const debitCurrency = resolveCurrency(payload?.debitCurrency || payload?.debit_currency || currency)
    const extraMeta = payload?.meta && typeof payload.meta === 'object' ? payload.meta : {}

    if (!accountBank || !accountNumber) {
      return NextResponse.json(
        { error: 'Missing or invalid payout details' },
        { status: 400 }
      )
    }

    const user = await resolveUserFromRequest(request)
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const creatorId = payload?.creatorId ? String(payload.creatorId) : user.id
    if (creatorId !== user.id) {
      return NextResponse.json(
        { error: 'Not authorized to initiate payout for this creator' },
        { status: 403 }
      )
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || request.headers.get('origin') || ''
    if (!baseUrl) {
      return NextResponse.json(
        { error: 'Missing app URL configuration' },
        { status: 500 }
      )
    }

    const txRef = reference || `payout_${creatorId}_${crypto.randomUUID()}`

    const { data: pendingRows, error: pendingError } = await supabaseAdmin
      .from('creator_earnings')
      .select('id, net_amount, status')
      .eq('creator_id', creatorId)
      .eq('status', 'pending')
      .order('created_at', { ascending: true })

    if (pendingError) {
      console.error('Failed to load pending earnings:', pendingError)
      return NextResponse.json(
        { error: 'Unable to calculate pending earnings' },
        { status: 500 }
      )
    }

    const pendingTotalUsd = (pendingRows || []).reduce((sum, row) => sum + Number(row.net_amount || 0), 0)
    if (!pendingTotalUsd || pendingTotalUsd < 10) {
      return NextResponse.json(
        { error: 'Pending balance below payout threshold' },
        { status: 400 }
      )
    }

    const amountUsd = Number(pendingTotalUsd.toFixed(2))
    const amount = convertUsdToCurrency(amountUsd, currency)
    const exchangeRate = USD_TO_PAYOUT_RATE[currency] || 1
    const earningIds = (pendingRows || []).map(row => row.id)

    if (earningIds.length > 0) {
      await supabaseAdmin
        .from('creator_earnings')
        .update({ status: 'processing' })
        .in('id', earningIds)
    }

    await supabaseAdmin
      .from('transaction_ledger')
      .upsert(
        {
          user_id: null,
          creator_id: creatorId,
          thread_id: null,
          payment_id: null,
          payment_provider: 'flutterwave',
          payment_type: 'payout',
          tx_ref: txRef,
          payment_method: 'transfer',
          amount: -Math.abs(amount),
          currency,
          amount_usd: -Math.abs(amountUsd),
          status: 'pending',
          description: narration,
          metadata: {
            creatorId,
            debitCurrency,
            earningIds,
            amountUsd,
            exchangeRate,
            ...sanitizeTransferMetadata(extraMeta),
          },
          occurred_at: new Date().toISOString(),
        },
        { onConflict: 'payment_provider,tx_ref' }
      )

    const transferResponse = await fetch('https://api.flutterwave.com/v3/transfers', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${flutterwaveSecretKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        account_bank: accountBank,
        account_number: accountNumber,
        amount,
        currency,
        reference: txRef,
        narration,
        callback_url: `${baseUrl}/api/flutterwave/webhook`,
        debit_currency: debitCurrency,
        meta: {
          creatorId,
          userId: user.id,
          earningIds,
          amountUsd,
          exchangeRate,
          ...extraMeta,
        },
      }),
    })

    const transferData = await transferResponse.json().catch(() => null)
    if (!transferResponse.ok) {
      await supabaseAdmin
        .from('transaction_ledger')
        .update({
          status: 'failed',
          raw_payload: sanitizeTransferPayload(transferData),
          occurred_at: new Date().toISOString(),
        })
        .eq('payment_provider', 'flutterwave')
        .eq('tx_ref', txRef)

      if (earningIds.length > 0) {
        await supabaseAdmin
          .from('creator_earnings')
          .update({ status: 'pending' })
          .in('id', earningIds)
      }

      return NextResponse.json(
        { error: 'Failed to initiate payout' },
        { status: 500 }
      )
    }

    const providerTransactionId = transferData?.data?.id ? String(transferData.data.id) : null
    const providerStatus = normalizeStatus(transferData?.data?.status)

    await supabaseAdmin
      .from('transaction_ledger')
      .update({
        provider_transaction_id: providerTransactionId,
        status: providerStatus,
        raw_payload: sanitizeTransferPayload(transferData),
        occurred_at: new Date().toISOString(),
      })
      .eq('payment_provider', 'flutterwave')
      .eq('tx_ref', txRef)

    return NextResponse.json({
      reference: txRef,
      status: providerStatus,
      providerTransactionId,
    })
  } catch (error) {
    console.error('Flutterwave transfer initiation error:', error)
    return NextResponse.json(
      { error: 'Failed to initiate payout' },
      { status: 500 }
    )
  }
}
