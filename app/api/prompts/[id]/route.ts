import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/core/supabase/admin-client'
import { resolveUserFromRequest } from '@/lib/security/request-auth'
import { sanitizeUuid } from '@/lib/security/input-sanitization'

async function resolvePromptOwner(request: NextRequest, promptId: string) {
  const user = await resolveUserFromRequest(request)
  if (!user) return null

  const { data: prompt, error } = await supabaseAdmin
    .from('prompts')
    .select('id, creator_id, question, mode, category, library_key, response_count, expires_at, is_saved, created_at')
    .eq('id', promptId)
    .is('deleted_at', null)
    .maybeSingle()

  if (error || !prompt || prompt.creator_id !== user.id) return null
  return { user, prompt }
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params
  const promptId = sanitizeUuid(id)
  if (!promptId) return NextResponse.json({ error: 'Invalid prompt ID.' }, { status: 400 })

  const owner = await resolvePromptOwner(request, promptId)
  if (!owner) return NextResponse.json({ error: 'Prompt not found.' }, { status: 404 })

  const [{ data: responses, error: responseError }, { data: profile }] = await Promise.all([
    supabaseAdmin
      .from('prompt_responses')
      .select('id, prompt_id, content, is_starred, starred_at, created_at')
      .eq('prompt_id', promptId)
      .eq('moderation_status', 'passed')
      .order('is_starred', { ascending: false })
      .order('starred_at', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: true }),
    supabaseAdmin.from('users').select('is_premium').eq('id', owner.user.id).maybeSingle(),
  ])

  if (responseError) {
    console.error('[Prompts] Failed to load responses:', responseError.message)
    return NextResponse.json({ error: 'Unable to load prompt responses.' }, { status: 500 })
  }

  return NextResponse.json({
    prompt: { ...owner.prompt, responses: responses ?? [], is_premium: profile?.is_premium === true },
  })
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params
  const promptId = sanitizeUuid(id)
  if (!promptId) return NextResponse.json({ error: 'Invalid prompt ID.' }, { status: 400 })

  const owner = await resolvePromptOwner(request, promptId)
  if (!owner) return NextResponse.json({ error: 'Prompt not found.' }, { status: 404 })

  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object' || (body as Record<string, unknown>).saved !== true) {
    return NextResponse.json({ error: 'Invalid save request.' }, { status: 400 })
  }

  if (owner.prompt.is_saved) {
    return NextResponse.json({ error: 'This ask is already saved.' }, { status: 409 })
  }

  const { data: profile } = await supabaseAdmin
    .from('users')
    .select('is_premium')
    .eq('id', owner.user.id)
    .maybeSingle()

  if (!profile?.is_premium) {
    return NextResponse.json({ error: 'Saving asks is a Premium feature.' }, { status: 403 })
  }

  const { data, error } = await supabaseAdmin
    .from('prompts')
    .update({ is_saved: true })
    .eq('id', promptId)
    .eq('creator_id', owner.user.id)
    .select('id, is_saved')
    .single()

  if (error || !data) {
    console.error('[Prompts] Failed to save prompt:', error?.message)
    return NextResponse.json({ error: 'Unable to save this ask.' }, { status: 500 })
  }

  return NextResponse.json({ prompt: data })
}
