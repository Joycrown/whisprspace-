import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/core/supabase/admin-client'
import { readSenderToken, sha256 } from '@/lib/security/anon-sender'
import { resolveUserFromRequest } from '@/lib/security/request-auth'
import { sanitizeUuid } from '@/lib/security/input-sanitization'
import { resolveRegisteredUser } from '@/lib/stories/server'

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params
  const storyId = sanitizeUuid(id)
  if (!storyId) return NextResponse.json({ error: 'Invalid story.' }, { status: 400 })

  const user = await resolveUserFromRequest(request)
  const profile = user ? await resolveRegisteredUser(user.id) : null
  if (!profile || profile.is_anonymous) {
    return NextResponse.json({ error: 'Create an account to save this story.', code: 'account_required' }, { status: 401 })
  }

  const token = readSenderToken(request)
  if (!token) return NextResponse.json({ error: 'This story was shared from another device or browser.' }, { status: 403 })

  const { data, error } = await supabaseAdmin
    .from('stories')
    .update({ author_user_id: profile.id })
    .eq('id', storyId)
    .is('author_user_id', null)
    .is('deleted_at', null)
    .eq('sender_token_hash', sha256(token))
    .select('id')
    .maybeSingle()

  if (error) {
    console.error('[Stories] Claim failed:', error.message)
    return NextResponse.json({ error: 'Unable to save this story to your account.' }, { status: 500 })
  }
  if (!data) {
    return NextResponse.json({ error: 'This story can’t be added to your account.' }, { status: 404 })
  }

  return NextResponse.json({ claimed: true })
}
