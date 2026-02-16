import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabaseAdminClient } from '@supabase/supabase-js'
import {
  dispatchPushForNotification,
  markNotificationPushAttempted,
} from '@/lib/notifications/push-service'

export const runtime = 'nodejs'

const supabaseAdmin = createSupabaseAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } }
)

type PendingNotification = {
  id: string
  user_id: string
  title: string
  message: string
  data: Record<string, unknown> | null
  created_at: string
}

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret) {
    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  const batchSize = 100

  const { data: pendingNotifications, error: pendingError } = await supabaseAdmin
    .from('notifications')
    .select('id,user_id,title,message,data,created_at')
    .is('push_sent_at', null)
    .order('created_at', { ascending: true })
    .limit(batchSize)

  if (pendingError) {
    console.error('Failed to load pending push notifications:', pendingError)
    return NextResponse.json(
      { error: 'Failed to load pending notifications' },
      { status: 500 }
    )
  }

  const notifications = (pendingNotifications || []) as PendingNotification[]

  let processed = 0
  let delivered = 0
  let removedSubscriptions = 0
  let deferred = 0

  for (const notification of notifications) {
    try {
      const result = await dispatchPushForNotification(notification)
      const shouldDefer =
        result.skipped && result.reason === 'VAPID keys are not configured'

      if (shouldDefer) {
        deferred += 1
        continue
      }

      await markNotificationPushAttempted(notification.id)

      processed += 1
      delivered += result.delivered
      removedSubscriptions += result.removed
    } catch (error) {
      console.error(
        `Failed to dispatch push for notification ${notification.id}:`,
        error
      )
    }
  }

  return NextResponse.json({
    queued: notifications.length,
    processed,
    delivered,
    removedSubscriptions,
    deferred,
  })
}

