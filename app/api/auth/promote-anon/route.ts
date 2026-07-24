import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/core/supabase/admin-client'

/**
 * Flip a just-upgraded anonymous account's public.users row to non-anonymous.
 *
 * The client first calls Supabase updateUser (email+password) on the anonymous
 * session — this keeps the same auth UUID, so all conversations/messages/handle
 * stay attached. This route then marks the profile row as a permanent account.
 *
 * Auth: the caller must present the user's own access token; we verify it maps to
 * the userId being promoted before touching the row (no privilege escalation).
 */
export async function POST(req: NextRequest) {
  let body: { userId?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const { userId } = body
  if (!userId || typeof userId !== 'string') {
    return NextResponse.json({ error: 'Missing userId' }, { status: 400 })
  }

  const authHeader = req.headers.get('authorization') || ''
  const token = authHeader.replace(/^Bearer\s+/i, '').trim()
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Verify the token belongs to the user being promoted.
  const { data: userData, error: verifyError } = await supabaseAdmin.auth.getUser(token)
  if (verifyError || !userData.user || userData.user.id !== userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { error: updateError } = await supabaseAdmin
    .from('users')
    .update({ is_anonymous: false })
    .eq('id', userId)

  if (updateError) {
    console.error('[promote-anon] Failed to flip is_anonymous:', updateError.message)
    return NextResponse.json({ error: 'Failed to upgrade profile' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
