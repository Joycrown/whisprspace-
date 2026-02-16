import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabaseAdminClient } from '@supabase/supabase-js'
import { resolveUserFromRequest } from '../_auth'

export const runtime = 'nodejs'

const supabaseAdmin = createSupabaseAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } }
)

export async function POST(request: NextRequest) {
  try {
    const user = await resolveUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const endpoint =
      body && typeof body.endpoint === 'string' ? body.endpoint.trim() : null

    let query = supabaseAdmin
      .from('push_subscriptions')
      .update({
        is_active: false,
        failure_reason: 'unsubscribed_by_user',
        last_failure_at: new Date().toISOString(),
      })
      .eq('user_id', user.id)

    if (endpoint) {
      query = query.eq('endpoint', endpoint)
    }

    const { error } = await query

    if (error) {
      console.error('Failed to unsubscribe push subscription:', error)
      return NextResponse.json(
        { error: 'Failed to unsubscribe push notifications' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Push unsubscribe route error:', error)
    return NextResponse.json(
      { error: 'Failed to unsubscribe from push notifications' },
      { status: 500 }
    )
  }
}

