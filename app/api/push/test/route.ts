import { NextRequest, NextResponse } from 'next/server'
import { resolveUserFromRequest } from '../_auth'
import { sendPushToUser } from '@/lib/notifications/push-service'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    const user = await resolveUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))

    const title =
      typeof body?.title === 'string' && body.title.trim()
        ? body.title.trim()
        : 'WhisprSpace test notification'

    const message =
      typeof body?.message === 'string' && body.message.trim()
        ? body.message.trim()
        : 'Push notifications are active on this device.'

    const url =
      typeof body?.url === 'string' && body.url.trim()
        ? body.url.trim()
        : '/notifications'

    const result = await sendPushToUser(user.id, {
      title,
      body: message,
      url,
      tag: 'push-test',
    })

    return NextResponse.json({ success: true, result })
  } catch (error) {
    console.error('Push test route error:', error)
    return NextResponse.json(
      { error: 'Failed to send test notification' },
      { status: 500 }
    )
  }
}

