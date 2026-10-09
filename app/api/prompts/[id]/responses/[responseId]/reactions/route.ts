import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/core/supabase/admin-client'
import { getSenderTokenHash } from '@/lib/prompts/sender'
import { ASK_REACTIONS, type AskReaction, type AskReactionResult } from '@/lib/prompts/public-types'
import { sanitizeUuid } from '@/lib/security/input-sanitization'

const NO_STORE = { 'Cache-Control': 'private, no-store' }

const REACTION_ERRORS: Record<string, { status: number; error: string }> = {
  answer_first: { status: 403, error: 'Answer the question first to react.' },
  own_answer: { status: 400, error: 'You can’t react to your own answer.' },
  invalid_reaction: { status: 400, error: 'That reaction isn’t available.' },
  not_found: { status: 404, error: 'This answer is no longer available.' },
  rate_limited: { status: 429, error: 'You’re reacting too fast. Try again later.' },
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string; responseId: string }> }
) {
  const { responseId } = await context.params
  const answerId = sanitizeUuid(responseId)
  if (!answerId) return NextResponse.json({ error: 'Invalid answer.' }, { status: 400, headers: NO_STORE })

  const body = (await request.json().catch(() => null)) as { reaction?: unknown } | null
  const reaction = body?.reaction
  if (typeof reaction !== 'string' || !(ASK_REACTIONS as readonly string[]).includes(reaction)) {
    return NextResponse.json(REACTION_ERRORS.invalid_reaction, { status: 400, headers: NO_STORE })
  }

  const tokenHash = getSenderTokenHash(request)
  if (!tokenHash) {
    return NextResponse.json({ error: REACTION_ERRORS.answer_first.error }, { status: 403, headers: NO_STORE })
  }

  const { data, error } = await supabaseAdmin.rpc('toggle_ask_reaction', {
    p_response_id: answerId,
    p_reaction: reaction as AskReaction,
    p_reactor_hash: tokenHash,
  })

  if (error) {
    const known = REACTION_ERRORS[error.message]
    if (known) return NextResponse.json({ error: known.error }, { status: known.status, headers: NO_STORE })
    console.error('[AskReaction] Toggle failed:', error.message)
    return NextResponse.json({ error: 'Unable to react right now.' }, { status: 500, headers: NO_STORE })
  }

  return NextResponse.json(data as AskReactionResult, { headers: NO_STORE })
}
