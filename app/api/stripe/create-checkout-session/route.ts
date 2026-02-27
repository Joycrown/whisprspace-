import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient as createSupabaseServerClient } from '@/lib/core/supabase/server'
import { createClient as createSupabaseAdminClient } from '@supabase/supabase-js'
import { buildThreadPath } from '@/lib/threads/thread-url'

// Initialize Stripe - will need API key in .env
const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2024-12-18.acacia',
    })
  : null

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

const getBaseUrl = (request: NextRequest) =>
  process.env.NEXT_PUBLIC_APP_URL || request.headers.get('origin') || ''

const getThreadForPurchase = async (threadId: string) => {
  const { data, error } = await supabaseAdmin
    .from('threads')
    .select('id,title,creator_id,is_premium,price,deleted_at,expires_at')
    .eq('id', threadId)
    .single()

  if (error || !data) {
    return { thread: null, error: 'Thread not found' }
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
  try {
    if (!stripe) {
      return NextResponse.json(
        { error: 'Stripe is not configured' },
        { status: 500 }
      )
    }

    const { threadId } = await request.json()

    if (!threadId) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      )
    }

    const supabase = await createSupabaseServerClient()
    const { data: { user }, error: userError } = await supabase.auth.getUser()

    if (userError || !user) {
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
        { error: 'Thread is not premium' },
        { status: 400 }
      )
    }

    const price = Number(thread.price)
    if (!price || Number.isNaN(price) || price <= 0) {
      return NextResponse.json(
        { error: 'Invalid thread price' },
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

    const alreadyPurchased = await hasExistingPurchase(threadId, user.id)
    if (alreadyPurchased) {
      return NextResponse.json(
        { error: 'Thread already purchased', alreadyPurchased: true },
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
    const threadPath = buildThreadPath({ id: threadId, title: thread.title || undefined })

    // Create Stripe Checkout session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card', 'link'], // Link is Stripe's fast checkout
      // Google Pay and Apple Pay are automatically shown when available
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: thread.title ? `Premium Thread: ${thread.title}` : 'Premium Thread Access',
              description: 'Access to premium thread',
            },
            unit_amount: Math.round(price * 100), // Convert to cents
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${baseUrl}${threadPath}?purchased=true`,
      cancel_url: `${baseUrl}${threadPath}?purchased=false`,
      customer_email: user.email ?? undefined,
      client_reference_id: user.id,
      metadata: {
        threadId,
        userId: user.id,
        creatorId: thread.creator_id,
        amountUsd: price.toFixed(2),
        currency: 'USD',
      },
    })

    return NextResponse.json({ url: session.url })
  } catch (error) {
    console.error('Stripe checkout error:', error)
    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 }
    )
  }
}
