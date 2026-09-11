import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/core/supabase/admin-client'
import { resolveUserFromRequest } from '@/lib/security/request-auth'
import { sanitizeUuid } from '@/lib/security/input-sanitization'

const EXPORT_LIMIT = { premium: 2, free: 1 } as const

// One export used per "Download carousel" click — checked and incremented here
// before the client generates images, so the limit holds even though rendering
// itself happens client-side via html-to-image.
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params
  const promptId = sanitizeUuid(id)
  if (!promptId) return NextResponse.json({ error: 'Invalid prompt ID.' }, { status: 400 })

  const user = await resolveUserFromRequest(request)
  if (!user) return NextResponse.json({ error: 'Sign in to export.' }, { status: 401 })

  const [{ data: prompt, error: promptError }, { data: profile }] = await Promise.all([
    supabaseAdmin
      .from('prompts')
      .select('id, creator_id, export_count')
      .eq('id', promptId)
      .is('deleted_at', null)
      .maybeSingle(),
    supabaseAdmin.from('users').select('is_premium').eq('id', user.id).maybeSingle(),
  ])

  if (promptError || !prompt || prompt.creator_id !== user.id) {
    return NextResponse.json({ error: 'Prompt not found.' }, { status: 404 })
  }

  const isPremium = profile?.is_premium === true
  const limit = isPremium ? EXPORT_LIMIT.premium : EXPORT_LIMIT.free

  if (prompt.export_count >= limit) {
    return NextResponse.json(
      {
        error: isPremium
          ? `You've used both exports for this ask.`
          : `You've used your export for this ask. Upgrade to Premium for a second export.`,
      },
      { status: 429 }
    )
  }

  const { data, error } = await supabaseAdmin
    .from('prompts')
    .update({ export_count: prompt.export_count + 1 })
    .eq('id', promptId)
    .eq('creator_id', user.id)
    .select('export_count')
    .single()

  if (error || !data) {
    console.error('[PromptExport] Failed to record export:', error?.message)
    return NextResponse.json({ error: 'Unable to start export.' }, { status: 500 })
  }

  return NextResponse.json({ exportCount: data.export_count, limit })
}
