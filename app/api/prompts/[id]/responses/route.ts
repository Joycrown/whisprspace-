import { NextRequest, NextResponse } from 'next/server'
import { createHash, randomBytes } from 'crypto'
import { supabaseAdmin } from '@/lib/core/supabase/admin-client'
import { containsBlockedContent } from '@/lib/moderation/blocklist'
import { sanitizeMultilineInput, sanitizeUuid } from '@/lib/security/input-sanitization'

const SENDER_TOKEN_COOKIE = 'whs_sit'
const SENDER_TOKEN_TTL_DAYS = 90
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000
const RATE_LIMIT_MAX = 3

const hash = (value: string) => createHash('sha256').update(value).digest('hex')

function getClientIp(request: NextRequest): string {
  return (
    request.headers.get('cf-connecting-ip') ||
    request.headers.get('x-real-ip') ||
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    'unknown'
  )
}

async function isRateLimited(promptId: string, senderTokenHash: string, ipHash: string) {
  const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_MS).toISOString()
  const { count, error } = await supabaseAdmin
    .from('prompt_responses')
    .select('id', { count: 'exact', head: true })
    .eq('prompt_id', promptId)
    .gte('created_at', windowStart)
    .or(`sender_token_hash.eq.${senderTokenHash},ip_hash.eq.${ipHash}`)

  if (error) {
    console.error('[PromptResponse] Rate limit check failed:', error.message)
    return false
  }

  return (count ?? 0) >= RATE_LIMIT_MAX
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params
    const promptId = sanitizeUuid(id)
    if (!promptId) return NextResponse.json({ error: 'Invalid prompt.' }, { status: 400 })

    const body = await request.json().catch(() => null)
    const rawContent = (body as Record<string, unknown> | null)?.content
    if (typeof rawContent !== 'string' || rawContent.trim().length > 1000) {
      return NextResponse.json({ error: 'Your answer cannot exceed 1000 characters.' }, { status: 400 })
    }
    const content = sanitizeMultilineInput(rawContent, { maxLength: 1000 })
    if (!content) return NextResponse.json({ error: 'Your answer cannot be empty.' }, { status: 400 })

    const { data: prompt, error: promptError } = await supabaseAdmin
      .from('prompts')
      .select('id, mode, expires_at, deleted_at')
      .eq('id', promptId)
      .maybeSingle()

    if (promptError || !prompt || prompt.deleted_at) {
      return NextResponse.json({ error: 'This prompt is no longer available.' }, { status: 404 })
    }

    if (new Date(prompt.expires_at).getTime() <= Date.now()) {
      return NextResponse.json({ error: 'This prompt has closed.' }, { status: 410 })
    }

    // Open-mode unlock mechanics are intentionally not live yet.
    if (prompt.mode !== 'private') {
      return NextResponse.json({ error: 'This prompt is not accepting responses yet.' }, { status: 409 })
    }

    const existingToken = request.cookies.get(SENDER_TOKEN_COOKIE)?.value
    const senderToken = existingToken || randomBytes(32).toString('hex')
    const senderTokenHash = hash(senderToken)
    const ipHash = hash(getClientIp(request))

    if (await isRateLimited(promptId, senderTokenHash, ipHash)) {
      return NextResponse.json({ error: 'Too many answers. Please try again in an hour.' }, { status: 429 })
    }

    const blocked = containsBlockedContent(content).blocked
    const { error: insertError } = await supabaseAdmin.from('prompt_responses').insert({
      prompt_id: promptId,
      content,
      moderation_status: blocked ? 'blocked' : 'passed',
      sender_token_hash: senderTokenHash,
      ip_hash: ipHash,
    })

    if (insertError) {
      console.error('[PromptResponse] Insert failed:', insertError.message)
      return NextResponse.json({ error: 'Unable to send your answer.' }, { status: 500 })
    }

    // A neutral success response prevents the filter from becoming an oracle.
    const response = NextResponse.json({ success: true })
    const expiry = new Date()
    expiry.setDate(expiry.getDate() + SENDER_TOKEN_TTL_DAYS)
    response.cookies.set(SENDER_TOKEN_COOKIE, senderToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      expires: expiry,
      path: '/',
    })
    return response
  } catch (error) {
    console.error('[PromptResponse] Unexpected failure:', error)
    return NextResponse.json({ error: 'Unable to send your answer.' }, { status: 500 })
  }
}
