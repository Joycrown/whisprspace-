import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabaseServerClient } from '@/lib/core/supabase/server'
import { createClient as createSupabaseAdminClient } from '@supabase/supabase-js'
import crypto from 'crypto'
import { convertPrice, formatCurrency, SupportedCurrency, SUPPORTED_CURRENCIES } from '@/lib/payments/currency'

const supabaseAdmin = createSupabaseAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
)

const PLAN_CONFIG = {
  monthly: { amount: 2.0, label: 'Monthly Premium', period: 'month' },
  annual: { amount: 18.0, label: 'Annual Premium', period: 'year' },
} as const

const normalizeBaseUrl = (rawUrl: string) => {
  try {
    const parsed = new URL(rawUrl)
    return `${parsed.protocol}//${parsed.host}`
  } catch {
    return rawUrl.replace(/\/+$/, '')
  }
}

const getBaseUrl = (request: NextRequest) => {
  const origin = request.headers.get('origin') || ''
  const envUrl = process.env.NEXT_PUBLIC_APP_URL || ''
  const raw = origin || envUrl
  return raw ? normalizeBaseUrl(raw) : ''
}

const decodeJwtPayload = (token: string) => {
  try {
    const payload = token.split('.')[1]
    if (!payload) return null
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/')
    const padded = normalized.padEnd(normalized.length + (4 - (normalized.length % 4)) % 4, '=')
    return JSON.parse(Buffer.from(padded, 'base64').toString('utf-8'))
  } catch {
    return null
  }
}

const resolveUserFromRequest = async (request: NextRequest) => {
  let user: any = null
  const authHeader = request.headers.get('authorization')
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice('Bearer '.length)
    if (process.env.NODE_ENV === 'production') {
      try {
        const { data, error } = await supabaseAdmin.auth.getUser(token)
        if (!error && data?.user) {
          return data.user
        }
      } catch (error) {
        console.error('Supabase auth getUser failed:', error)
      }
    } else {
      const payload = decodeJwtPayload(token)
      const userId = payload?.sub || payload?.user_id
      if (userId) {
        const { data: userRow } = await supabaseAdmin
          .from('users')
          .select('id,email')
          .eq('id', userId)
          .maybeSingle()
        if (userRow) {
          user = {
            id: userRow.id,
            email: userRow.email || payload?.email,
            user_metadata: payload?.user_metadata || {},
          }
        }
      }
    }
  }

  if (!user) {
    const supabase = await createSupabaseServerClient()
    const { data } = await supabase.auth.getUser()
    if (data?.user) {
      user = data.user
    }
  }

  return user
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

    const { plan, currency: requestedCurrency } = await request.json().catch(() => ({}))
    if (!plan || !(plan in PLAN_CONFIG)) {
      return NextResponse.json(
        { error: 'Invalid plan selected' },
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

    const { data: userProfile } = await supabaseAdmin
      .from('users')
      .select('is_premium')
      .eq('id', user.id)
      .maybeSingle()

    if (userProfile?.is_premium) {
      return NextResponse.json(
        { error: 'You are already premium' },
        { status: 409 }
      )
    }

    const baseUrl = getBaseUrl(request)
    if (!baseUrl) {
      return NextResponse.json(
        { error: 'Missing app URL configuration' },
        { status: 500 }
      )
    }

    const planConfig = PLAN_CONFIG[plan as keyof typeof PLAN_CONFIG]
    const txRef = `whispr_premium_${user.id}_${crypto.randomUUID()}`
    const email = user.email || `${user.id}@anonymous.whisprspace.com`

    // Determine final currency and amount
    const currency = (requestedCurrency && Object.values(SUPPORTED_CURRENCIES).includes(requestedCurrency)) 
      ? requestedCurrency as SupportedCurrency 
      : 'USD';
    
    const finalAmount = convertPrice(planConfig.amount, currency);

    const response = await fetch('https://api.flutterwave.com/v3/payments', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${flutterwaveSecretKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        tx_ref: txRef,
        amount: finalAmount,
        currency: currency,
        redirect_url: `${baseUrl}/profile?upgrade=success&plan=${plan}&gateway=flutterwave`,
        payment_options: 'card, mobilemoney, ussd, banktransfer, account, credit, nqr',
        customer: {
          email,
          name: user.user_metadata?.username || user.user_metadata?.full_name || undefined,
        },
        meta: {
          paymentType: 'premium_upgrade',
          plan,
          userId: user.id,
          amountUsd: planConfig.amount,
          amount: finalAmount,
          currency,
        },
        customizations: {
          title: 'WhisprSpace Premium',
          description: `${planConfig.label} subscription (${formatCurrency(finalAmount, currency)})`,
        },
      }),
    })

    if (!response.ok) {
      const error = await response.json().catch(() => null)
      console.error('Flutterwave upgrade initialization error:', error)
      return NextResponse.json(
        { error: 'Failed to initialize payment' },
        { status: 500 }
      )
    }

    const data = await response.json()
    const url = data?.data?.link

    if (!url) {
      console.error('Flutterwave response missing checkout link:', data)
      return NextResponse.json(
        { error: 'Payment link unavailable' },
        { status: 500 }
      )
    }

    await supabaseAdmin
      .from('transaction_ledger')
      .upsert(
        {
          user_id: user.id,
          creator_id: null,
          thread_id: null,
          payment_provider: 'flutterwave',
          payment_type: 'premium_upgrade',
          tx_ref: txRef,
          amount: finalAmount,
          amount_usd: planConfig.amount,
          currency: currency,
          status: 'pending',
          description: `${planConfig.label} subscription`,
          metadata: {
            paymentType: 'premium_upgrade',
            plan,
            userId: user.id,
            currency: currency,
          },
        },
        { onConflict: 'payment_provider,tx_ref' }
      )

    return NextResponse.json({ url, txRef })
  } catch (error) {
    console.error('Flutterwave upgrade initialize error:', error)
    return NextResponse.json(
      { error: 'Failed to initialize payment' },
      { status: 500 }
    )
  }
}
