/**
 * GET /api/summaries/unseen
 *
 * Returns the most recent unseen thread summary for the authenticated creator.
 * Used by UnseenSummaryModal to avoid relying on RLS with the browser client,
 * since this app stores auth in localStorage (not cookies).
 */

import { NextRequest, NextResponse } from 'next/server'
import { resolveUserFromRequest } from '@/app/api/push/_auth'
import { supabaseAdmin } from '@/lib/core/supabase/admin-client'

export async function GET(request: NextRequest) {
  const user = await resolveUserFromRequest(request)
  if (!user) {
    return NextResponse.json({ summary: null }, { status: 200 })
  }

  const { data } = await supabaseAdmin
    .from('thread_summaries')
    .select('id')
    .eq('creator_id', user.id)
    .eq('viewed_by_creator', false)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  return NextResponse.json({ summary: data ?? null })
}
