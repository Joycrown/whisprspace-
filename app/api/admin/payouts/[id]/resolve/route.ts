import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { resolveUserFromRequest } from '@/lib/security/request-auth'
import { getTrustedAppBaseUrl } from '@/lib/security/app-url'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
)

export async function POST(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const adminUser = await resolveUserFromRequest(request)
    if (!adminUser) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    // Verify Admin Status
    const { data: userRecord, error: userError } = await supabaseAdmin
      .from('users')
      .select('is_admin')
      .eq('id', adminUser.id)
      .single()

    const { data: adminRecord, error: adminError } = await supabaseAdmin
      .from('admin_users')
      .select('role')
      .eq('user_id', adminUser.id)
      .maybeSingle()

    if (userError || (!userRecord?.is_admin && !adminRecord)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id: requestId } = await props.params
    const payload = await request.json()
    const { action, notes } = payload // action: 'approve' | 'reject'

    if (!['approve', 'reject'].includes(action)) {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

    // Fetch the request
    const { data: payoutRequest, error: fetchError } = await supabaseAdmin
      .from('payout_requests')
      .select('*')
      .eq('id', requestId)
      .maybeSingle()

    if (fetchError || !payoutRequest) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 })
    }

    if (payoutRequest.status !== 'pending_admin') {
      return NextResponse.json({ error: 'Request is already processed' }, { status: 400 })
    }

    if (action === 'approve') {
      const flwSecretKey = process.env.FLW_SECRET_KEY
      const baseUrl = getTrustedAppBaseUrl(request)

      if (!flwSecretKey) {
        return NextResponse.json({ error: 'Payment provider not configured' }, { status: 500 })
      }

      // Initiate Flutterwave Transfer
      // We use USD as debit currency and target currency. 
      // Flutterwave handles conversion if target currency != USD.
      const transferResponse = await fetch('https://api.flutterwave.com/v3/transfers', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${flwSecretKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          account_bank: payoutRequest.bank_code,
          account_number: payoutRequest.account_number,
          amount: payoutRequest.amount_usd, 
          currency: payoutRequest.currency,
          reference: `payout_ref_${payoutRequest.id}`,
          narration: 'WhisprSpace Creator Withdrawal',
          callback_url: `${baseUrl}/api/flutterwave/webhook`,
          debit_currency: 'USD',
          meta: {
            requestId: payoutRequest.id,
            creatorId: payoutRequest.user_id,
            amountUsd: payoutRequest.amount_usd
          }
        }),
      })

      const transferData = await transferResponse.json()
      
      if (!transferResponse.ok) {
        console.error('Flutterwave transfer initiation failed:', transferData)
        return NextResponse.json({ 
          error: transferData.message || 'Failed to initiate transfer with provider' 
        }, { status: 400 })
      }

      // Update request status to processing
      const { error: updateError } = await supabaseAdmin
        .from('payout_requests')
        .update({
          status: 'processing',
          admin_notes: notes,
          processed_by: adminRecord ? adminUser.id : null,
          processed_at: new Date().toISOString()
        })
        .eq('id', requestId)

      if (updateError) {
        console.error('Failed to update payout request status:', updateError)
        return NextResponse.json({ error: 'Failed to update request state' }, { status: 500 })
      }

      return NextResponse.json({ message: 'Payout approved and processing' })

    } else {
      // Reject action
      // Revert earnings to pending and unlink from this request to restore available balance
      await supabaseAdmin
        .from('creator_earnings')
        .update({ 
          status: 'pending',
          payout_request_id: null
        })
        .eq('payout_request_id', requestId)

      // Update request status to rejected
      const { error: updateError } = await supabaseAdmin
        .from('payout_requests')
        .update({
          status: 'rejected',
          admin_notes: notes,
          processed_by: adminRecord ? adminUser.id : null,
          processed_at: new Date().toISOString()
        })
        .eq('id', requestId)

      if (updateError) {
        console.error('Failed to update payout request status to rejected:', updateError)
        return NextResponse.json({ error: 'Failed to update request state' }, { status: 500 })
      }

      return NextResponse.json({ message: 'Payout request rejected' })
    }
  } catch (error) {
    console.error('Admin resolve payout error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
