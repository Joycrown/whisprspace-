import { NextRequest, NextResponse } from 'next/server'
import { getAskViewerState } from '@/lib/prompts/public'
import { getSenderTokenHash } from '@/lib/prompts/sender'
import type { AskViewerState } from '@/lib/prompts/public-types'
import { sanitizeUuid } from '@/lib/security/input-sanitization'

const NO_STORE = { 'Cache-Control': 'private, no-store' }
const EMPTY_STATE: AskViewerState = { answered: false, ownResponseIds: [], reactions: {} }

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params
  const askId = sanitizeUuid(id)
  if (!askId) return NextResponse.json({ error: 'Invalid ask.' }, { status: 400, headers: NO_STORE })

  const tokenHash = getSenderTokenHash(request)
  if (!tokenHash) return NextResponse.json(EMPTY_STATE, { headers: NO_STORE })

  try {
    return NextResponse.json(await getAskViewerState(askId, tokenHash), { headers: NO_STORE })
  } catch (error) {
    console.error('[AskViewerState] Lookup failed:', error instanceof Error ? error.message : error)
    return NextResponse.json(EMPTY_STATE, { headers: NO_STORE })
  }
}
