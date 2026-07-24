import { NextRequest, NextResponse } from 'next/server'
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

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const adminId = await verifyAdmin(req)
  if (!adminId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const { data: user } = await supabaseAdmin
    .from('users')
    .select('id, username, account_state')
    .eq('id', id)
    .eq('account_state', 'unclaimed')
    .single()

  if (!user) return NextResponse.json({ error: 'Account not found or already claimed' }, { status: 404 })

  await supabaseAdmin.from('seed_audit_log').insert({
    admin_id: adminId,
    action: 'revoked',
    user_id: id,
    handle: user.username,
  })

  // Cascade deletes token + messages via FK ON DELETE CASCADE
  const { error } = await supabaseAdmin.from('users').delete().eq('id', id)
  if (error) return NextResponse.json({ error: 'Failed to revoke account' }, { status: 500 })

  return NextResponse.json({ success: true })
}
