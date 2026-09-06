import { NextResponse } from 'next/server'
import { createClient as createSupabaseAdminClient } from '@supabase/supabase-js'

const supabaseAdmin = createSupabaseAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
)

const MAX_PREVIEW_MESSAGES = 3
const MAX_PREVIEW_MESSAGE_LENGTH = 220

type ThreadPreviewRow = {
  id: string
  title: string
  content: string
  category: string
  type: string
  privacy: string
  is_premium: boolean
  price: number | null
  message_count: number | null
  participant_count: number | null
  likes_count: number | null
  expires_at: string | null
  deleted_at: string | null
  creator_id: string
  thread_participants?: Array<{ user_id: string | null }>
}

type ThreadPreviewMessageRow = {
  id: string
  content: string | null
  created_at: string
}

const truncateMessage = (value: string, maxLength: number) => {
  if (value.length <= maxLength) return value
  return `${value.slice(0, maxLength - 3)}...`
}

const toNumber = (value: unknown, fallback = 0): number => {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return fallback
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ threadId: string }> }
) {
  try {
    const { threadId } = await context.params
    if (!threadId) {
      return NextResponse.json({ error: 'Discussion ID is required' }, { status: 400 })
    }

    const { data: thread, error: threadError } = await supabaseAdmin
      .from('threads')
      .select('id,title,content,category,type,privacy,is_premium,price,message_count,participant_count,likes_count,expires_at,deleted_at,creator_id,thread_participants(user_id)')
      .eq('id', threadId)
      .maybeSingle<ThreadPreviewRow>()

    if (threadError || !thread) {
      return NextResponse.json({ error: 'Discussion not found' }, { status: 404 })
    }

    if (thread.deleted_at) {
      return NextResponse.json({ error: 'Discussion is no longer available', status: 'deleted' }, { status: 410 })
    }

    if (thread.expires_at && new Date(thread.expires_at) <= new Date()) {
      return NextResponse.json({ error: 'Discussion has expired', status: 'expired' }, { status: 410 })
    }

    const { data: messageRows, error: messagesError } = await supabaseAdmin
      .from('messages')
      .select('id,content,created_at')
      .eq('thread_id', threadId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(MAX_PREVIEW_MESSAGES)
      .returns<ThreadPreviewMessageRow[]>()

    if (messagesError) {
      console.error('Thread preview messages fetch error:', messagesError)
    }

    const messages = (messageRows || []).map((row) => {
      return {
        id: row.id,
        content: truncateMessage((row.content || '').trim(), MAX_PREVIEW_MESSAGE_LENGTH),
        createdAt: row.created_at,
        // Thread senders are not identified. Exposing a stable anonymous_id
        // here would let anyone correlate a person's activity across every
        // thread they appear in.
        senderName: '',
      }
    })

    const participantCountFromJoinTable = Array.isArray(thread.thread_participants)
      ? new Set(
          thread.thread_participants
            .map((participant) => participant.user_id)
            .filter((participantId): participantId is string => Boolean(participantId))
        ).size
      : null

    const participantCount = participantCountFromJoinTable !== null
      ? participantCountFromJoinTable
      : toNumber(thread.participant_count, 0)

    return NextResponse.json(
      {
        success: true,
        data: {
          id: thread.id,
          title: thread.title || 'Untitled Discussion',
          content: thread.content || '',
          category: thread.category || 'general',
          type: thread.type || 'text',
          privacy: thread.privacy || 'public',
          isPremium: thread.is_premium === true,
          price: thread.price !== null ? toNumber(thread.price, 0) : null,
          messageCount: toNumber(thread.message_count, 0),
          participantCount,
          likes: toNumber(thread.likes_count, 0),
          expiresAt: thread.expires_at,
          messages,
        },
      },
      {
        status: 200,
        headers: { 'Cache-Control': 'no-store' },
      }
    )
  } catch (error) {
    console.error('Thread preview API error:', error)
    return NextResponse.json({ error: 'Failed to load discussion preview' }, { status: 500 })
  }
}
