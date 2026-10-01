import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/core/supabase/admin-client'
import { readSenderToken, sha256 } from '@/lib/security/anon-sender'
import { resolveUserFromRequest } from '@/lib/security/request-auth'
import { decodeReplyCursor, encodeReplyCursor } from '@/lib/stories/cursor'
import { resolveRegisteredUser } from '@/lib/stories/server'
import type { MyStoriesPage, MyStoryItem } from '@/lib/stories/types'

const PAGE_SIZE = 20
const UNSAVED_LIMIT = 20
const COLUMNS =
  'id, title, category, family, excerpt, is_episodic, status, is_sensitive, moderation_status, episode_count, reply_count, follower_count, reaction_counts, last_episode_at, created_at'
const ISO_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,6})?(Z|[+-]\d{2}:\d{2})$/

export async function GET(request: NextRequest) {
  const user = await resolveUserFromRequest(request)
  const profile = user ? await resolveRegisteredUser(user.id) : null
  if (!profile || profile.is_anonymous) {
    return NextResponse.json({ error: 'Sign in to see your stories.', code: 'account_required' }, { status: 401 })
  }

  const rawCursor = request.nextUrl.searchParams.get('cursor')
  const cursor = decodeReplyCursor(rawCursor)
  if (rawCursor && (!cursor || !ISO_TIMESTAMP.test(cursor.ts))) {
    return NextResponse.json({ error: 'Invalid cursor.' }, { status: 400 })
  }

  let query = supabaseAdmin
    .from('stories')
    .select(COLUMNS)
    .eq('author_user_id', profile.id)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(PAGE_SIZE + 1)

  if (cursor) {
    query = query.or(`created_at.lt."${cursor.ts}",and(created_at.eq."${cursor.ts}",id.lt.${cursor.id})`)
  }

  const token = cursor ? null : readSenderToken(request)
  const [owned, unsaved] = await Promise.all([
    query,
    token
      ? supabaseAdmin
          .from('stories')
          .select(COLUMNS)
          .eq('sender_token_hash', sha256(token))
          .is('author_user_id', null)
          .is('deleted_at', null)
          .order('created_at', { ascending: false })
          .limit(UNSAVED_LIMIT)
      : Promise.resolve({ data: [], error: null }),
  ])

  if (owned.error || unsaved.error) {
    console.error('[Stories] My stories query failed:', owned.error?.message ?? unsaved.error?.message)
    return NextResponse.json({ error: 'Unable to load your stories.' }, { status: 500 })
  }

  const rows = (owned.data ?? []) as MyStoryItem[]
  const items = rows.slice(0, PAGE_SIZE)
  const last = items[items.length - 1]
  const page: MyStoriesPage = {
    items,
    nextCursor: rows.length > PAGE_SIZE && last ? encodeReplyCursor(last) : null,
    unsaved: (unsaved.data ?? []) as MyStoryItem[],
  }
  return NextResponse.json(page)
}
