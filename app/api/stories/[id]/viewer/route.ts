import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/core/supabase/admin-client'
import { resolveUserFromRequest } from '@/lib/security/request-auth'
import { sanitizeUuid } from '@/lib/security/input-sanitization'
import { isStoryReaction, type ReactionCounts, type StoryViewerState } from '@/lib/stories/types'

const EMPTY: StoryViewerState = { isAuthor: false, isFollowing: false, canParticipate: false, featureConsent: null }

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params
  const storyId = sanitizeUuid(id)
  if (!storyId) return NextResponse.json({ error: 'Invalid story.' }, { status: 400 })

  const user = await resolveUserFromRequest(request)
  if (!user) return NextResponse.json(EMPTY)

  const [{ data: profile }, { data: story }, { data: follow }, { data: reaction }] = await Promise.all([
    supabaseAdmin.from('users').select('is_anonymous').eq('id', user.id).maybeSingle(),
    supabaseAdmin.from('stories').select('author_user_id, feature_consent, reaction_counts').eq('id', storyId).maybeSingle(),
    supabaseAdmin.from('story_follows').select('story_id').eq('story_id', storyId).eq('user_id', user.id).maybeSingle(),
    supabaseAdmin.from('story_reactions').select('reaction_type').eq('story_id', storyId).eq('user_id', user.id).maybeSingle(),
  ])

  const isAuthor = Boolean(story && story.author_user_id === user.id)
  const state: StoryViewerState = {
    isAuthor,
    isFollowing: Boolean(follow),
    canParticipate: Boolean(profile && !profile.is_anonymous),
    featureConsent: isAuthor ? Boolean(story?.feature_consent) : null,
    myReaction: isStoryReaction(reaction?.reaction_type) ? reaction.reaction_type : null,
    reactionCounts: (story?.reaction_counts as ReactionCounts | undefined) ?? {},
  }
  return NextResponse.json(state)
}
