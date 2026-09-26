import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/core/supabase/admin-client'
import { resolveUserFromRequest } from '@/lib/security/request-auth'
import { resolveSenderIdentity, setSenderTokenCookie } from '@/lib/security/anon-sender'
import { sanitizeUuid } from '@/lib/security/input-sanitization'
import { revalidateStory } from '@/lib/stories/server'
import { STORY_REPORT_REASONS, type StoryReportReason } from '@/lib/stories/types'

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params
    const storyId = sanitizeUuid(id)
    if (!storyId) return NextResponse.json({ error: 'Invalid story.' }, { status: 400 })

    const raw = ((await request.json().catch(() => null)) ?? {}) as Record<string, unknown>
    const reason = STORY_REPORT_REASONS.find((option) => option.value === raw.reason)?.value as StoryReportReason | undefined
    if (!reason) return NextResponse.json({ error: 'Choose a reason.' }, { status: 400 })

    const user = await resolveUserFromRequest(request)
    const identity = resolveSenderIdentity(request)
    const reporterKey = user ? `user:${user.id}` : `token:${identity.tokenHash}`

    const { error } = await supabaseAdmin
      .from('story_reports')
      .insert({ story_id: storyId, reporter_key: reporterKey, reason })

    if (error && error.code !== '23505') {
      if (error.code === '23503') return NextResponse.json({ error: 'Story not found.' }, { status: 404 })
      console.error('[Stories] Report failed:', error.message)
      return NextResponse.json({ error: 'Unable to send your report.' }, { status: 500 })
    }

    if (!error) {
      const { data: story } = await supabaseAdmin.from('stories').select('moderation_status').eq('id', storyId).maybeSingle()
      if (story?.moderation_status === 'hidden') revalidateStory(storyId)
    }

    const response = NextResponse.json({ success: true })
    if (!user && identity.isNew) setSenderTokenCookie(response, identity.token)
    return response
  } catch (error) {
    console.error('[Stories] Unexpected report failure:', error)
    return NextResponse.json({ error: 'Unable to send your report.' }, { status: 500 })
  }
}
