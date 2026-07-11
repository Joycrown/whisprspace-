import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'crypto'
import { supabaseAdmin } from '@/lib/core/supabase/admin-client'

const NEUTRAL_ERROR = 'This link is no longer valid.'

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token')
  if (!token) return NextResponse.json({ error: NEUTRAL_ERROR }, { status: 400 })

  const tokenHash = createHash('sha256').update(token).digest('hex')

  const { data, error } = await supabaseAdmin
    .from('seed_claim_tokens')
    .select('user_id, expires_at, claimed_at, users ( username, anonymous_id )')
    .eq('token_hash', tokenHash)
    .single()

  if (error || !data) return NextResponse.json({ error: NEUTRAL_ERROR }, { status: 404 })
  if (data.claimed_at) return NextResponse.json({ error: NEUTRAL_ERROR }, { status: 410 })
  if (new Date(data.expires_at) < new Date()) return NextResponse.json({ error: NEUTRAL_ERROR }, { status: 410 })

  const user = Array.isArray(data.users) ? data.users[0] : data.users
  const handle = user?.username || user?.anonymous_id || 'unknown'

  return NextResponse.json({ valid: true, handle, userId: data.user_id })
}
