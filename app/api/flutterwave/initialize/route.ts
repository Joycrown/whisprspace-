import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabaseAdminClient } from '@supabase/supabase-js'
import crypto from 'crypto'
import { formatCurrency, SupportedCurrency, SUPPORTED_CURRENCIES } from '@/lib/payments/currency'
import { convertWithLiveRate } from '@/lib/payments/flutterwave-rates'
import { buildThreadPath } from '@/lib/threads/thread-url'
import { getTrustedAppBaseUrl } from '@/lib/security/app-url'
import { enforceRateLimit, withRateLimitHeaders } from '@/lib/security/rate-limit'
import { resolveUserFromRequest } from '@/lib/security/request-auth'

const supabaseAdmin = createSupabaseAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
)

type PurchasableThread = {
  id: string
  title: string | null
  creator_id: string
  is_premium: boolean
  price: number | string | null
  deleted_at: string | null
  expires_at: string | null
}

const getThreadForPurchase = async (threadId: string) => {
  const { data, error } = await supabaseAdmin
    .from('threads')
    .select('id,title,creator_id,is_premium,price,deleted_at,expires_at')
    .eq('id', threadId)
    .single()

  if (error || !data) {
    return { thread: null, error: 'Discussion not found' }
  }

  return { thread: data as PurchasableThread, error: null }
}

const hasExistingPurchase = async (threadId: string, userId: string) => {
  const { data, error } = await supabaseAdmin
    .from('thread_purchases')
    .select('thread_id')
    .eq('thread_id', threadId)
    .eq('user_id', userId)
    .maybeSingle()

  if (error) {
    console.error('Failed to check existing purchase:', error)
    return false
  }

  return !!data
}

export async function POST(request: NextRequest) {
  const rateLimit = enforceRateLimit({
    request,
    namespace: 'payments:flutterwave:initialize',
    max: 8,
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

    const body = await request.json().catch(() => ({}))
    const threadId = typeof body.threadId === 'string' ? body.threadId.trim() : ''
    const requestedCurrency = body.currency as SupportedCurrency | undefined

    if (!threadId || threadId.length > 128) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
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

    const { thread, error: threadError } = await getThreadForPurchase(threadId)
    if (threadError || !thread) {
      return NextResponse.json({ error: threadError }, { status: 404 })
    }

    if (!thread.is_premium) {
      return NextResponse.json(
        { error: 'Discussion is not premium' },
        { status: 400 }
      )
    }

    const price = Number(thread.price)
    if (!price || Number.isNaN(price) || price <= 0) {
      return NextResponse.json(
        { error: 'Invalid discussion price' },
        { status: 400 }
      )
    }

    if (thread.deleted_at) {
      return NextResponse.json(
        { error: 'Discussion is no longer available' },
        { status: 410 }
      )
    }

    if (thread.expires_at && new Date(thread.expires_at) < new Date()) {
      return NextResponse.json(
        { error: 'Discussion has expired' },
        { status: 410 }
      )
    }

    if (thread.creator_id === user.id) {
      return NextResponse.json(
        { error: 'Creators cannot purchase their own discussion' },
        { status: 403 }
      )
    }

    const alreadyPurchased = await hasExistingPurchase(threadId, user.id)
    if (alreadyPurchased) {
      return NextResponse.json(
        { error: 'Discussion already purchased', alreadyPurchased: true },
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
    const threadPath = buildThreadPath({ id: threadId, title: thread.title || undefined })

    const txRef = `whispr_${threadId}_${crypto.randomUUID()}`
    const email = user.email || `${user.id}@anonymous.whisprspace.com`
    const metadata = user.userMetadata || {}
    const metadataUsername =
      typeof metadata.username === 'string' ? metadata.username : undefined
    const metadataFullName =
      typeof metadata.full_name === 'string' ? metadata.full_name : undefined

    // Determine final currency and amount
    const currency = (requestedCurrency && Object.values(SUPPORTED_CURRENCIES).includes(requestedCurrency))
      ? requestedCurrency as SupportedCurrency
      : 'USD';

    const { amount: finalAmount } = await convertWithLiveRate(flutterwaveSecretKey, price, currency);

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
        redirect_url: `${baseUrl}${threadPath}?purchased=true&gateway=flutterwave`,
        payment_options: 'card, mobilemoney, ussd, banktransfer, account, credit, nqr',
        customer: {
          email,
          name: metadataUsername || metadataFullName,
        },
        meta: {
          paymentType: 'thread_purchase',
          threadId,
          userId: user.id,
          creatorId: thread.creator_id,
          amountUsd: price,
          amount: finalAmount,
          currency: currency,
          originalAmount: price,
        },
        customizations: {
          title: thread.title ? `Premium Discussion: ${thread.title}` : 'Premium Discussion Access',
          description: `Access to premium discussion (${formatCurrency(finalAmount, currency)})`,
        },
      }),
    })

    if (!response.ok) {
      const error = await response.json().catch(() => null)
      console.error('Flutterwave initialization error:', error)
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
          creator_id: thread.creator_id,
          thread_id: threadId,
          payment_provider: 'flutterwave',
          payment_type: 'thread_purchase',
          tx_ref: txRef,
          amount: finalAmount,
          amount_usd: price,
          currency: currency,
          status: 'pending',
          description: 'Premium discussion purchase',
          metadata: {
            threadId,
            creatorId: thread.creator_id,
            userId: user.id,
            currency: currency,
          },
        },
        { onConflict: 'payment_provider,tx_ref' }
      )

    return withRateLimitHeaders(NextResponse.json({ url, txRef }), rateLimit.headers)
  } catch (error) {
    console.error('Flutterwave initialize error:', error)
    return withRateLimitHeaders(NextResponse.json(
      { error: 'Failed to initialize payment' },
      { status: 500 }
    ), rateLimit.headers)
  }
}
