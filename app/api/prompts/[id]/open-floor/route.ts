import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/core/supabase/admin-client'
import { resolveUserFromRequest } from '@/lib/security/request-auth'
import { sanitizeUuid } from '@/lib/security/input-sanitization'

async function resolveAnonymousSystemUser(): Promise<string | null> {
  const { data: existing } = await supabaseAdmin
    .from('users')
    .select('id')
    .eq('anonymous_id', 'ANON_SYSTEM_INBOX')
    .maybeSingle()

  if (existing?.id) return existing.id

  const { data: created, error } = await supabaseAdmin
    .from('users')
    .insert({ anonymous_id: 'ANON_SYSTEM_INBOX', username: 'INBOX_USER', is_anonymous: true })
    .select('id')
    .single()

  if (created?.id) return created.id

  // Another conversion can create the shared row in the small window between
  // our lookup and insert. Resolve it once more instead of failing a valid run.
  if (error?.code === '23505') {
    const { data: concurrent } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('anonymous_id', 'ANON_SYSTEM_INBOX')
      .maybeSingle()
    if (concurrent?.id) return concurrent.id
  }

  console.error('[PromptOpenFloor] Could not create system user:', error?.message)
  return null
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params
    const promptId = sanitizeUuid(id)
    if (!promptId) return NextResponse.json({ error: 'Invalid prompt ID.' }, { status: 400 })

    const user = await resolveUserFromRequest(request)
    if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })

    const body = await request.json().catch(() => null)
    const threadId = sanitizeUuid((body as Record<string, unknown> | null)?.threadId)
    if (!threadId) return NextResponse.json({ error: 'Invalid discussion ID.' }, { status: 400 })

    const systemUserId = await resolveAnonymousSystemUser()
    if (!systemUserId) return NextResponse.json({ error: 'Anonymous import is unavailable.' }, { status: 500 })

    const { data, error } = await supabaseAdmin.rpc('convert_prompt_to_thread', {
      p_prompt_id: promptId,
      p_thread_id: threadId,
      p_creator_id: user.id,
      p_system_user_id: systemUserId,
    })

    if (error) {
      console.error('[PromptOpenFloor] Conversion failed:', error.message)
      const status = error.message.includes('already been opened') ? 409 : 422
      return NextResponse.json({ error: error.message }, { status })
    }

    return NextResponse.json({ success: true, imported: Number(data) || 0 })
  } catch (error) {
    console.error('[PromptOpenFloor] Unexpected failure:', error)
    return NextResponse.json({ error: 'Unable to open this prompt as a discussion.' }, { status: 500 })
  }
}
