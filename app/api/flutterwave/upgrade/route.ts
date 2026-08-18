import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabaseAdminClient } from '@supabase/supabase-js'
import crypto from 'crypto'
import { formatCurrency, SupportedCurrency, SUPPORTED_CURRENCIES } from '@/lib/payments/currency'
import { convertWithLiveRate } from '@/lib/payments/flutterwave-rates'
import { getTrustedAppBaseUrl } from '@/lib/security/app-url'
import { enforceRateLimit, withRateLimitHeaders } from '@/lib/security/rate-limit'
import { resolveUserFromRequest } from '@/lib/security/request-auth'

const supabaseAdmin = createSupabaseAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
)

const PLAN_CONFIG = {
  monthly: { amount: 2.5, label: 'Monthly Premium', period: 'month' },
  annual: { amount: 22.5, label: 'Annual Premium', period: 'year' },
} as const

export async function POST(request: NextRequest) {
  const rateLimit = enforceRateLimit({
    request,
    namespace: 'payments:flutterwave:upgrade-initialize',
    max: 6,
    windowMs: 60_000,
  })
  if (!rateLimit.allowed) {
    return rateLimit.response
  }

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

    const baseUrl = getTrustedAppBaseUrl(request)
    if (!baseUrl) {
      return NextResponse.json(
        { error: 'Missing app URL configuration' },
        { status: 500 }
      )
    }

    const planConfig = PLAN_CONFIG[plan as keyof typeof PLAN_CONFIG]
    const txRef = `whispr_premium_${user.id}_${crypto.randomUUID()}`
    const email = user.email || `${user.id}@anonymous.whisprspace.com`
    const metadataUsername =
      typeof user.userMetadata?.username === 'string' ? user.userMetadata.username : undefined
    const metadataFullName =
      typeof user.userMetadata?.full_name === 'string' ? user.userMetadata.full_name : undefined

    // Charge in the user's local currency (same as thread purchases) so Flutterwave
    // presents all payment methods — mobile money, USSD, bank transfer, etc. — rather
    // than defaulting to card-only which happens when USD is passed directly.
    const uiCurrency = (requestedCurrency && Object.values(SUPPORTED_CURRENCIES).includes(requestedCurrency))
      ? requestedCurrency as SupportedCurrency
      : 'USD';

    const { amount: finalAmount } = await convertWithLiveRate(flutterwaveSecretKey, planConfig.amount, uiCurrency);
    const paymentCurrency = uiCurrency;

    const response = await fetch('https://api.flutterwave.com/v3/payments', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${flutterwaveSecretKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        tx_ref: txRef,
        amount: finalAmount,
        currency: paymentCurrency,
        redirect_url: `${baseUrl}/profile?upgrade=success&plan=${plan}&gateway=flutterwave`,
        payment_options: 'card, mobilemoney, ussd, banktransfer, account, credit, nqr',
        customer: {
          email,
          name: metadataUsername || metadataFullName,
        },
        meta: {
          paymentType: 'premium_upgrade',
          plan,
          userId: user.id,
          amountUsd: planConfig.amount,
          amount: finalAmount,
          currency: paymentCurrency,
          uiCurrency,
        },
        customizations: {
          title: 'WhisprSpace Premium',
          description: `${planConfig.label} subscription (~$${planConfig.amount} USD · ${formatCurrency(finalAmount, paymentCurrency)})`,
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
          currency: paymentCurrency,
          status: 'pending',
          description: `${planConfig.label} subscription`,
          metadata: {
            paymentType: 'premium_upgrade',
            plan,
            userId: user.id,
            amountUsd: planConfig.amount,
            amount: finalAmount,
            currency: paymentCurrency,
          },
        },
        { onConflict: 'payment_provider,tx_ref' }
      )

    return withRateLimitHeaders(NextResponse.json({ url, txRef }), rateLimit.headers)
  } catch (error) {
    console.error('Flutterwave upgrade initialize error:', error)
    return withRateLimitHeaders(NextResponse.json(
      { error: 'Failed to initialize payment' },
      { status: 500 }
    ), rateLimit.headers)
  }
}
