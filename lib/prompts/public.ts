import { revalidateTag, unstable_cache } from 'next/cache'
import { supabaseAdmin } from '@/lib/core/supabase/admin-client'
import { encodeAskCursor, type AskCursor } from './cursor'
import type { AskReaction, AskSort, AskViewerState, PublicAsk, PublicAskResponse, PublicAskResponsesPage } from './public-types'

export const PUBLIC_RESPONSES_PAGE_SIZE = 30
export const PUBLIC_ASK_REVALIDATE_SECONDS = 60
export const PUBLIC_RESPONSES_REVALIDATE_SECONDS = 30

export const askTag = (id: string) => `ask:${id}`
export const askResponsesTag = (id: string) => `ask-responses:${id}`

export function getPublicAsk(id: string): Promise<PublicAsk | null> {
  return unstable_cache(
    async () => {
      const { data, error } = await supabaseAdmin.rpc('get_public_ask', { p_prompt_id: id })
      if (error) throw new Error(error.message)
      return (data as PublicAsk | null) ?? null
    },
    ['public-ask', id],
    { revalidate: PUBLIC_ASK_REVALIDATE_SECONDS, tags: [askTag(id)] }
  )()
}

export function getPublicAskResponses(id: string, sort: AskSort, cursor: AskCursor | null): Promise<PublicAskResponsesPage> {
  return unstable_cache(
    async () => {
      const { data, error } = await supabaseAdmin.rpc('get_public_ask_responses', {
        p_prompt_id: id,
        p_sort: sort,
        p_before_ts: cursor?.ts ?? null,
        p_before_total: cursor?.total ?? null,
        p_before_id: cursor?.id ?? null,
        p_limit: PUBLIC_RESPONSES_PAGE_SIZE + 1,
      })
      if (error) throw new Error(error.message)
      const rows = (data ?? []) as PublicAskResponse[]
      const items = rows.slice(0, PUBLIC_RESPONSES_PAGE_SIZE)
      const last = items[items.length - 1]
      return {
        items,
        nextCursor: rows.length > PUBLIC_RESPONSES_PAGE_SIZE && last ? encodeAskCursor(sort, last) : null,
      }
    },
    ['public-ask-responses', id, sort, cursor?.id ?? 'head'],
    { revalidate: PUBLIC_RESPONSES_REVALIDATE_SECONDS, tags: [askResponsesTag(id)] }
  )()
}

export async function getAskViewerState(id: string, tokenHash: string): Promise<AskViewerState> {
  const { data, error } = await supabaseAdmin.rpc('get_ask_viewer_state', { p_prompt_id: id, p_token_hash: tokenHash })
  if (error) throw new Error(error.message)
  const raw = (data ?? {}) as { own_response_ids?: string[]; reactions?: Array<{ response_id: string; reaction: AskReaction }> }
  const reactions: Record<string, AskReaction[]> = {}
  for (const row of raw.reactions ?? []) {
    reactions[row.response_id] = [...(reactions[row.response_id] ?? []), row.reaction]
  }
  const ownResponseIds = raw.own_response_ids ?? []
  return { answered: ownResponseIds.length > 0, ownResponseIds, reactions }
}

export function revalidatePublicAsk(id: string) {
  revalidateTag(askTag(id))
  revalidateTag(askResponsesTag(id))
}

export const isAskClosed = (ask: { expires_at: string | null }) =>
  ask.expires_at !== null && new Date(ask.expires_at).getTime() <= Date.now()
