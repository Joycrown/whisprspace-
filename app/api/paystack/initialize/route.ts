import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabaseServerClient } from '@/lib/core/supabase/server'
import { createClient as createSupabaseAdminClient } from '@supabase/supabase-js'
import { buildThreadPath } from '@/lib/threads/thread-url'

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

const getPaystackCurrency = (countryCode?: string): string => {
  const currencyMap: Record<string, string> = {
    NG: 'NGN',
    GH: 'GHS',
    ZA: 'ZAR',
    KE: 'KES',
  }

  const key = (countryCode || '').toUpperCase()
  return currencyMap[key] || 'NGN'
}

const convertUsdToLocal = (usdAmount: number, currency: string): number => {
  const conversionRates: Record<string, number> = {
    NGN: 1550,
    GHS: 15.5,
    ZAR: 18.5,
    KES: 155,
  }

  const rate = conversionRates[currency] || 1
  return Math.round(usdAmount * rate * 100) / 100
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
    const paystackSecretKey = process.env.PAYSTACK_SECRET_KEY

    if (!paystackSecretKey) {
      return NextResponse.json(
        { error: 'Paystack is not configured' },
        { status: 500 }
      )
    }

    const { threadId, country } = await request.json()

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

    const currency = getPaystackCurrency(country)
    const localAmount = convertUsdToLocal(price, currency)
    const amountInKobo = Math.round(localAmount * 100)
    const email = user.email || `${user.id}@anonymous.whisprspace.com`

    const response = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${paystackSecretKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        amount: amountInKobo,
        currency,
        callback_url: `${baseUrl}${threadPath}?purchased=true&gateway=paystack`,
        metadata: {
          threadId,
          userId: user.id,
          creatorId: thread.creator_id,
          usdAmount: price.toFixed(2),
          localAmount: (amountInKobo / 100).toFixed(2),
          currency,
          custom_fields: [
            {
              display_name: 'Thread ID',
              variable_name: 'thread_id',
              value: threadId,
            },
            {
              display_name: 'User ID',
              variable_name: 'user_id',
              value: user.id,
            },
          ],
        },
      }),
    })

    if (!response.ok) {
      const error = await response.json()
      console.error('Paystack initialization error:', error)
      return NextResponse.json(
        { error: 'Failed to initialize payment' },
        { status: 500 }
      )
    }

    const data = await response.json()

    return NextResponse.json({
      authorization_url: data.data.authorization_url,
      reference: data.data.reference,
    })
  } catch (error) {
    console.error('Paystack initialize error:', error)
    return NextResponse.json(
      { error: 'Failed to initialize payment' },
      { status: 500 }
    )
  }
}
