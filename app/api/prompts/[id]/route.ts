import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/core/supabase/admin-client'
import { resolveUserFromRequest } from '@/lib/security/request-auth'
import { sanitizeUuid } from '@/lib/security/input-sanitization'

async function resolvePromptOwner(request: NextRequest, promptId: string) {
  const user = await resolveUserFromRequest(request)
  if (!user) return null

  const { data: prompt, error } = await supabaseAdmin
    .from('prompts')
    .select('id, creator_id, question, mode, category, library_key, response_count, expires_at, is_saved, export_count, response_format, options, correct_option_index, created_at')
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
  if (!promptId) return NextResponse.json({ error: 'Invalid ask ID.' }, { status: 400 })

  const owner = await resolvePromptOwner(request, promptId)
  if (!owner) return NextResponse.json({ error: 'Ask not found.' }, { status: 404 })

  const [{ data: responses, error: responseError }, { data: profile }] = await Promise.all([
    supabaseAdmin
      .from('prompt_responses')
      .select('id, prompt_id, content, is_starred, starred_at, option_index, created_at')
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
  if (!promptId) return NextResponse.json({ error: 'Invalid ask ID.' }, { status: 400 })

  const owner = await resolvePromptOwner(request, promptId)
  if (!owner) return NextResponse.json({ error: 'Ask not found.' }, { status: 404 })

  const body = await request.json().catch(() => null)
  const raw = (body as Record<string, unknown> | null) ?? {}

  if (raw.correctOptionIndex !== undefined) {
    return updateCorrectOption(owner, promptId, raw.correctOptionIndex)
  }

  if (raw.saved !== true) {
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

async function updateCorrectOption(
  owner: NonNullable<Awaited<ReturnType<typeof resolvePromptOwner>>>,
  promptId: string,
  rawIndex: unknown
) {
  const { prompt } = owner

  if (prompt.response_format !== 'choice' || !Array.isArray(prompt.options)) {
    return NextResponse.json({ error: 'This ask has no options to mark.' }, { status: 400 })
  }

  if (new Date(prompt.expires_at).getTime() <= Date.now()) {
    return NextResponse.json({ error: 'This ask has already closed.' }, { status: 409 })
  }

  const options = prompt.options as string[]
  const correctOptionIndex = Number(rawIndex)
  if (!Number.isInteger(correctOptionIndex) || correctOptionIndex < 0 || correctOptionIndex >= options.length) {
    return NextResponse.json({ error: 'Choose one of the existing options.' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('prompts')
    .update({ correct_option_index: correctOptionIndex })
    .eq('id', promptId)
    .eq('creator_id', owner.user.id)
    .select('id, correct_option_index')
    .single()

  if (error || !data) {
    console.error('[Prompts] Failed to update correct option:', error?.message)
    return NextResponse.json({ error: 'Unable to update the true answer.' }, { status: 500 })
  }

  return NextResponse.json({ prompt: data })
}
