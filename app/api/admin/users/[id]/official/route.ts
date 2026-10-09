import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/core/supabase/admin-client'
import { requireAdmin } from '@/lib/security/admin-auth'
import { sanitizeUuid } from '@/lib/security/input-sanitization'

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin(request)
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await context.params
  const userId = sanitizeUuid(id)
  if (!userId) return NextResponse.json({ error: 'Invalid user.' }, { status: 400 })

  const body = (await request.json().catch(() => null)) as { official?: unknown } | null
  if (typeof body?.official !== 'boolean') {
    return NextResponse.json({ error: 'Specify whether the account is official.' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('users')
    .update({ is_official: body.official })
    .eq('id', userId)
    .select('id, is_official')
    .maybeSingle()

  if (error) {
    console.error('[Admin] Failed to update official flag:', error.message)
    return NextResponse.json({ error: 'Unable to update this account.' }, { status: 500 })
  }
  if (!data) return NextResponse.json({ error: 'User not found.' }, { status: 404 })

  console.log('[Admin] Official flag changed', { userId, official: data.is_official, by: admin.id })
  return NextResponse.json({ user: data })
}
