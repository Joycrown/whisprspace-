import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/core/supabase/admin-client'
import { resolveUserFromRequest } from '@/lib/security/request-auth'
import { sanitizeUuid } from '@/lib/security/input-sanitization'

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string; responseId: string }> }
) {
  const { id, responseId } = await context.params
  const promptId = sanitizeUuid(id)
  const safeResponseId = sanitizeUuid(responseId)
  if (!promptId || !safeResponseId) return NextResponse.json({ error: 'Invalid response.' }, { status: 400 })

  const user = await resolveUserFromRequest(request)
  if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })

  const { data: prompt } = await supabaseAdmin
    .from('prompts')
    .select('id')
    .eq('id', promptId)
    .eq('creator_id', user.id)
    .is('deleted_at', null)
    .maybeSingle()
  if (!prompt) return NextResponse.json({ error: 'Prompt not found.' }, { status: 404 })

  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object' || typeof (body as Record<string, unknown>).isStarred !== 'boolean') {
    return NextResponse.json({ error: 'Invalid highlight request.' }, { status: 400 })
  }
  const isStarred = (body as Record<string, boolean>).isStarred

  const { data: response, error } = await supabaseAdmin
    .from('prompt_responses')
    .update({ is_starred: isStarred, starred_at: isStarred ? new Date().toISOString() : null })
    .eq('id', safeResponseId)
    .eq('prompt_id', promptId)
    .eq('moderation_status', 'passed')
    .select('id, prompt_id, content, is_starred, starred_at, created_at')
    .maybeSingle()

  if (error || !response) {
    if (error) console.error('[PromptResponse] Highlight failed:', error.message)
    return NextResponse.json({ error: 'Response not found.' }, { status: 404 })
  }

  return NextResponse.json({ response })
}
