import { NextResponse } from 'next/server'
import { getPublicVapidKey } from '@/lib/notifications/push-service'

export const runtime = 'nodejs'

export async function GET() {
  const publicKey = getPublicVapidKey()

  if (!publicKey) {
    return NextResponse.json(
      { error: 'Push notifications are not configured' },
      { status: 503 }
    )
  }

  return NextResponse.json({ publicKey })
}

