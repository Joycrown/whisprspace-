/**
 * Mark Summary as Shared
 *
 * Called when the creator downloads/shares their impact card.
 * Updates shared_by_creator = true so PostHog can measure organic reach.
 *
 * Security: only the creator of the summary can mark it as shared
 * (enforced via RLS on thread_summaries — but we double-check here too).
 */

import { NextRequest, NextResponse } from 'next/server'
import { resolveUserFromRequest } from '@/app/api/push/_auth'
import { supabaseAdmin } from '@/lib/core/supabase/admin-client'
import { sanitizeUuid } from '@/lib/security/input-sanitization'

export async function POST(request: NextRequest) {
  const user = await resolveUserFromRequest(request)
  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const summaryId = sanitizeUuid((body as Record<string, unknown>).summaryId)
  if (!summaryId) {
    return NextResponse.json({ error: 'Invalid summaryId' }, { status: 400 })
  }

  const { error } = await supabaseAdmin
    .from('thread_summaries')
    .update({ shared_by_creator: true })
    .eq('id', summaryId)
    .eq('creator_id', user.id) // Creator-only guard

  if (error) {
    console.error('[MarkShared] DB error:', error)
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
