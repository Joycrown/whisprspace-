import { NextRequest, NextResponse } from 'next/server'
import {
  dispatchPushForNotification,
  markNotificationPushAttempted,
} from '@/lib/notifications/push-service'

export const runtime = 'nodejs'

type DispatchNotificationPayload = {
  id: string
  user_id: string
  title: string
  message: string
  data?: Record<string, unknown> | null
}

const extractNotification = (payload: unknown): DispatchNotificationPayload | null => {
  if (!payload || typeof payload !== 'object') {
    return null
  }

  const root = payload as Record<string, unknown>
  const candidate =
    (root.notification as Record<string, unknown> | undefined) ||
    (root.record as Record<string, unknown> | undefined) ||
    root

  if (
    typeof candidate.id !== 'string' ||
    typeof candidate.user_id !== 'string' ||
    typeof candidate.title !== 'string' ||
    typeof candidate.message !== 'string'
  ) {
    return null
  }

  return {
    id: candidate.id,
    user_id: candidate.user_id,
    title: candidate.title,
    message: candidate.message,
    data:
      candidate.data && typeof candidate.data === 'object'
        ? (candidate.data as Record<string, unknown>)
        : null,
  }
}

const isAuthorized = (request: NextRequest) => {
  const secret = process.env.PUSH_DISPATCH_SECRET
  if (!secret) return true

  const authHeader = request.headers.get('authorization')
  const headerSecret = request.headers.get('x-push-dispatch-secret')

  return authHeader === `Bearer ${secret}` || headerSecret === secret
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json().catch(() => null)
    const notification = extractNotification(body)

    if (!notification) {
      return NextResponse.json(
        { error: 'Invalid notification payload' },
        { status: 400 }
      )
    }

    const result = await dispatchPushForNotification(notification)

    if (!(result.skipped && result.reason === 'VAPID keys are not configured')) {
      await markNotificationPushAttempted(notification.id)
    }

    return NextResponse.json({ success: true, result })
  } catch (error) {
    console.error('Push dispatch route error:', error)
    return NextResponse.json(
      { error: 'Failed to dispatch push notification' },
      { status: 500 }
    )
  }
}

