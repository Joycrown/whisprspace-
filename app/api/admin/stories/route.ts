import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/core/supabase/admin-client'
import { requireAdmin } from '@/lib/security/admin-auth'

const FILTERS = ['review', 'hidden', 'removed', 'consented', 'recent'] as const
type Filter = (typeof FILTERS)[number]

export async function GET(request: NextRequest) {
  const admin = await requireAdmin(request)
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const rawFilter = request.nextUrl.searchParams.get('filter')
  const filter: Filter = FILTERS.includes(rawFilter as Filter) ? (rawFilter as Filter) : 'review'

  let query = supabaseAdmin
    .from('stories')
    .select('id, title, category, family, excerpt, moderation_status, report_count, reply_count, follower_count, episode_count, is_sensitive, feature_consent, is_team, author_user_id, created_at, updated_at, deleted_at')
    .is('deleted_at', null)
    .order('updated_at', { ascending: false })
    .limit(50)

  if (filter === 'review') query = query.or('moderation_status.neq.visible,report_count.gt.0').neq('moderation_status', 'removed')
  if (filter === 'hidden') query = query.eq('moderation_status', 'hidden')
  if (filter === 'removed') query = query.eq('moderation_status', 'removed')
  if (filter === 'consented') query = query.eq('feature_consent', true).eq('moderation_status', 'visible')

  const { data, error } = await query
  if (error) return NextResponse.json({ error: 'Unable to load stories.' }, { status: 500 })

  const ids = (data ?? []).map((story) => story.id)
  const { data: reports } = ids.length
    ? await supabaseAdmin.from('story_reports').select('story_id, reason').in('story_id', ids)
    : { data: [] as Array<{ story_id: string; reason: string }> }

  const reasonsByStory = new Map<string, Record<string, number>>()
  for (const report of reports ?? []) {
    const counts = reasonsByStory.get(report.story_id) ?? {}
    counts[report.reason] = (counts[report.reason] ?? 0) + 1
    reasonsByStory.set(report.story_id, counts)
  }

  return NextResponse.json({
    stories: (data ?? []).map(({ author_user_id, ...story }) => ({
      ...story,
      has_account: Boolean(author_user_id),
      report_reasons: reasonsByStory.get(story.id) ?? {},
    })),
  })
}
