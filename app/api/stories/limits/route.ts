import { NextRequest, NextResponse } from 'next/server'
import { resolveUserFromRequest } from '@/lib/security/request-auth'
import { getSeriesLimitState, resolveRegisteredUser } from '@/lib/stories/server'

export async function GET(request: NextRequest) {
  const user = await resolveUserFromRequest(request)
  const profile = user ? await resolveRegisteredUser(user.id) : null
  if (!profile || profile.is_anonymous) {
    return NextResponse.json({ error: 'Sign in to see your stories.', code: 'account_required' }, { status: 401 })
  }

  const state = await getSeriesLimitState(profile.id, Boolean(profile.is_premium))
  return NextResponse.json(state)
}
