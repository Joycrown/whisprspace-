import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/core/supabase/admin-client'
import { resolveUserFromRequest } from '@/lib/security/request-auth'

async function isAdmin(userId: string): Promise<boolean> {
  const [{ data: u }, { data: a }] = await Promise.all([
    supabaseAdmin.from('users').select('is_admin').eq('id', userId).single(),
    supabaseAdmin.from('admin_users').select('role').eq('user_id', userId).maybeSingle(),
  ])
  return u?.is_admin === true || !!a
}

export async function POST(request: NextRequest) {
  try {
    const user = await resolveUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!(await isAdmin(user.id))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { reportId, contentType, contentId, action } = await request.json()

    if (!reportId || !contentType || !contentId || !action) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    if (!['approve', 'remove'].includes(action)) {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

    const newStatus = action === 'remove' ? 'removed' : 'visible'
    const table = contentType === 'thread' ? 'threads' : 'messages'

    // Update content visibility
    const { error: contentError } = await supabaseAdmin
      .from(table)
      .update({ moderation_status: newStatus })
      .eq('id', contentId)

    if (contentError) {
      console.error('[Moderate] Failed to update content status:', contentError)
      return NextResponse.json({ error: 'Failed to update content' }, { status: 500 })
    }

    // Mark report as reviewed with outcome
    const { error: reportError } = await supabaseAdmin
      .from('content_reports')
      .update({
        status: 'resolved',
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
        action_taken: action === 'remove' ? 'content_removed' : 'content_restored',
        outcome: action === 'remove' ? 'removed' : 'approved',
      })
      .eq('id', reportId)

    if (reportError) {
      console.error('[Moderate] Failed to update report status:', reportError)
      // Content was already updated — log but don't fail the request
    }

    // PostHog server-side event would need a backend SDK — log to console for now
    // (PostHog JS is browser-only; wire to PostHog Node SDK if needed later)
    console.log('[Moderation]', { action, contentType, contentId, moderator: user.id })

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('[Moderate] Unexpected error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
