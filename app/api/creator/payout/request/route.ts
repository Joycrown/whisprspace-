import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { enforceRateLimit, withRateLimitHeaders } from '@/lib/security/rate-limit'
import { resolveUserFromRequest } from '@/lib/security/request-auth'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
)

export async function POST(request: NextRequest) {
  const rateLimit = enforceRateLimit({
    request,
    namespace: 'payout:request',
    max: 5,
    windowMs: 60_000,
  })
  if (!rateLimit.allowed) {
    return rateLimit.response
  }

  try {
    const user = await resolveUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const payload = await request.json()
    const { amountUsd, currency, bankCode, bankName, accountNumber, otp } = payload

    // Validate input
    if (!amountUsd || !currency || !bankCode || !bankName || !accountNumber || !otp) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const requestedAmount = Number(amountUsd)
    if (isNaN(requestedAmount) || requestedAmount < 10) {
      return NextResponse.json({ error: 'Minimum withdrawal amount is $10' }, { status: 400 })
    }

    // Verify OTP
    const { data: otpData, error: otpError } = await supabaseAdmin
      .from('payout_otps')
      .select('id')
      .eq('user_id', user.id)
      .eq('code', otp)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle()

    if (otpError || !otpData) {
      return NextResponse.json({ error: 'Invalid or expired verification code' }, { status: 400 })
    }

    // Check balance
    const { data: earnings, error: earningsError } = await supabaseAdmin
      .from('creator_earnings')
      .select('id, net_amount')
      .eq('creator_id', user.id)
      .eq('status', 'pending')

    if (earningsError) {
      console.error('Failed to fetch earnings for withdrawal:', earningsError)
      return NextResponse.json({ error: 'Failed to verify balance' }, { status: 500 })
    }

    const totalPending = (earnings || []).reduce((sum, e) => sum + Number(e.net_amount || 0), 0)
    if (totalPending < requestedAmount) {
      return NextResponse.json({ error: 'Insufficient balance' }, { status: 400 })
    }

    // Delete used OTP
    await supabaseAdmin.from('payout_otps').delete().eq('id', otpData.id)

    // Create payout request entry
    const { data: payoutRequest, error: requestError } = await supabaseAdmin
      .from('payout_requests')
      .insert({
        user_id: user.id,
        amount_usd: requestedAmount,
        currency,
        bank_code: bankCode,
        bank_name: bankName,
        account_number: accountNumber,
        status: 'pending_admin',
      })
      .select()
      .single()

    if (requestError) {
      console.error('Failed to create payout request:', requestError)
      return NextResponse.json({ error: 'Failed to submit request' }, { status: 500 })
    }

    // Reserve earnings (set status to processing)
    const earningIds = (earnings || []).map(e => e.id)
    if (earningIds.length > 0) {
      await supabaseAdmin
        .from('creator_earnings')
        .update({ 
          status: 'processing',
          payout_request_id: payoutRequest.id
        })
        .in('id', earningIds)
    }

    // Notify Admin via Email
    const brevoApiKey = process.env.BREVO_TRANSACTIONAL_API_KEY || process.env.NEXT_PUBLIC_BREVO_API_KEY
    if (brevoApiKey) {
      // Admin notification
      fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'accept': 'application/json',
          'api-key': brevoApiKey,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          sender: { name: 'WhisprSpace System', email: 'system@whisprspace.com' },
          to: [{ email: 'admin@whisprspace.com' }],
          subject: '[URGENT] New Withdrawal Request Submitted',
          htmlContent: `
            <div style="font-family: sans-serif; color: #1f2937;">
              <h2>New Withdrawal Request</h2>
              <p>A creator has submitted a new withdrawal request that requires manual review.</p>
              <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
                <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;"><strong>Request ID:</strong></td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${payoutRequest.id}</td></tr>
                <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;"><strong>User ID:</strong></td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${user.id}</td></tr>
                <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;"><strong>Amount:</strong></td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">$${requestedAmount} (Target: ${currency})</td></tr>
                <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;"><strong>Bank:</strong></td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${bankName} (${bankCode})</td></tr>
                <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;"><strong>Account:</strong></td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${accountNumber}</td></tr>
              </table>
              <p style="margin-top: 24px;">Please log in to the <a href="${process.env.NEXT_PUBLIC_APP_URL}/admin">Admin Dashboard</a> to process this request.</p>
            </div>
          `,
        }),
      }).catch(err => console.error('Failed to notify admin of payout request:', err))

      // User confirmation
      if (user.email) {
        fetch('https://api.brevo.com/v3/smtp/email', {
          method: 'POST',
          headers: {
            'accept': 'application/json',
            'api-key': brevoApiKey,
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            sender: { name: 'WhisprSpace', email: 'hello@whisprspace.com' },
            to: [{ email: user.email }],
            subject: 'Withdrawal Request Received',
            htmlContent: `
              <div style="font-family: sans-serif; color: #1f2937;">
                <h2>Withdrawal Request Submitted</h2>
                <p>Hello,</p>
                <p>We've received your withdrawal request and it is currently being reviewed by our team.</p>
                <div style="background-color: #f3f4f6; padding: 16px; border-radius: 8px; margin: 20px 0;">
                  <p style="margin: 0;"><strong>Amount:</strong> $${requestedAmount} (${currency})</p>
                  <p style="margin: 4px 0 0 0;"><strong>Status:</strong> Processing</p>
                </div>
                <p>You will receive another email once your request has been approved and processed.</p>
                <p>Thanks,<br/>The WhisprSpace Team</p>
              </div>
            `,
          }),
        }).catch(err => console.error('Failed to send user confirmation email:', err))
      }
    }

    // Record activity
    const { error: activityError } = await supabaseAdmin.rpc('track_activity', {
      p_user_id: user.id,
      p_event_type: 'payout_request',
      p_event_data: {
        requestId: payoutRequest.id,
        amount: requestedAmount,
        currency,
        bank: bankName
      }
    })
    
    if (activityError) {
      console.error('Failed to track payout activity:', activityError)
    }

    return withRateLimitHeaders(
      NextResponse.json({ 
        message: 'Withdrawal request submitted for review', 
        requestId: payoutRequest.id 
      }),
      rateLimit.headers
    )
  } catch (error) {
    console.error('Payout request submission error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
