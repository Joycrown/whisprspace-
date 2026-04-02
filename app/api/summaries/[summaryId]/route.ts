/**
 * GET /api/summaries/[summaryId]
 *
 * Fetches a specific summary for the authenticated creator.
 * Used by the client-side summary page (app uses localStorage auth,
 * not cookies, so server components can't verify the session).
 */

import { NextRequest, NextResponse } from 'next/server'
import { resolveUserFromRequest } from '@/app/api/push/_auth'
import { supabaseAdmin } from '@/lib/core/supabase/admin-client'
import { sanitizeUuid } from '@/lib/security/input-sanitization'

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ summaryId: string }> }
) {
  const user = await resolveUserFromRequest(request)
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { summaryId } = await context.params
  const safeSummaryId = sanitizeUuid(summaryId)
  if (!safeSummaryId) {
    return NextResponse.json({ error: 'Invalid summary ID' }, { status: 400 })
  }

  const { data: summary, error } = await supabaseAdmin
    .from('thread_summaries')
    .select('*')
    .eq('id', safeSummaryId)
    .eq('creator_id', user.id)
    .maybeSingle()

  if (error || !summary) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // Mark as viewed
  await supabaseAdmin
    .from('thread_summaries')
    .update({ viewed_by_creator: true })
    .eq('id', safeSummaryId)

  return NextResponse.json({ summary })
}
