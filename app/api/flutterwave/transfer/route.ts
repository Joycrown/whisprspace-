import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabaseServerClient } from '@/lib/core/supabase/server'
import { createClient as createSupabaseAdminClient } from '@supabase/supabase-js'
import crypto from 'crypto'

const supabaseAdmin = createSupabaseAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
)

const normalizeStatus = (status?: string | null) => {
  const value = String(status || '').toLowerCase()
  if (value.includes('success')) return 'completed'
  if (value.includes('fail')) return 'failed'
  return 'pending'
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
        { error: 'Flutterwave is not configured' },
        { status: 500 }
      )
    }

    const payload = await request.json()
    const currency = String(payload?.currency || 'USD').toUpperCase()
    const accountBank = String(payload?.accountBank || payload?.account_bank || '')
    const accountNumber = String(payload?.accountNumber || payload?.account_number || '')
    const narration = payload?.narration ? String(payload?.narration) : 'Creator payout'
    const reference = payload?.reference ? String(payload?.reference) : ''
    const debitCurrency = String(payload?.debitCurrency || payload?.debit_currency || currency).toUpperCase()
    const extraMeta = payload?.meta && typeof payload.meta === 'object' ? payload.meta : {}

    if (!accountBank || !accountNumber) {
      return NextResponse.json(
        { error: 'Missing or invalid payout details' },
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

    const creatorId = payload?.creatorId ? String(payload.creatorId) : user.id
    if (creatorId !== user.id) {
      return NextResponse.json(
        { error: 'Not authorized to initiate payout for this creator' },
        { status: 403 }
      )
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || request.headers.get('origin') || ''
    if (!baseUrl) {
      return NextResponse.json(
        { error: 'Missing app URL configuration' },
        { status: 500 }
      )
    }

    const txRef = reference || `payout_${creatorId}_${crypto.randomUUID()}`

    const { data: pendingRows, error: pendingError } = await supabaseAdmin
      .from('creator_earnings')
      .select('id, net_amount, status')
      .eq('creator_id', creatorId)
      .eq('status', 'pending')
      .order('created_at', { ascending: true })

    if (pendingError) {
      console.error('Failed to load pending earnings:', pendingError)
      return NextResponse.json(
        { error: 'Unable to calculate pending earnings' },
        { status: 500 }
      )
    }

    const pendingTotal = (pendingRows || []).reduce((sum, row) => sum + Number(row.net_amount || 0), 0)
    if (!pendingTotal || pendingTotal < 10) {
      return NextResponse.json(
        { error: 'Pending balance below payout threshold' },
        { status: 400 }
      )
    }

    const amount = Number(pendingTotal.toFixed(2))
    const earningIds = (pendingRows || []).map(row => row.id)

    if (earningIds.length > 0) {
      await supabaseAdmin
        .from('creator_earnings')
        .update({ status: 'processing' })
        .in('id', earningIds)
    }

    await supabaseAdmin
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
          payment_method: 'transfer',
          amount: -Math.abs(amount),
          currency,
          amount_usd: currency === 'USD' ? -Math.abs(amount) : null,
          status: 'pending',
          description: narration,
          metadata: {
            creatorId,
            debitCurrency,
            earningIds,
            ...sanitizeTransferMetadata(extraMeta),
          },
          occurred_at: new Date().toISOString(),
        },
        { onConflict: 'payment_provider,tx_ref' }
      )

    const transferResponse = await fetch('https://api.flutterwave.com/v3/transfers', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${flutterwaveSecretKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        account_bank: accountBank,
        account_number: accountNumber,
        amount,
        currency,
        reference: txRef,
        narration,
        callback_url: `${baseUrl}/api/flutterwave/webhook`,
        debit_currency: debitCurrency,
        meta: {
          creatorId,
          userId: user.id,
          earningIds,
          ...extraMeta,
        },
      }),
    })

    const transferData = await transferResponse.json().catch(() => null)
    if (!transferResponse.ok) {
      await supabaseAdmin
        .from('transaction_ledger')
        .update({
          status: 'failed',
          raw_payload: sanitizeTransferPayload(transferData),
          occurred_at: new Date().toISOString(),
        })
        .eq('payment_provider', 'flutterwave')
        .eq('tx_ref', txRef)

      if (earningIds.length > 0) {
        await supabaseAdmin
          .from('creator_earnings')
          .update({ status: 'pending' })
          .in('id', earningIds)
      }

      return NextResponse.json(
        { error: 'Failed to initiate payout' },
        { status: 500 }
      )
    }

    const providerTransactionId = transferData?.data?.id ? String(transferData.data.id) : null
    const providerStatus = normalizeStatus(transferData?.data?.status)

    await supabaseAdmin
      .from('transaction_ledger')
      .update({
        provider_transaction_id: providerTransactionId,
        status: providerStatus,
        raw_payload: sanitizeTransferPayload(transferData),
        occurred_at: new Date().toISOString(),
      })
      .eq('payment_provider', 'flutterwave')
      .eq('tx_ref', txRef)

    return NextResponse.json({
      reference: txRef,
      status: providerStatus,
      providerTransactionId,
    })
  } catch (error) {
    console.error('Flutterwave transfer initiation error:', error)
    return NextResponse.json(
      { error: 'Failed to initiate payout' },
      { status: 500 }
    )
  }
}
