import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabaseServerClient } from '@/lib/core/supabase/server'
import { createClient as createSupabaseAdminClient } from '@supabase/supabase-js'

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

const getThreadForPurchase = async (threadId: string) => {
  const { data, error } = await supabaseAdmin
    .from('threads')
    .select('id,creator_id,is_premium,price,deleted_at,expires_at')
    .eq('id', threadId)
    .single()

  if (error || !data) {
    return { thread: null, error: 'Thread not found' }
  }

  return { thread: data as PurchasableThread, error: null }
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

    const { threadId, transactionId, txRef } = await request.json().catch(() => ({}))

    if (!threadId || !transactionId) {
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

    const verifyResponse = await fetch(
      `https://api.flutterwave.com/v3/transactions/${transactionId}/verify`,
      {
        headers: {
          Authorization: `Bearer ${flutterwaveSecretKey}`,
        },
      }
    )

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

    const normalizeMeta = (raw: any) => {
      if (!raw) return {}
      if (Array.isArray(raw)) {
        return raw.reduce<Record<string, any>>((acc, item) => {
          if (!item || typeof item !== 'object') return acc
          const key =
            item.metaname ||
            item.meta_name ||
            item.name ||
            item.key
          const value =
            item.metavalue ||
            item.meta_value ||
            item.value
          if (key !== undefined) {
            acc[String(key)] = value
          }
          return acc
        }, {})
      }
      if (typeof raw === 'object') return raw
      return {}
    }

    const meta = normalizeMeta(verified?.meta || verified?.meta_data)
    const paymentType = String(meta?.paymentType || meta?.payment_type || '').toLowerCase()
    if (paymentType === 'premium_upgrade') {
      return NextResponse.json(
        { error: 'Invalid payment type' },
        { status: 400 }
      )
    }

    if (!meta?.threadId || !meta?.userId || !meta?.amountUsd) {
      return NextResponse.json(
        { error: 'Missing payment metadata' },
        { status: 400 }
      )
    }

    if (meta.threadId !== threadId) {
      return NextResponse.json(
        { error: 'Thread mismatch in payment metadata' },
        { status: 400 }
      )
    }

    if (meta.userId !== user.id) {
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
        { error: 'Thread is not premium' },
        { status: 400 }
      )
    }

    if (thread.deleted_at) {
      return NextResponse.json(
        { error: 'Thread is no longer available' },
        { status: 410 }
      )
    }

    if (thread.expires_at && new Date(thread.expires_at) < new Date()) {
      return NextResponse.json(
        { error: 'Thread has expired' },
        { status: 410 }
      )
    }

    if (thread.creator_id === user.id) {
      return NextResponse.json(
        { error: 'Creators cannot purchase their own thread' },
        { status: 403 }
      )
    }

    const amountUsd = Number(meta?.amountUsd ?? meta?.amount_usd)
    const expectedCurrency = String(meta?.currency || 'USD').toUpperCase()
    const expectedAmount = Number(meta?.amount ?? meta?.amount_local ?? meta?.amountUsd ?? meta?.amount_usd)
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

    const transactionRef = String(verified?.id || transactionId)
    const resolvedTxRef = String(verified?.tx_ref || txRef || '')
    const paymentMethod = verified?.payment_type || verified?.payment_method

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

      return NextResponse.json({ success: true, alreadyPurchased: true })
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
        return NextResponse.json(
          { error: 'Failed to record payment' },
          { status: 500 }
        )
      }

      paymentId = payment.id
      paymentCreated = true
    }

    const { error: purchaseError } = await supabaseAdmin
      .from('thread_purchases')
      .insert({
        thread_id: threadId,
        user_id: user.id,
        amount: amountUsd,
        stripe_payment_intent_id: transactionRef,
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
            amount: expectedAmount,
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
          description: 'Premium thread purchase',
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
          message: 'You now have access to the premium thread!',
          data: { thread_id: threadId },
        },
        {
          user_id: thread.creator_id,
          type: 'thread_like',
          category: 'system',
          title: 'New Sale!',
          message: `You earned $${creatorEarnings.toFixed(2)} from a thread purchase!`,
          data: { thread_id: threadId, amount: creatorEarnings },
        },
      ])
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Flutterwave confirm error:', error)
    return NextResponse.json(
      { error: 'Failed to confirm payment' },
      { status: 500 }
    )
  }
}
