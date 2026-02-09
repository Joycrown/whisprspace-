import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabaseServerClient } from '@/lib/core/supabase/server'
import { createClient as createSupabaseAdminClient } from '@supabase/supabase-js'
import crypto from 'crypto'

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

const getBaseUrl = (request: NextRequest) =>
  process.env.NEXT_PUBLIC_APP_URL || request.headers.get('origin') || ''

export async function POST(request: NextRequest) {
  try {
    const flutterwaveSecretKey = process.env.FLW_SECRET_KEY

    if (!flutterwaveSecretKey) {
      return NextResponse.json(
        { error: 'Flutterwave is not configured' },
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

    const txRef = `whispr_${threadId}_${crypto.randomUUID()}`
    const email = user.email || `${user.id}@anonymous.whisprspace.com`

    const response = await fetch('https://api.flutterwave.com/v3/payments', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${flutterwaveSecretKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        tx_ref: txRef,
        amount: price,
        currency: 'USD',
        redirect_url: `${baseUrl}/threads/${threadId}?purchased=true&gateway=flutterwave`,
        customer: {
          email,
          name: user.user_metadata?.username || user.user_metadata?.full_name || undefined,
        },
        meta: {
          threadId,
          userId: user.id,
          creatorId: thread.creator_id,
          amountUsd: price.toFixed(2),
          currency: 'USD',
        },
        customizations: {
          title: thread.title ? `Premium Thread: ${thread.title}` : 'Premium Thread Access',
          description: 'Access to premium thread',
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
          amount: price,
          amount_usd: price,
          currency: 'USD',
          status: 'pending',
          description: 'Premium thread purchase',
          metadata: {
            threadId,
            creatorId: thread.creator_id,
            userId: user.id,
            currency: 'USD',
          },
        },
        { onConflict: 'payment_provider,tx_ref' }
      )

    return NextResponse.json({ url })
  } catch (error) {
    console.error('Flutterwave initialize error:', error)
    return NextResponse.json(
      { error: 'Failed to initialize payment' },
      { status: 500 }
    )
  }
}
