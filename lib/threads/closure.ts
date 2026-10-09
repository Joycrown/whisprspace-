import { unstable_cache } from 'next/cache'
import { supabaseAdmin } from '@/lib/core/supabase/admin-client'

export interface ClosedDiscussionDetails {
  state: 'closed'
  title: string | null
  content: string | null
  category: string | null
  created_at: string
  closed_at: string | null
  participant_count: number
  perspective_count: number
  reaction_count: number
}

export type DiscussionClosure =
  | { state: 'live' }
  | { state: 'missing' | 'removed' | 'private' }
  | ClosedDiscussionDetails

const CLOSURE_REVALIDATE_SECONDS = 600

const loadClosure = (threadId: string, version: string) =>
  unstable_cache(
    async (): Promise<DiscussionClosure> => {
      const { data, error } = await supabaseAdmin.rpc('get_discussion_closure', { p_thread_id: threadId })
      if (error || !data) throw new Error(error?.message || 'Closure lookup returned nothing')
      return data as DiscussionClosure
    },
    ['discussion-closure', threadId, version],
    { revalidate: CLOSURE_REVALIDATE_SECONDS, tags: [`thread:${threadId}`] }
  )()

export async function getDiscussionClosure(threadId: string, version: string): Promise<DiscussionClosure> {
  try {
    return await loadClosure(threadId, version)
  } catch (error) {
    console.error('[Discussions] Closure lookup failed:', error instanceof Error ? error.message : error)
    return { state: 'missing' }
  }
}
