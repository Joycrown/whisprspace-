import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabaseAdminClient } from '@supabase/supabase-js'
import { resolveUserFromRequest } from '../_auth'
import { detectDeviceType } from '@/lib/notifications/push-service'

export const runtime = 'nodejs'

const supabaseAdmin = createSupabaseAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } }
)

type PushSubscriptionBody = {
  endpoint?: string
  keys?: {
    p256dh?: string
    auth?: string
  }
}

const extractSubscription = (payload: unknown): PushSubscriptionBody | null => {
  if (!payload || typeof payload !== 'object') {
    return null
  }

  const body = payload as Record<string, unknown>
  const nested = body.subscription

  if (nested && typeof nested === 'object') {
    return nested as PushSubscriptionBody
  }

  return body as PushSubscriptionBody
}

export async function POST(request: NextRequest) {
  try {
    const user = await resolveUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const rawBody = await request.json().catch(() => null)
    const subscription = extractSubscription(rawBody)

    const endpoint = subscription?.endpoint?.trim()
    const p256dh = subscription?.keys?.p256dh?.trim()
    const auth = subscription?.keys?.auth?.trim()

    if (!endpoint || !p256dh || !auth) {
      return NextResponse.json(
        { error: 'Invalid push subscription payload' },
        { status: 400 }
      )
    }

    const userAgent = request.headers.get('user-agent')
    const deviceType = detectDeviceType(userAgent)

    const { error } = await supabaseAdmin
      .from('push_subscriptions')
      .upsert(
        {
          user_id: user.id,
          endpoint,
          p256dh,
          auth,
          user_agent: userAgent,
          device_type: deviceType,
          is_active: true,
          failure_reason: null,
          last_failure_at: null,
        },
        { onConflict: 'endpoint' }
      )

    if (error) {
      console.error('Failed to save push subscription:', error)
      return NextResponse.json(
        { error: 'Failed to save push subscription' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Push subscribe route error:', error)
    return NextResponse.json(
      { error: 'Failed to subscribe for push notifications' },
      { status: 500 }
    )
  }
}

