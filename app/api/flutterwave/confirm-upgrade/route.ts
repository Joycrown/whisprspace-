import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabaseServerClient } from '@/lib/core/supabase/server'
import { createClient as createSupabaseAdminClient } from '@supabase/supabase-js'

const supabaseAdmin = createSupabaseAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
)

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

    const { transactionId, txRef } = await request.json().catch(() => ({}))
    if (!transactionId && !txRef) {
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
          txRef as string
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

    const resolvedUserId = String(meta?.userId || '').trim()
    const resolvedPlan = String(meta?.plan || '').trim()
    const resolvedAmountUsd = meta?.amountUsd ?? meta?.amount_usd
    const fallbackTxMatch = !paymentType && txRef && txRef.startsWith(`whispr_premium_${user.id}_`)

    if ((!resolvedUserId || !resolvedPlan || resolvedAmountUsd === undefined) && !fallbackTxMatch) {
      return NextResponse.json(
        { error: 'Missing payment metadata' },
        { status: 400 }
      )
    }

    if (resolvedUserId && resolvedUserId !== user.id) {
      return NextResponse.json(
        { error: 'Payment does not belong to this user' },
        { status: 403 }
      )
    }

    const plan = resolvedPlan || 'monthly'
    if (plan !== 'monthly' && plan !== 'annual') {
      return NextResponse.json(
        { error: 'Invalid subscription plan' },
        { status: 400 }
      )
    }

    const planFallbackUsd = plan === 'annual' ? 18 : 2
    const amountUsd = Number(resolvedAmountUsd ?? planFallbackUsd)
    const verifiedAmount = Number(verified?.amount)
    const verifiedCurrency = String(verified?.currency || '').toUpperCase()
    const expectedCurrency = String(meta?.currency || verifiedCurrency || 'USD').toUpperCase()
    const expectedAmount = Number(
      meta?.amount ??
        meta?.amount_local ??
        meta?.amountUsd ??
        meta?.amount_usd ??
        (Number.isNaN(verifiedAmount) ? 0 : verifiedAmount)
    )

    if (Number.isNaN(amountUsd) || amountUsd <= 0) {
      return NextResponse.json(
        { error: 'Invalid payment amount' },
        { status: 400 }
      )
    }

    if (verifiedCurrency && expectedCurrency && verifiedCurrency !== expectedCurrency) {
      return NextResponse.json(
        { error: 'Unexpected payment currency' },
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

    const { data: userProfile } = await supabaseAdmin
      .from('users')
      .select('premium_expires_at')
      .eq('id', user.id)
      .maybeSingle()

    const now = new Date()
    const currentExpiry =
      userProfile?.premium_expires_at && new Date(userProfile.premium_expires_at) > now
        ? new Date(userProfile.premium_expires_at)
        : now

    const durationDays = plan === 'annual' ? 365 : 30
    const newExpiry = new Date(currentExpiry.getTime() + durationDays * 24 * 60 * 60 * 1000)

    const transactionRef = String(verified?.id || transactionId)
    const resolvedTxRef = String(verified?.tx_ref || txRef || transactionRef)
    const paymentMethod = verified?.payment_type || verified?.payment_method
    const ledgerAmount =
      !Number.isNaN(expectedAmount) && expectedAmount > 0 ? expectedAmount : amountUsd
    const ledgerCurrency = expectedCurrency || 'USD'

    const { error: premiumUpdateError } = await supabaseAdmin
      .from('users')
      .update({
        is_premium: true,
        premium_expires_at: newExpiry.toISOString(),
        premium_provider: 'flutterwave',
        premium_last_tx_ref: resolvedTxRef,
        premium_reminder_sent_for: null,
      })
      .eq('id', user.id)

    if (premiumUpdateError) {
      console.error('Failed to update premium status:', premiumUpdateError)
      return NextResponse.json(
        { error: 'Failed to update premium status' },
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
          payment_id: null,
          payment_provider: 'flutterwave',
          payment_type: 'premium_upgrade',
          tx_ref: resolvedTxRef,
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
            userId: user.id,
            currency: ledgerCurrency,
          },
          raw_payload: verified,
          occurred_at: verified?.created_at || new Date().toISOString(),
        },
        { onConflict: 'payment_provider,tx_ref' }
      )

    await supabaseAdmin.from('notifications').insert({
      user_id: user.id,
      type: 'thread_like',
      category: 'system',
      title: 'Premium Activated',
      message: 'Your premium upgrade is complete. Enjoy the full experience!',
      data: { plan },
    })

    return NextResponse.json({ success: true, premiumExpiresAt: newExpiry.toISOString() })
  } catch (error) {
    console.error('Flutterwave confirm upgrade error:', error)
    return NextResponse.json(
      { error: 'Failed to confirm premium upgrade' },
      { status: 500 }
    )
  }
}
