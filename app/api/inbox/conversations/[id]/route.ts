import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/core/supabase/admin-client'
import { resolveUserFromRequest } from '@/lib/security/request-auth'

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await resolveUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  // Verify the requesting user is a participant in this conversation
  const { data: participant } = await supabaseAdmin
    .from('conversation_participants')
    .select('conversation_id')
    .eq('conversation_id', id)
    .eq('user_id', user.id)
    .single()

  if (!participant) {
    return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
  }

  // Delete the conversation — cascades to direct_messages, conversation_participants,
  // and message_read_receipts via ON DELETE CASCADE FK constraints
  const { error } = await supabaseAdmin
    .from('conversations')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('[inbox/conversations] delete failed:', error)
    return NextResponse.json({ error: 'Failed to delete conversation' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
