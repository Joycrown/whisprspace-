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

const conversionRates: Record<string, number> = {
  NGN: 1550,
  GHS: 15.5,
  ZAR: 18.5,
  KES: 155,
}

const convertLocalToUsd = (amountLocal: number, currency: string) => {
  const rate = conversionRates[currency] || 1
  return Math.round((amountLocal / rate) * 100) / 100
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

export async function POST(request: NextRequest) {
  try {
    const paystackSecretKey = process.env.PAYSTACK_SECRET_KEY

    if (!paystackSecretKey) {
      return NextResponse.json(
        { error: 'Paystack not configured' },
        { status: 500 }
      )
    }

    const body = await request.text()
    const signature = request.headers.get('x-paystack-signature')

    if (!signature) {
      return NextResponse.json(
        { error: 'No signature' },
        { status: 400 }
      )
    }

    // Verify webhook signature
    const hash = crypto
      .createHmac('sha512', paystackSecretKey)
      .update(body)
      .digest('hex')

    if (hash !== signature) {
      console.error('Invalid Paystack webhook signature')
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 400 }
      )
    }

    const event = JSON.parse(body)

    // Handle the event
    if (event.event === 'charge.success') {
      await handleChargeSuccess(event.data)
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('Paystack webhook error:', error)
    return NextResponse.json(
      { error: 'Webhook handler failed' },
      { status: 500 }
    )
  }
}

async function handleChargeSuccess(data: any) {
  try {
    const { metadata, amount, reference, status } = data

    if (status && status !== 'success') {
      console.warn('Paystack charge not successful:', status)
      return
    }

    if (!metadata) {
      console.error('Missing metadata in Paystack payment')
      return
    }

    const { threadId, userId, creatorId: metadataCreatorId, usdAmount, localAmount } = metadata

    if (!threadId || !userId || !reference) {
      console.error('Missing metadata fields in Paystack payment')
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
    if (metadataCreatorId && metadataCreatorId !== creatorId) {
      console.warn('Creator metadata mismatch for thread:', threadId)
    }

    if (creatorId === userId) {
      console.error('Creator attempted to purchase own thread:', threadId)
      return
    }

    const amountDecimal = amount / 100
    const currencyCode = (metadata.currency || data.currency || 'NGN').toUpperCase()
    const legacyLocalAmount = localAmount ?? metadata.amount

    if (legacyLocalAmount) {
      const expectedLocal = Number(legacyLocalAmount)
      if (!Number.isNaN(expectedLocal) && Math.abs(expectedLocal - amountDecimal) > 0.01) {
        console.error('Local amount mismatch in Paystack payment:', {
          expectedLocal,
          amountDecimal,
        })
        return
      }
    }

    let amountUsd = usdAmount ? Number(usdAmount) : null
    if (!amountUsd || Number.isNaN(amountUsd) || amountUsd <= 0) {
      const legacyAmount = metadata.amount ? Number(metadata.amount) : null
      if (legacyAmount && !Number.isNaN(legacyAmount)) {
        amountUsd = convertLocalToUsd(legacyAmount, currencyCode)
      }
    }

    if (!amountUsd || Number.isNaN(amountUsd) || amountUsd <= 0) {
      console.error('Missing or invalid USD amount in Paystack metadata')
      return
    }

    const platformFee = amountUsd * 0.3
    const creatorEarnings = amountUsd * 0.7

    const { data: existingPayment } = await supabase
      .from('payments')
      .select('id')
      .eq('stripe_payment_intent_id', reference)
      .maybeSingle()

    let paymentId = existingPayment?.id
    let paymentCreated = false

    if (!paymentId) {
      const { data: payment, error: paymentError } = await supabase
        .from('payments')
        .insert({
          user_id: userId,
          thread_id: threadId,
          amount: amountUsd,
          currency: 'USD',
          stripe_payment_intent_id: reference,
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
          amount: amountUsd,
          stripe_payment_intent_id: reference,
        })

      if (purchaseError) {
        if (purchaseError.code !== '23505') {
          console.error('Failed to insert thread purchase:', purchaseError)
        }
      } else {
        purchaseCreated = true
      }
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
            amount: amountUsd,
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
    console.error('Error handling Paystack charge success:', error)
  }
}
