import { NextRequest, NextResponse } from 'next/server'
import { createHash, randomBytes } from 'crypto'
import { supabaseAdmin } from '@/lib/core/supabase/admin-client'
import { resolveUserFromRequest } from '@/lib/security/request-auth'

async function verifyAdmin(req: NextRequest): Promise<string | null> {
  const user = await resolveUserFromRequest(req)
  if (!user) return null
  const { data: adminRow } = await supabaseAdmin.from('admin_users').select('user_id').eq('user_id', user.id).single()
  if (adminRow) return user.id
  const { data: userRow } = await supabaseAdmin.from('users').select('is_admin').eq('id', user.id).single()
  return userRow?.is_admin === true ? user.id : null
}

const TOKEN_TTL_DAYS = 7

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const adminId = await verifyAdmin(req)
  if (!adminId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  // Confirm account is still unclaimed
  const { data: user } = await supabaseAdmin
    .from('users')
    .select('id, username, account_state')
    .eq('id', id)
    .eq('account_state', 'unclaimed')
    .single()

  if (!user) return NextResponse.json({ error: 'Account not found or already claimed' }, { status: 404 })

  const rawToken = randomBytes(32).toString('base64url')
  const tokenHash = createHash('sha256').update(rawToken).digest('hex')
  const expiresAt = new Date(Date.now() + TOKEN_TTL_DAYS * 86400 * 1000).toISOString()

  // Upsert — burns old token, issues new one
  const { error } = await supabaseAdmin
    .from('seed_claim_tokens')
    .upsert(
      { user_id: id, token_hash: tokenHash, created_by: adminId, expires_at: expiresAt, claimed_at: null },
      { onConflict: 'user_id' }
    )

  if (error) return NextResponse.json({ error: 'Failed to regenerate token' }, { status: 500 })

  await supabaseAdmin.from('seed_audit_log').insert({
    admin_id: adminId,
    action: 'regenerated_token',
    user_id: id,
    handle: user.username,
  })

  const base = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || 'https://whisprspace.com'
  const claimUrl = `${base}/claim/${rawToken}`
  const inboxUrl = `${base}/message/${user.username}`

  return NextResponse.json({
    claimUrl,
    expiresAt,
    whatsappText: `Hey! Here's a fresh claim link for your WhisprSpace inbox.\n\n📥 Inbox: ${inboxUrl}\n\n👉 Claim your account: ${claimUrl}\n\nLink expires in 7 days.`,
  })
}
