import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'crypto'
import { supabaseAdmin } from '@/lib/core/supabase/admin-client'
import { sanitizeEmailAddress } from '@/lib/security/input-sanitization'

const NEUTRAL_ERROR = 'This link is no longer valid.'

export async function POST(req: NextRequest) {
  let body: { token?: string; email?: string }
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const { token, email } = body

  if (!token || typeof token !== 'string') {
    return NextResponse.json({ error: NEUTRAL_ERROR }, { status: 400 })
  }

  const tokenHash = createHash('sha256').update(token).digest('hex')

  const { data: tokenRow } = await supabaseAdmin
    .from('seed_claim_tokens')
    .select('user_id, expires_at, claimed_at')
    .eq('token_hash', tokenHash)
    .single()

  if (!tokenRow || tokenRow.claimed_at || new Date(tokenRow.expires_at) < new Date()) {
    return NextResponse.json({ error: NEUTRAL_ERROR }, { status: 410 })
  }

  const normalized = sanitizeEmailAddress(email || '')
  if (!normalized) {
    return NextResponse.json({ available: false, reason: 'invalid' })
  }

  const { data: profileMatch } = await supabaseAdmin
    .from('users')
    .select('id')
    .ilike('email', normalized)
    .neq('id', tokenRow.user_id)
    .limit(1)
    .maybeSingle()

  if (profileMatch) {
    return NextResponse.json({ available: false, reason: 'taken' })
  }

  const { data: authList } = await supabaseAdmin.auth.admin.listUsers({
    page: 1,
    perPage: 1,
    // @ts-expect-error - filter is supported by GoTrue but missing from the SDK types
    filter: `email.eq.${normalized}`,
  })

  const authMatch = (authList?.users ?? []).find(
    (u) => u.email?.toLowerCase() === normalized && u.id !== tokenRow.user_id
  )

  if (authMatch) {
    return NextResponse.json({ available: false, reason: 'taken' })
  }

  return NextResponse.json({ available: true })
}
