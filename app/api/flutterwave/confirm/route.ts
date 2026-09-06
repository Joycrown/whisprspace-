import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabaseAdminClient } from '@supabase/supabase-js'
import { enforceRateLimit, withRateLimitHeaders } from '@/lib/security/rate-limit'
import { resolveUserFromRequest } from '@/lib/security/request-auth'

const supabaseAdmin = createSupabaseAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
)

type PurchasableThread = {
  id: string
  creator_id: string
  is_premium: boolean
  price: number | string | null
  deleted_at: string | null
  expires_at: string | null
}

type MetaRecord = Record<string, unknown>

const getThreadForPurchase = async (threadId: string) => {
  const { data, error } = await supabaseAdmin
    .from('threads')
    .select('id,creator_id,is_premium,price,deleted_at,expires_at')
    .eq('id', threadId)
    .single()

  if (error || !data) {
    return { thread: null, error: 'Discussion not found' }
  }

  return { thread: data as PurchasableThread, error: null }
}

export async function POST(request: NextRequest) {
  const rateLimit = enforceRateLimit({
    request,
    namespace: 'payments:flutterwave:confirm',
    max: 12,
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
    const transactionId = body.transactionId
    const txRef = typeof body.txRef === 'string' ? body.txRef.trim() : body.txRef

    if (!threadId || threadId.length > 128 || (!transactionId && !txRef)) {
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

    const verifyUrl = transactionId
      ? `https://api.flutterwave.com/v3/transactions/${transactionId}/verify`
      : `https://api.flutterwave.com/v3/transactions/verify_by_reference?tx_ref=${encodeURIComponent(
        String(txRef)
      )}`

    const verifyResponse = await fetch(verifyUrl, {
      headers: {
        Authorization: `Bearer ${flutterwaveSecretKey}`,
      },
    })

    if (!verifyResponse.ok) {
      return NextResponse.json(
        { error: 'Failed to verify Flutterwave transaction' },
        { status: 502 }
      )
    }

    const verification = await verifyResponse.json()
    if (verification?.status !== 'success') {
      return NextResponse.json(
        { error: 'Flutterwave verification failed' },
        { status: 400 }
      )
    }

    const verified = verification?.data
    const verifiedStatus = String(verified?.status || '').toLowerCase()
    if (verifiedStatus !== 'successful' && verifiedStatus !== 'succeeded') {
      return NextResponse.json(
        { error: 'Payment not successful' },
        { status: 400 }
      )
    }

    const normalizeMeta = (raw: unknown): MetaRecord => {
      if (!raw) return {}
      if (Array.isArray(raw)) {
        return raw.reduce<MetaRecord>((acc, item) => {
          if (!item || typeof item !== 'object') return acc
          const metaItem = item as MetaRecord
          const key =
            metaItem.metaname ||
            metaItem.meta_name ||
            metaItem.name ||
            metaItem.key
          const value =
            metaItem.metavalue ||
            metaItem.meta_value ||
            metaItem.value
          if (key !== undefined) {
            acc[String(key)] = value
          }
          return acc
        }, {})
      }
      if (typeof raw === 'object') return raw as MetaRecord
      return {}
    }

    const meta = normalizeMeta(verified?.meta || verified?.meta_data)
    const paymentType = String(meta.paymentType || meta.payment_type || '').toLowerCase()
    if (paymentType === 'premium_upgrade') {
      return NextResponse.json(
        { error: 'Invalid payment type' },
        { status: 400 }
      )
    }

    const metaThreadId = String(meta.threadId || meta.thread_id || '').trim()
    const metaUserId = String(meta.userId || meta.user_id || '').trim()
    const metaAmountUsd = meta.amountUsd ?? meta.amount_usd

    if (!metaThreadId || !metaUserId || metaAmountUsd === undefined || metaAmountUsd === null) {
      return NextResponse.json(
        { error: 'Missing payment metadata' },
        { status: 400 }
      )
    }

    if (metaThreadId !== threadId) {
      return NextResponse.json(
        { error: 'Discussion mismatch in payment metadata' },
        { status: 400 }
      )
    }

    if (metaUserId !== user.id) {
      return NextResponse.json(
        { error: 'Payment does not belong to this user' },
        { status: 403 }
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

    const amountUsd = Number(metaAmountUsd)
    const expectedCurrency = String(meta.currency || 'USD').toUpperCase()
    const expectedAmount = Number(meta.amount ?? meta.amount_local ?? metaAmountUsd)
    const verifiedAmount = Number(verified?.amount)
    const verifiedCurrency = String(verified?.currency || '').toUpperCase()

    if (verifiedCurrency && expectedCurrency && verifiedCurrency !== expectedCurrency) {
      return NextResponse.json(
        { error: 'Unexpected payment currency' },
        { status: 400 }
      )
    }

    if (Number.isNaN(amountUsd) || amountUsd <= 0) {
      return NextResponse.json(
        { error: 'Invalid payment amount' },
        { status: 400 }
      )
    }

    if (
      !Number.isNaN(expectedAmount) &&
      expectedAmount > 0 &&
      !Number.isNaN(verifiedAmount) &&
      Math.abs(verifiedAmount - expectedAmount) > 0.01
    ) {
      return NextResponse.json(
        { error: 'Payment amount mismatch' },
        { status: 400 }
      )
    }

    const transactionRef = String(verified?.id || transactionId || '')
    const resolvedTxRef = String(verified?.tx_ref || txRef || '')
    const paymentMethod = verified?.payment_type || verified?.payment_method

    if (!transactionRef) {
      return NextResponse.json(
        { error: 'Missing provider transaction reference' },
        { status: 400 }
      )
    }

    if (txRef && resolvedTxRef && txRef !== resolvedTxRef) {
      return NextResponse.json(
        { error: 'Payment reference mismatch' },
        { status: 400 }
      )
    }

    const { data: existingPurchase } = await supabaseAdmin
      .from('thread_purchases')
      .select('thread_id')
      .eq('thread_id', threadId)
      .eq('user_id', user.id)
      .maybeSingle()

    if (existingPurchase) {
      await supabaseAdmin
        .from('thread_participants')
        .upsert(
          { thread_id: threadId, user_id: user.id },
          { onConflict: 'thread_id,user_id' }
        )

      return withRateLimitHeaders(NextResponse.json({ success: true, alreadyPurchased: true }), rateLimit.headers)
    }

    const { data: creatorProfile, error: creatorProfileError } = await supabaseAdmin
      .from('users')
      .select('is_premium')
      .eq('id', thread.creator_id)
      .maybeSingle()

    if (creatorProfileError) {
      console.error('Failed to fetch creator premium status:', creatorProfileError)
    }

    const isCreatorPremium = creatorProfile?.is_premium === true
    const creatorShare = isCreatorPremium ? 0.7 : 0.5
    const platformFee = amountUsd * (1 - creatorShare)
    const creatorEarnings = amountUsd * creatorShare

    const { data: existingPayment } = await supabaseAdmin
      .from('payments')
      .select('id')
      .eq('stripe_payment_intent_id', transactionRef)
      .maybeSingle()

    let paymentId = existingPayment?.id
    let paymentCreated = false

    if (!paymentId) {
      const { data: payment, error: paymentError } = await supabaseAdmin
        .from('payments')
        .insert({
          user_id: user.id,
          thread_id: threadId,
          amount: amountUsd,
          currency: 'USD',
          stripe_payment_intent_id: transactionRef,
          status: 'completed',
          completed_at: new Date().toISOString(),
        })
        .select()
        .single()

      if (paymentError) {
        // 23505 = unique violation. Two confirm calls can race (the client fires
        // this endpoint twice): both pass the existence checks, then both insert
        // the same transactionRef. The loser must NOT 500 — the payment IS
        // recorded, so re-fetch it and continue idempotently.
        if (paymentError.code === '23505') {
          const { data: racedPayment } = await supabaseAdmin
            .from('payments')
            .select('id')
            .eq('stripe_payment_intent_id', transactionRef)
            .maybeSingle()

          if (racedPayment?.id) {
            paymentId = racedPayment.id
            paymentCreated = false
          } else {
            return NextResponse.json(
              { error: 'Failed to record payment' },
              { status: 500 }
            )
          }
        } else {
          return NextResponse.json(
            { error: 'Failed to record payment' },
            { status: 500 }
          )
        }
      } else {
        paymentId = payment.id
        paymentCreated = true
      }
    }

    const { error: purchaseError } = await supabaseAdmin
      .from('thread_purchases')
      .insert({
        thread_id: threadId,
        user_id: user.id,
        amount: amountUsd,
        stripe_payment_intent_id: transactionRef,
        acquisition_type: 'paid',
      })

    if (purchaseError && purchaseError.code !== '23505') {
      return NextResponse.json(
        { error: 'Failed to record purchase' },
        { status: 500 }
      )
    }

    if (paymentId) {
      const { data: existingEarning } = await supabaseAdmin
        .from('creator_earnings')
        .select('id')
        .eq('payment_id', paymentId)
        .maybeSingle()

      if (!existingEarning) {
        await supabaseAdmin
          .from('creator_earnings')
          .insert({
            creator_id: thread.creator_id,
            thread_id: threadId,
            amount: amountUsd,
            platform_fee: platformFee,
            net_amount: creatorEarnings,
            status: 'pending',
            payment_id: paymentId,
          })
      }
    }

    await supabaseAdmin
      .from('transaction_ledger')
      .upsert(
        {
          user_id: user.id,
          creator_id: thread.creator_id,
          thread_id: threadId,
          payment_id: paymentId,
          payment_provider: 'flutterwave',
          payment_type: 'thread_purchase',
          tx_ref: resolvedTxRef || `tx_${transactionRef}`,
          provider_transaction_id: transactionRef,
          payment_method: paymentMethod || null,
          amount: !Number.isNaN(expectedAmount) && expectedAmount > 0 ? expectedAmount : amountUsd,
          currency: expectedCurrency || 'USD',
          amount_usd: amountUsd,
          status: 'completed',
          description: 'Premium discussion purchase',
          metadata: {
            threadId,
            creatorId: thread.creator_id,
            userId: user.id,
            currency: expectedCurrency || 'USD',
          },
          raw_payload: verified,
          occurred_at: verified?.created_at || new Date().toISOString(),
        },
        { onConflict: 'payment_provider,tx_ref' }
      )

    await supabaseAdmin
      .from('thread_participants')
      .upsert(
        { thread_id: threadId, user_id: user.id },
        { onConflict: 'thread_id,user_id' }
      )

    if (paymentCreated) {
      await supabaseAdmin.from('notifications').insert([
        {
          user_id: user.id,
          type: 'thread_like',
          category: 'system',
          title: 'Purchase Successful',
          message: 'You now have access to the premium discussion!',
          data: { thread_id: threadId },
        },
        {
          user_id: thread.creator_id,
          type: 'thread_like',
          category: 'system',
          title: 'New Sale!',
          message: `You earned $${creatorEarnings.toFixed(2)} from a discussion purchase!`,
          data: { thread_id: threadId, amount: creatorEarnings },
        },
      ])
    }

    return withRateLimitHeaders(NextResponse.json({ success: true }), rateLimit.headers)
  } catch (error) {
    console.error('Flutterwave confirm error:', error)
    return withRateLimitHeaders(NextResponse.json(
      { error: 'Failed to confirm payment' },
      { status: 500 }
    ), rateLimit.headers)
  }
}
