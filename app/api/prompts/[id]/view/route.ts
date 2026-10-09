import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { supabaseAdmin } from '@/lib/core/supabase/admin-client'
import { VIEWER_TOKEN_COOKIE, getClientIp, hashValue } from '@/lib/prompts/sender'
import { sanitizeUuid } from '@/lib/security/input-sanitization'

const VIEWER_TOKEN_TTL_DAYS = 365
const BOT_PATTERN = /bot|crawl|spider|slurp|preview|facebookexternalhit|whatsapp|telegram|discord|headless|lighthouse/i
const NO_STORE = { 'Cache-Control': 'private, no-store' }

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params
  const askId = sanitizeUuid(id)
  if (!askId) return NextResponse.json({ counted: false }, { status: 400, headers: NO_STORE })

  const userAgent = request.headers.get('user-agent') || ''
  if (!userAgent || BOT_PATTERN.test(userAgent)) {
    return NextResponse.json({ counted: false }, { headers: NO_STORE })
  }

  const existingToken = request.cookies.get(VIEWER_TOKEN_COOKIE)?.value
  const viewerToken = existingToken && existingToken.length >= 32 ? existingToken : randomBytes(32).toString('hex')

  const { data, error } = await supabaseAdmin.rpc('record_ask_view', {
    p_prompt_id: askId,
    p_viewer_hash: hashValue(viewerToken),
    p_ip_hash: hashValue(getClientIp(request)),
  })

  if (error) console.error('[AskView] Record failed:', error.message)

  const response = NextResponse.json({ counted: data === true }, { headers: NO_STORE })
  if (viewerToken !== existingToken) {
    const expiry = new Date()
    expiry.setDate(expiry.getDate() + VIEWER_TOKEN_TTL_DAYS)
    response.cookies.set(VIEWER_TOKEN_COOKIE, viewerToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      expires: expiry,
      path: '/',
    })
  }
  return response
}
