import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2025-01-27.acacia',
    })
  : null

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

type CreatorProfile = {
  is_premium: boolean | null
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
    if (!stripe) {
      return NextResponse.json(
        { error: 'Stripe not configured' },
        { status: 500 }
      )
    }

    const body = await request.text()
    const signature = request.headers.get('stripe-signature')

    if (!signature) {
      return NextResponse.json(
        { error: 'No signature' },
        { status: 400 }
      )
    }

    let event: Stripe.Event

    try {
      event = stripe.webhooks.constructEvent(
        body,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET!
      )
    } catch (err) {
      console.error('Webhook signature verification failed:', err)
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 400 }
      )
    }

    // Handle the event
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session)
        break

      case 'payment_intent.succeeded':

        break

      case 'payment_intent.payment_failed':

        break

      default:

    }

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('Webhook error:', error)
    return NextResponse.json(
      { error: 'Webhook handler failed' },
      { status: 500 }
    )
  }
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  try {
    const { threadId, userId, creatorId: metadataCreatorId, amountUsd } = session.metadata || {}

    if (!threadId || !userId) {
      console.error('Missing metadata in checkout session')
      return
    }

    if (session.payment_status !== 'paid') {
      console.warn('Checkout session not paid:', session.id)
      return
    }

    if (!session.payment_intent) {
      console.error('Missing payment intent in checkout session')
      return
    }

    if (session.currency && session.currency.toLowerCase() !== 'usd') {
      console.error('Unexpected currency for Stripe checkout:', session.currency)
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

    const amountTotal = session.amount_total
    if (amountTotal === null || amountTotal === undefined) {
      console.error('Missing amount_total in checkout session')
      return
    }

    const amountDecimal = amountTotal / 100
    if (amountUsd) {
      const expected = Number(amountUsd)
      if (!Number.isNaN(expected) && Math.abs(expected - amountDecimal) > 0.01) {
        console.error('Amount mismatch in checkout session metadata:', {
          expected,
          amountDecimal,
        })
        return
      }
    }

    const { data: creatorProfile, error: creatorProfileError } = await supabase
      .from('users')
      .select('is_premium')
      .eq('id', creatorId)
      .maybeSingle()

    if (creatorProfileError) {
      console.error('Failed to fetch creator premium status:', creatorProfileError)
    }

    const isCreatorPremium = (creatorProfile as CreatorProfile | null)?.is_premium === true
    const creatorShare = isCreatorPremium ? 0.7 : 0.5
    const platformFee = amountDecimal * (1 - creatorShare)
    const creatorEarnings = amountDecimal * creatorShare

    const paymentIntentId = session.payment_intent as string
    const { data: existingPayment } = await supabase
      .from('payments')
      .select('id')
      .eq('stripe_payment_intent_id', paymentIntentId)
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
          stripe_payment_intent_id: paymentIntentId,
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
          stripe_payment_intent_id: paymentIntentId,
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

    if (paymentCreated || purchaseCreated) {
      await supabase.from('notifications').insert({
        user_id: userId,
        type: 'thread_like', // Reusing existing type - you may want to add 'purchase_completed'
        category: 'system',
        title: 'Purchase Successful',
        message: 'You now have access to the premium thread!',
        data: { thread_id: threadId },
      })

      await supabase.from('notifications').insert({
        user_id: creatorId,
        type: 'thread_like', // Reusing existing type
        category: 'system',
        title: 'New Sale!',
        message: `You earned $${creatorEarnings.toFixed(2)} from a thread purchase!`,
        data: { thread_id: threadId, amount: creatorEarnings },
      })
    }
  } catch (error) {
    console.error('Error handling checkout completion:', error)
  }
}
