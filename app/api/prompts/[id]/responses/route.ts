import { NextRequest, NextResponse } from 'next/server'
import { createHash, randomBytes } from 'crypto'
import { supabaseAdmin } from '@/lib/core/supabase/admin-client'
import { containsBlockedContent } from '@/lib/moderation/blocklist'
import { revalidatePublicAsk } from '@/lib/prompts/public'
import { sanitizeMultilineInput, sanitizeUuid } from '@/lib/security/input-sanitization'

const SENDER_TOKEN_COOKIE = 'whs_sit'
const SENDER_TOKEN_TTL_DAYS = 90
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000
const RATE_LIMIT_MAX = 3
const IP_RATE_LIMIT_MAX = 20

const hash = (value: string) => createHash('sha256').update(value).digest('hex')

function getClientIp(request: NextRequest): string {
  return (
    request.headers.get('cf-connecting-ip') ||
    request.headers.get('x-real-ip') ||
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    'unknown'
  )
}

async function isRateLimited(promptId: string, senderTokenHash: string, ipHash: string, ipKnown: boolean) {
  const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_MS).toISOString()
  const [perAsk, perIp] = await Promise.all([
    supabaseAdmin
      .from('prompt_responses')
      .select('id', { count: 'exact', head: true })
      .eq('prompt_id', promptId)
      .gte('created_at', windowStart)
      .or(`sender_token_hash.eq.${senderTokenHash},ip_hash.eq.${ipHash}`),
    ipKnown
      ? supabaseAdmin
          .from('prompt_responses')
          .select('id', { count: 'exact', head: true })
          .eq('ip_hash', ipHash)
          .gte('created_at', windowStart)
      : Promise.resolve({ count: 0, error: null }),
  ])

  if (perAsk.error || perIp.error) {
    console.error('[PromptResponse] Rate limit check failed:', perAsk.error?.message || perIp.error?.message)
    return false
  }

  return (perAsk.count ?? 0) >= RATE_LIMIT_MAX || (perIp.count ?? 0) >= IP_RATE_LIMIT_MAX
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params
    const promptId = sanitizeUuid(id)
    if (!promptId) return NextResponse.json({ error: 'Invalid ask.' }, { status: 400 })

    const body = await request.json().catch(() => null)
    const raw = (body as Record<string, unknown> | null) ?? {}

    const { data: prompt, error: promptError } = await supabaseAdmin
      .from('prompts')
      .select('id, mode, expires_at, deleted_at, response_format, options')
      .eq('id', promptId)
      .maybeSingle()

    if (promptError || !prompt || prompt.deleted_at) {
      return NextResponse.json({ error: 'This ask is no longer available.' }, { status: 404 })
    }

    if (prompt.expires_at && new Date(prompt.expires_at).getTime() <= Date.now()) {
      return NextResponse.json({ error: 'This ask has closed.' }, { status: 410 })
    }

    let content: string | null = null
    let optionIndex: number | null = null

    if (prompt.response_format === 'choice') {
      const options = Array.isArray(prompt.options) ? (prompt.options as string[]) : []
      const rawIndex = Number((raw as Record<string, unknown>).optionIndex)
      if (!Number.isInteger(rawIndex) || rawIndex < 0 || rawIndex >= options.length) {
        return NextResponse.json({ error: 'Choose one of the options.' }, { status: 400 })
      }
      optionIndex = rawIndex

      const rawComment = raw.content
      if (typeof rawComment === 'string' && rawComment.trim()) {
        if (rawComment.trim().length > 1000) {
          return NextResponse.json({ error: 'Your comment cannot exceed 1000 characters.' }, { status: 400 })
        }
        content = sanitizeMultilineInput(rawComment, { maxLength: 1000 })
      }
    } else {
      const rawContent = raw.content
      if (typeof rawContent !== 'string' || rawContent.trim().length > 1000) {
        return NextResponse.json({ error: 'Your answer cannot exceed 1000 characters.' }, { status: 400 })
      }
      content = sanitizeMultilineInput(rawContent, { maxLength: 1000 })
      if (!content) return NextResponse.json({ error: 'Your answer cannot be empty.' }, { status: 400 })
    }

    const existingToken = request.cookies.get(SENDER_TOKEN_COOKIE)?.value
    const senderToken = existingToken || randomBytes(32).toString('hex')
    const senderTokenHash = hash(senderToken)
    const clientIp = getClientIp(request)
    const ipHash = hash(clientIp)

    if (await isRateLimited(promptId, senderTokenHash, ipHash, clientIp !== 'unknown')) {
      return NextResponse.json({ error: 'Too many answers. Please try again in an hour.' }, { status: 429 })
    }

    const blocked = content ? containsBlockedContent(content).blocked : false
    const { error: insertError } = await supabaseAdmin.from('prompt_responses').insert({
      prompt_id: promptId,
      content,
      option_index: optionIndex,
      moderation_status: blocked ? 'blocked' : 'passed',
      sender_token_hash: senderTokenHash,
      ip_hash: ipHash,
    })

    if (insertError) {
      console.error('[PromptResponse] Insert failed:', insertError.message)
      return NextResponse.json({ error: 'Unable to send your answer.' }, { status: 500 })
    }

    if (prompt.mode === 'open' && !blocked) {
      revalidatePublicAsk(promptId)
    }

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
