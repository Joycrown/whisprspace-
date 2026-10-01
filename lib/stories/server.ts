import { revalidateTag, unstable_cache } from 'next/cache'
import { supabaseAdmin } from '@/lib/core/supabase/admin-client'
import { decodeFeedCursor, encodeFeedCursor, encodeReplyCursor, type ReplyCursor } from './cursor'
import type {
  StoryCategory,
  StoryFamily,
  StoryFeedItem,
  StoryFeedPage,
  StoryPageData,
  StoryRepliesPage,
  StoryReply,
  StorySort,
  SeriesLimitState,
} from './types'
import { FREE_ONGOING_SERIES_LIMIT } from './types'

export const FEED_PAGE_SIZE = 20
export const REPLIES_PAGE_SIZE = 30
export const FEED_REVALIDATE_SECONDS = 60
export const STORY_REVALIDATE_SECONDS = 600
export const REPLIES_REVALIDATE_SECONDS = 30

export const STORIES_FEED_TAG = 'stories-feed'
export const storyTag = (id: string) => `story:${id}`
export const storyRepliesTag = (id: string) => `story-replies:${id}`

export interface FeedQuery {
  family: StoryFamily | null
  category: StoryCategory | null
  sort: StorySort
  cursor: string | null
}

async function queryFeed({ family, category, sort, cursor }: FeedQuery): Promise<StoryFeedPage> {
  const decoded = decodeFeedCursor(sort, cursor)
  const { data, error } = await supabaseAdmin.rpc('get_story_feed', {
    p_family: family,
    p_category: category,
    p_sort: sort,
    p_cursor_ts: decoded?.ts ?? null,
    p_cursor_count: decoded?.count ?? null,
    p_cursor_id: decoded?.id ?? null,
    p_limit: FEED_PAGE_SIZE + 1,
  })

  if (error) {
    console.error('[Stories] Feed query failed:', error.message)
    throw new Error('Unable to load stories')
  }

  const rows = (data ?? []) as StoryFeedItem[]
  const items = rows.slice(0, FEED_PAGE_SIZE)
  const last = items[items.length - 1]
  return {
    items,
    nextCursor: rows.length > FEED_PAGE_SIZE && last ? encodeFeedCursor(sort, last) : null,
  }
}

export const getStoryFeedPage = unstable_cache(queryFeed, ['stories-feed-page'], {
  revalidate: FEED_REVALIDATE_SECONDS,
  tags: [STORIES_FEED_TAG],
})

export function getLatestStories(): Promise<StoryFeedPage> {
  return getStoryFeedPage({ family: null, category: null, sort: 'fresh', cursor: null })
}

export async function getStoryPage(id: string): Promise<StoryPageData | null> {
  return unstable_cache(
    async () => {
      const { data, error } = await supabaseAdmin.rpc('get_story_page', { p_story_id: id })
      if (error) {
        console.error('[Stories] Story query failed:', error.message)
        throw new Error('Unable to load story')
      }
      return (data as StoryPageData | null) ?? null
    },
    ['story-page', id],
    { revalidate: STORY_REVALIDATE_SECONDS, tags: [storyTag(id)] }
  )()
}

export async function getStoryReplies(id: string, cursor: ReplyCursor | null): Promise<StoryRepliesPage> {
  return unstable_cache(
    async () => {
      const { data, error } = await supabaseAdmin.rpc('get_story_replies', {
        p_story_id: id,
        p_before_ts: cursor?.ts ?? null,
        p_before_id: cursor?.id ?? null,
        p_limit: REPLIES_PAGE_SIZE + 1,
      })
      if (error) {
        console.error('[Stories] Replies query failed:', error.message)
        throw new Error('Unable to load replies')
      }
      const rows = (data ?? []) as StoryReply[]
      const items = rows.slice(0, REPLIES_PAGE_SIZE)
      const last = items[items.length - 1]
      return {
        items,
        nextCursor: rows.length > REPLIES_PAGE_SIZE && last ? encodeReplyCursor(last) : null,
      }
    },
    ['story-replies', id, cursor?.id ?? 'head'],
    { revalidate: REPLIES_REVALIDATE_SECONDS, tags: [storyRepliesTag(id)] }
  )()
}

export function revalidateStory(id: string, options: { feed?: boolean } = {}) {
  revalidateTag(storyTag(id))
  if (options.feed !== false) revalidateTag(STORIES_FEED_TAG)
}

export function revalidateStoryReplies(id: string) {
  revalidateTag(storyRepliesTag(id))
}

export async function loadOwnedStory(storyId: string, userId: string) {
  const { data } = await supabaseAdmin
    .from('stories')
    .select('id, title, category, is_episodic, status, is_sensitive, feature_consent, cadence_label, moderation_status, author_user_id, deleted_at, episode_count, thread_id')
    .eq('id', storyId)
    .maybeSingle()

  if (!data || data.deleted_at || data.author_user_id !== userId) return null
  return data
}

export async function resolveRegisteredUser(userId: string) {
  const { data } = await supabaseAdmin
    .from('users')
    .select('id, is_anonymous, is_premium, is_admin')
    .eq('id', userId)
    .maybeSingle()
  return data
}

export async function getSeriesLimitState(userId: string, isPremium: boolean): Promise<SeriesLimitState> {
  const { data } = await supabaseAdmin
    .from('stories')
    .select('id, title')
    .eq('author_user_id', userId)
    .eq('is_episodic', true)
    .eq('status', 'ongoing')
    .neq('moderation_status', 'removed')
    .is('deleted_at', null)
    .order('last_episode_at', { ascending: false })
    .limit(20)

  return {
    isPremium,
    limit: isPremium ? null : FREE_ONGOING_SERIES_LIMIT,
    ongoing: (data ?? []) as Array<{ id: string; title: string }>,
  }
}

export function seriesLimitReached(state: SeriesLimitState, excludeStoryId?: string): boolean {
  if (state.limit === null) return false
  const count = state.ongoing.filter((story) => story.id !== excludeStoryId).length
  return count >= state.limit
}

export const SERIES_LIMIT_MESSAGE = `Free accounts can have ${FREE_ONGOING_SERIES_LIMIT} ongoing stories at a time. Mark one as finished, or go Premium for unlimited.`
