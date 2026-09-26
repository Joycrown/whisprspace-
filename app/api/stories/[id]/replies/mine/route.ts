import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/core/supabase/admin-client'
import { resolveUserFromRequest } from '@/lib/security/request-auth'
import { sanitizeUuid } from '@/lib/security/input-sanitization'

const EMPTY = { ids: [] as string[], reactions: {} as Record<string, string> }

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params
  const storyId = sanitizeUuid(id)
  if (!storyId) return NextResponse.json({ error: 'Invalid story.' }, { status: 400 })

  const user = await resolveUserFromRequest(request)
  if (!user) return NextResponse.json(EMPTY)

  const { data: story } = await supabaseAdmin.from('stories').select('thread_id').eq('id', storyId).maybeSingle()
  if (!story?.thread_id) return NextResponse.json(EMPTY)

  const [{ data: mine }, { data: reacted }] = await Promise.all([
    supabaseAdmin
      .from('messages')
      .select('id')
      .eq('thread_id', story.thread_id)
      .eq('sender_id', user.id)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(200),
    supabaseAdmin
      .from('message_reactions')
      .select('message_id, reaction_type')
      .eq('thread_id', story.thread_id)
      .eq('user_id', user.id)
      .limit(500),
  ])

  const reactions: Record<string, string> = {}
  for (const row of reacted ?? []) reactions[row.message_id] = row.reaction_type

  return NextResponse.json({ ids: (mine ?? []).map((row) => row.id), reactions })
}
