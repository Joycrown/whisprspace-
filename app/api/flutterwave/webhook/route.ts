/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // Use service role for admin operations
)

type ThreadForPayment = {
  id: string
  creator_id: string
  is_premium: boolean
  deleted_at: string | null
  expires_at: string | null
}

const getThreadForPayment = async (threadId: string) => {
  const { data, error } = await supabase
    .from('threads')
    .select('id,creator_id,is_premium,deleted_at,expires_at')
    .eq('id', threadId)
    .single()

  if (error || !data) {
    return { thread: null, error: 'Thread not found' }
  }

  return { thread: data as ThreadForPayment, error: null }
}

const verifyFlutterwaveSignature = (rawBody: string, request: NextRequest) => {
  const secretHash = process.env.FLW_SECRET_HASH
  if (!secretHash) {
    console.error('Missing FLW_SECRET_HASH')
    return false
  }

  const signatureHeader = request.headers.get('flutterwave-signature')
  if (signatureHeader) {
    if (signatureHeader === secretHash) {
      return true
    }

    const hash = crypto
      .createHmac('sha256', secretHash)
      .update(rawBody)
      .digest('base64')

    return hash === signatureHeader
  }

  const legacyHash = request.headers.get('verif-hash')
  if (legacyHash) {
    return legacyHash === secretHash
  }

  return false
}

const sanitizeTransferPayload = (payload: any) => {
  if (!payload || typeof payload !== 'object') return payload
  const cloned = JSON.parse(JSON.stringify(payload))
  const stripSensitive = (value: any) => {
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
    for (const child of Object.values(value)) {
      if (child && typeof child === 'object') {
        stripSensitive(child)
      }
    }
  }

  stripSensitive(cloned)
  return cloned
}

const sanitizeTransferMetadata = (metadata: Record<string, any>) => {
  if (!metadata || typeof metadata !== 'object') return {}
  const cleaned = { ...metadata }
  delete cleaned.accountNumber
  delete cleaned.account_number
  delete cleaned.accountBank
  delete cleaned.account_bank
  return cleaned
}

export async function POST(request: NextRequest) {
  try {
    const flutterwaveSecretKey = process.env.FLW_SECRET_KEY
    if (!flutterwaveSecretKey) {
      return NextResponse.json(
        { error: 'Flutterwave not configured' },
        { status: 500 }
      )
    }

    const rawBody = await request.text()

    if (!verifyFlutterwaveSignature(rawBody, request)) {
      console.error('Invalid Flutterwave webhook signature')
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 401 }
      )
    }

    const event = JSON.parse(rawBody)
    const eventType = String(event?.type || event?.event || '').toLowerCase()

    if (eventType === 'charge.completed' || eventType === 'payment.completed') {
      await handleChargeCompleted(event?.data, flutterwaveSecretKey)
    }

    if (eventType === 'charge.failed' || eventType === 'payment.failed') {
      await handleChargeFailed(event?.data)
    }

    if (eventType === 'refund.completed' || eventType === 'refund.failed') {
      await handleRefundEvent(event?.data, eventType)
    }

    if (
      eventType === 'transfer.disburse' ||
      eventType === 'transfer.completed' ||
      eventType === 'transfer.failed'
    ) {
      await handleTransferEvent(event?.data, eventType)
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('Flutterwave webhook error:', error)
    return NextResponse.json(
      { error: 'Webhook handler failed' },
      { status: 500 }
    )
  }
}

