import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/core/supabase/admin-client'
import { resolveUserFromRequest } from '@/lib/security/request-auth'
import { resolveSenderIdentity, setSenderTokenCookie } from '@/lib/security/anon-sender'
import { sanitizeEnumValue, sanitizeMultilineInput, sanitizeSingleLineInput } from '@/lib/security/input-sanitization'
import { getSeriesLimitState, resolveRegisteredUser, revalidateStory, seriesLimitReached, SERIES_LIMIT_MESSAGE } from '@/lib/stories/server'
import { buildStoryPath } from '@/lib/stories/story-url'
import { resolveIsEpisodic, STORY_CATEGORIES, STORY_LIMITS, storyRequiresAccount, type StoryCategory } from '@/lib/stories/types'

export async function POST(request: NextRequest) {
  try {
    const raw = ((await request.json().catch(() => null)) ?? {}) as Record<string, unknown>

    if (!STORY_CATEGORIES.includes(raw.category as StoryCategory)) {
      return NextResponse.json({ error: 'Choose a category for your story.' }, { status: 400 })
    }
    const category = sanitizeEnumValue(raw.category, STORY_CATEGORIES, 'regret') as StoryCategory
    const isEpisodic = resolveIsEpisodic(category, raw.isEpisodic === true)
    const title = sanitizeSingleLineInput(raw.title, { maxLength: STORY_LIMITS.titleMax + 1 })
    const body = sanitizeMultilineInput(raw.body, { maxLength: STORY_LIMITS.bodyMax + 1 })
    const cadence = isEpisodic ? sanitizeSingleLineInput(raw.cadence, { maxLength: STORY_LIMITS.cadenceMax }) : ''

    if (title.length < STORY_LIMITS.titleMin || title.length > STORY_LIMITS.titleMax) {
      return NextResponse.json({ error: `Give your story a title between ${STORY_LIMITS.titleMin} and ${STORY_LIMITS.titleMax} characters.` }, { status: 400 })
    }
    if (body.length < STORY_LIMITS.bodyMin || body.length > STORY_LIMITS.bodyMax) {
      return NextResponse.json({ error: `Your story needs between ${STORY_LIMITS.bodyMin} and ${STORY_LIMITS.bodyMax.toLocaleString()} characters.` }, { status: 400 })
    }

    const user = await resolveUserFromRequest(request)
    const profile = user ? await resolveRegisteredUser(user.id) : null
    const registeredId = profile && !profile.is_anonymous ? profile.id : null

    if (storyRequiresAccount(category, isEpisodic) && !registeredId) {
      return NextResponse.json({ error: 'Create an account to tell a story you can come back to.', code: 'account_required' }, { status: 401 })
    }

    if (isEpisodic && registeredId) {
      const limitState = await getSeriesLimitState(registeredId, Boolean(profile?.is_premium))
      if (seriesLimitReached(limitState)) {
        return NextResponse.json({ error: SERIES_LIMIT_MESSAGE, code: 'series_limit', limit: limitState }, { status: 403 })
      }
    }

    if (raw.validateOnly === true) {
      return NextResponse.json({ ok: true })
    }

    const identity = resolveSenderIdentity(request)
    const { data, error } = await supabaseAdmin.rpc('create_story', {
      p_title: title,
      p_category: category,
      p_body: body,
      p_is_episodic: isEpisodic,
      p_cadence_label: cadence || null,
      p_is_sensitive: false,
      p_feature_consent: raw.featureConsent === true,
      p_author_user_id: registeredId,
      p_sender_token_hash: identity.tokenHash,
      p_ip_hash: identity.ipHash,
    })

    const created = Array.isArray(data) ? data[0] : data
    if (error || !created?.story_id) {
      console.error('[Stories] Create failed:', error?.message)
      return NextResponse.json({ error: 'Unable to share your story right now.' }, { status: 500 })
    }

    revalidateStory(created.story_id)

    const response = NextResponse.json(
      { story: { id: created.story_id, title, category, path: buildStoryPath({ id: created.story_id, title }), hasAccount: Boolean(registeredId) } },
      { status: 201 }
    )
    setSenderTokenCookie(response, identity.token)
    return response
  } catch (error) {
    console.error('[Stories] Unexpected create failure:', error)
    return NextResponse.json({ error: 'Unable to share your story right now.' }, { status: 500 })
  }
}