async function handleChargeCompleted(data: any, flutterwaveSecretKey: string) {
  try {
    if (!data) return

    const status = String(data.status || '').toLowerCase()
    if (status !== 'successful' && status !== 'succeeded') {
      return
    }

    const transactionId = data.id
    if (!transactionId) {
      console.error('Missing Flutterwave transaction id')
      return
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
      console.error('Failed to verify Flutterwave transaction')
      return
    }

    const verification = await verifyResponse.json()
    if (verification?.status !== 'success') {
      console.error('Flutterwave verification failed:', verification)
      return
    }

    const verified = verification?.data
    const verifiedStatus = String(verified?.status || '').toLowerCase()
    if (verifiedStatus !== 'successful' && verifiedStatus !== 'succeeded') {
      console.error('Flutterwave payment not successful:', verifiedStatus)
      return
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
    const threadId = meta.threadId
    const userId = meta.userId
    const metaCreatorId = meta.creatorId
    const amountUsd = Number(meta.amountUsd ?? meta.amount_usd)
    const txRef = String(verified?.tx_ref || data?.tx_ref || '')
    const transactionRef = String(verified?.id || transactionId)
    const paymentMethod = verified?.payment_type || verified?.payment_method

    if (!threadId || !userId || !amountUsd || !txRef) {
      if (paymentType !== 'premium_upgrade') {
        console.error('Missing metadata in Flutterwave payment')
        return
      }
    }

    if (paymentType === 'premium_upgrade') {
      await handlePremiumUpgradePayment({
        verified,
        txRef,
        transactionRef,
        paymentMethod,
        meta,
      })
      return
    }

    const { thread, error: threadError } = await getThreadForPayment(threadId)
    if (threadError || !thread) {
      console.error('Thread not found for payment:', threadId)
      return
    }

    if (!thread.is_premium) {
      console.error('Non-premium thread attempted for payment:', threadId)
      return
    }

    if (thread.deleted_at) {
      console.error('Deleted thread attempted for payment:', threadId)
      return
    }

    if (thread.expires_at && new Date(thread.expires_at) < new Date()) {
      console.error('Expired thread attempted for payment:', threadId)
      return
    }

    const creatorId = thread.creator_id
    if (metaCreatorId && metaCreatorId !== creatorId) {
      console.warn('Creator metadata mismatch for thread:', threadId)
    }

    if (creatorId === userId) {
      console.error('Creator attempted to purchase own thread:', threadId)
      return
    }

    const verifiedAmount = Number(verified?.amount)
    const verifiedCurrency = String(verified?.currency || '').toUpperCase()
    const expectedCurrency = String(meta.currency || verifiedCurrency || 'USD').toUpperCase()
    const expectedAmount = Number(
      meta.amount ?? meta.amount_local ?? meta.amountUsd ?? meta.amount_usd ?? verifiedAmount
    )

    if (verifiedCurrency && expectedCurrency && verifiedCurrency !== expectedCurrency) {
      console.error('Unexpected currency for Flutterwave payment:', {
        expectedCurrency,
        verifiedCurrency,
      })
      return
    }

    if (Number.isNaN(expectedAmount) || expectedAmount <= 0) {
      console.error('Invalid expected amount in Flutterwave metadata')
      return
    }

    if (!Number.isNaN(verifiedAmount) && Math.abs(verifiedAmount - expectedAmount) > 0.01) {
      console.error('Amount mismatch in Flutterwave payment:', {
        expectedAmount,
        verifiedAmount,
      })
      return
    }

    const amountDecimal = amountUsd
    const ledgerCurrency = expectedCurrency || 'USD'
    const ledgerAmount =
      !Number.isNaN(expectedAmount) && expectedAmount > 0 ? expectedAmount : amountUsd
    const { data: creatorProfile, error: creatorProfileError } = await supabase
      .from('users')
      .select('is_premium')
      .eq('id', creatorId)
      .maybeSingle()

    if (creatorProfileError) {
      console.error('Failed to fetch creator premium status:', creatorProfileError)
    }

    const isCreatorPremium = creatorProfile?.is_premium === true
    const creatorShare = isCreatorPremium ? 0.7 : 0.5
    const platformFee = amountDecimal * (1 - creatorShare)
    const creatorEarnings = amountDecimal * creatorShare

    const { data: existingPayment } = await supabase
      .from('payments')
      .select('id')
      .eq('stripe_payment_intent_id', transactionRef)
      .maybeSingle()

    let paymentId = existingPayment?.id
    let paymentCreated = false

    if (!paymentId) {
      const { data: payment, error: paymentError } = await supabase
        .from('payments')
        .insert({
          user_id: userId,
          thread_id: threadId,
          amount: amountDecimal,
          currency: 'USD',
          stripe_payment_intent_id: transactionRef,
          status: 'completed',
          completed_at: new Date().toISOString(),
        })
        .select()
        .single()

      if (paymentError) {
        console.error('Failed to insert payment:', paymentError)
        return
      }

      paymentId = payment.id
      paymentCreated = true
    }

    const { data: existingPurchase } = await supabase
      .from('thread_purchases')
      .select('thread_id')
      .eq('thread_id', threadId)
      .eq('user_id', userId)
      .maybeSingle()

    let purchaseCreated = false
    if (!existingPurchase) {
      const { error: purchaseError } = await supabase
        .from('thread_purchases')
        .insert({
          thread_id: threadId,
          user_id: userId,
          amount: amountDecimal,
          stripe_payment_intent_id: transactionRef,
        })

      if (purchaseError) {
        if (purchaseError.code !== '23505') {
          console.error('Failed to insert thread purchase:', purchaseError)
        }
      } else {
        purchaseCreated = true
      }
    }

    const { error: participantError } = await supabase
      .from('thread_participants')
      .upsert(
        {
          thread_id: threadId,
          user_id: userId,
        },
        { onConflict: 'thread_id,user_id' }
      )

    if (participantError) {
      console.error('Failed to auto-join participant after purchase:', participantError)
    }

    if (paymentId) {
      const { data: existingEarning } = await supabase
        .from('creator_earnings')
        .select('id')
        .eq('payment_id', paymentId)
        .maybeSingle()

      if (!existingEarning) {
        const { error: earningsError } = await supabase
          .from('creator_earnings')
          .insert({
            creator_id: creatorId,
            thread_id: threadId,
            amount: amountDecimal,
            platform_fee: platformFee,
            net_amount: creatorEarnings,
            status: 'pending',
            payment_id: paymentId,
          })

        if (earningsError) {
          console.error('Failed to insert creator earnings:', earningsError)
        }
      }
    }

    await supabase
      .from('transaction_ledger')
      .upsert(
        {
          user_id: userId,
          creator_id: creatorId,
          thread_id: threadId,
          payment_id: paymentId,
          payment_provider: 'flutterwave',
          payment_type: 'thread_purchase',
          tx_ref: txRef,
          provider_transaction_id: transactionRef,
          payment_method: paymentMethod || null,
          amount: ledgerAmount,
          currency: ledgerCurrency,
          amount_usd: amountDecimal,
          status: 'completed',
          description: 'Premium thread purchase',
          metadata: {
            threadId,
            creatorId,
            userId,
            currency: ledgerCurrency,
          },
          raw_payload: verified,
          occurred_at: verified?.created_at || new Date().toISOString(),
        },
        { onConflict: 'payment_provider,tx_ref' }
      )

    if (paymentCreated || purchaseCreated) {
      await supabase.from('notifications').insert({
        user_id: userId,
        type: 'thread_like',
        category: 'system',
        title: 'Purchase Successful',
        message: 'You now have access to the premium thread!',
        data: { thread_id: threadId },
      })

      await supabase.from('notifications').insert({
        user_id: creatorId,
        type: 'thread_like',
        category: 'system',
        title: 'New Sale!',
        message: `You earned $${creatorEarnings.toFixed(2)} from a thread purchase!`,
        data: { thread_id: threadId, amount: creatorEarnings },
      })
    }
  } catch (error) {
    console.error('Error handling Flutterwave charge completed:', error)
  }
}

async function handlePremiumUpgradePayment({
  verified,
  txRef,
  transactionRef,
  paymentMethod,
  meta,
}: {
  verified: any
  txRef: string
  transactionRef: string
  paymentMethod?: string | null
  meta: Record<string, any>
}) {
  try {
    const userId = meta.userId
    const plan = meta.plan
    const amountUsd = Number(meta.amountUsd ?? meta.amount_usd)

    if (!userId || !plan || Number.isNaN(amountUsd) || amountUsd <= 0) {
      console.error('Missing metadata for premium upgrade payment')
      return
    }

    const verifiedAmount = Number(verified?.amount)
    const verifiedCurrency = String(verified?.currency || '').toUpperCase()
    const expectedCurrency = String(meta.currency || verifiedCurrency || 'USD').toUpperCase()
    const expectedAmount = Number(
      meta.amount ?? meta.amount_local ?? meta.amountUsd ?? meta.amount_usd ?? verifiedAmount
    )

    if (verifiedCurrency && expectedCurrency && verifiedCurrency !== expectedCurrency) {
      console.error('Unexpected currency for premium upgrade:', {
        expectedCurrency,
        verifiedCurrency,
      })
      return
    }

    if (
      !Number.isNaN(expectedAmount) &&
      expectedAmount > 0 &&
      !Number.isNaN(verifiedAmount) &&
      Math.abs(verifiedAmount - expectedAmount) > 0.01
    ) {
      console.error('Amount mismatch in premium upgrade payment:', {
        expectedAmount,
        verifiedAmount,
      })
      return
    }

    const { data: userProfile, error: userProfileError } = await supabase
      .from('users')
      .select('premium_expires_at')
      .eq('id', userId)
      .maybeSingle()

    if (userProfileError) {
      console.error('Failed to fetch user premium expiry:', userProfileError)
    }

    const now = new Date()
    const currentExpiry =
      userProfile?.premium_expires_at && new Date(userProfile.premium_expires_at) > now
        ? new Date(userProfile.premium_expires_at)
        : now

    const durationDays = plan === 'annual' ? 365 : 30
    const newExpiry = new Date(currentExpiry.getTime() + durationDays * 24 * 60 * 60 * 1000)

    const { error: premiumUpdateError } = await supabase
      .from('users')
      .update({
        is_premium: true,
        premium_expires_at: newExpiry.toISOString(),
        premium_provider: 'flutterwave',
        premium_last_tx_ref: txRef,
        premium_reminder_sent_for: null,
      })
      .eq('id', userId)

    if (premiumUpdateError) {
      console.error('Failed to update premium status in webhook:', premiumUpdateError)
      return
    }

    const ledgerAmount =
      !Number.isNaN(expectedAmount) && expectedAmount > 0 ? expectedAmount : amountUsd
    const ledgerCurrency = expectedCurrency || 'USD'

    await supabase
      .from('transaction_ledger')
      .upsert(
        {
          user_id: userId,
          creator_id: null,
          thread_id: null,
          payment_id: null,
          payment_provider: 'flutterwave',
          payment_type: 'premium_upgrade',
          tx_ref: txRef,
          provider_transaction_id: transactionRef,
          payment_method: paymentMethod || null,
          amount: ledgerAmount,
          currency: ledgerCurrency,
          amount_usd: amountUsd,
          status: 'completed',
          description: `Premium upgrade (${plan})`,
          metadata: {
            paymentType: 'premium_upgrade',
            plan,
            userId,
            currency: ledgerCurrency,
          },
          raw_payload: verified,
          occurred_at: verified?.created_at || new Date().toISOString(),
        },
        { onConflict: 'payment_provider,tx_ref' }
      )

    await supabase.from('notifications').insert({
      user_id: userId,
      type: 'thread_like',
      category: 'system',
      title: 'Premium Activated',
      message: 'Your premium upgrade is complete. Enjoy the full experience!',
      data: { plan },
    })
  } catch (error) {
    console.error('Error handling premium upgrade payment:', error)
  }
}

async function handleChargeFailed(data: any) {
  try {
    const txRef = String(data?.tx_ref || data?.txRef || '')
    if (!txRef) return

    await supabase
      .from('transaction_ledger')
      .update({
        status: 'failed',
        raw_payload: data,
        occurred_at: data?.created_at || new Date().toISOString(),
      })
      .eq('payment_provider', 'flutterwave')
      .eq('tx_ref', txRef)
  } catch (error) {
    console.error('Error handling Flutterwave charge failed:', error)
  }
}

async function handleRefundEvent(data: any, eventType: string) {
  try {
    if (!data) return

    const refundId = data?.id || data?.refund_id || data?.RefundId
    const transactionId = data?.TransactionId || data?.transaction_id || data?.TransactionID
    const rawTxRef =
      data?.refund_reference ||
      data?.refund_ref ||
      data?.tx_ref ||
      data?.txRef ||
      data?.FlwRef ||
      data?.flw_ref
    const txRef = String(rawTxRef || (refundId ? `refund_${refundId}` : transactionId ? `refund_${transactionId}` : ''))
    if (!txRef) {
      console.error('Missing refund tx_ref')
      return
    }

    const amountRefunded = Number(
      data?.AmountRefunded ?? data?.amount_refunded ?? data?.amount ?? data?.amount_refunded_total
    )
    if (Number.isNaN(amountRefunded) || amountRefunded <= 0) {
      console.error('Invalid refund amount')
      return
    }

    const currency = String(data?.currency || data?.Currency || 'USD').toUpperCase()
    const status = eventType === 'refund.failed' ? 'failed' : 'refunded'

    let paymentId: string | null = null
    let userId: string | null = null
    let threadId: string | null = null
    let creatorId: string | null = null

    if (transactionId) {
      const { data: payment } = await supabase
        .from('payments')
        .select('id,user_id,thread_id')
        .eq('stripe_payment_intent_id', String(transactionId))
        .maybeSingle()

      if (payment) {
        paymentId = payment.id
        userId = payment.user_id
        threadId = payment.thread_id

        if (threadId) {
          const { data: thread } = await supabase
            .from('threads')
            .select('creator_id')
            .eq('id', threadId)
            .maybeSingle()
          creatorId = thread?.creator_id ?? null
        }

        if (status === 'refunded') {
          await supabase
            .from('payments')
            .update({ status: 'refunded' })
            .eq('id', paymentId)
        }
      }
    }

    await supabase
      .from('transaction_ledger')
      .upsert(
        {
          user_id: userId,
          creator_id: creatorId,
          thread_id: threadId,
          payment_id: paymentId,
          payment_provider: 'flutterwave',
          payment_type: 'refund',
          tx_ref: txRef,
          provider_transaction_id: transactionId ? String(transactionId) : null,
          payment_method: data?.payment_type || null,
          amount: -Math.abs(amountRefunded),
          currency,
          amount_usd: currency === 'USD' ? -Math.abs(amountRefunded) : null,
          status,
          description: 'Refund processed',
          metadata: {
            refundId: refundId ?? null,
            transactionId: transactionId ?? null,
          },
          raw_payload: sanitizeTransferPayload(data),
          occurred_at: data?.created_at || new Date().toISOString(),
        },
        { onConflict: 'payment_provider,tx_ref' }
      )
  } catch (error) {
    console.error('Error handling Flutterwave refund event:', error)
  }
}

async function handleTransferEvent(data: any, eventType: string) {
  try {
    if (!data) return

    const transferId = data?.id || data?.transfer_id
    const reference = data?.reference || data?.tx_ref || data?.txRef
    const txRef = String(reference || (transferId ? `transfer_${transferId}` : ''))
    if (!txRef) {
      console.error('Missing transfer tx_ref')
      return
    }

    const amountRaw = data?.amount?.value ?? data?.amount
    const amount = Number(amountRaw)
    if (Number.isNaN(amount) || amount <= 0) {
      console.error('Invalid transfer amount')
      return
    }

    const currency = String(
      data?.destination_currency || data?.currency || data?.source_currency || 'USD'
    ).toUpperCase()

    const statusRaw = String(data?.status || '').toLowerCase()
    let status: 'pending' | 'completed' | 'failed' = 'pending'
    if (statusRaw.includes('success')) status = 'completed'
    if (statusRaw.includes('fail')) status = 'failed'
    if (eventType === 'transfer.failed') status = 'failed'
    if (eventType === 'transfer.completed') status = 'completed'

    const metadata = sanitizeTransferMetadata(data?.meta || {})
    const creatorId = metadata?.creatorId || metadata?.creator_id || null
    const earningIds = Array.isArray(metadata?.earningIds)
      ? metadata.earningIds
      : Array.isArray(metadata?.earning_ids)
        ? metadata.earning_ids
        : []
    const metadataAmountUsd = Number(metadata?.amountUsd ?? metadata?.amount_usd)
    const amountUsd =
      !Number.isNaN(metadataAmountUsd) && metadataAmountUsd > 0
        ? -Math.abs(metadataAmountUsd)
        : currency === 'USD'
          ? -Math.abs(amount)
          : null

    await supabase
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
          provider_transaction_id: transferId ? String(transferId) : null,
          payment_method: data?.type || data?.payment_type || null,
          amount: -Math.abs(amount),
          currency,
          amount_usd: amountUsd,
          status,
          description: 'Creator payout',
          metadata,
          raw_payload: sanitizeTransferPayload(data),
          occurred_at: data?.created_at || new Date().toISOString(),
        },
        { onConflict: 'payment_provider,tx_ref' }
      )

    if (earningIds.length > 0) {
      if (status === 'completed') {
        await supabase
          .from('creator_earnings')
          .update({ status: 'paid', paid_at: new Date().toISOString() })
          .in('id', earningIds)
      }

      if (status === 'failed') {
        await supabase
          .from('creator_earnings')
          .update({ status: 'pending' })
          .in('id', earningIds)
      }
    }
  } catch (error) {
    console.error('Error handling Flutterwave transfer event:', error)
  }
}
