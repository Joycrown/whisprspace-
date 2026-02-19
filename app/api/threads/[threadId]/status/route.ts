import { NextResponse } from 'next/server'
import { createClient as createSupabaseAdminClient } from '@supabase/supabase-js'

const supabaseAdmin = createSupabaseAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
)

type ThreadStatusRow = {
  id: string
  privacy: string
  expires_at: string | null
  deleted_at: string | null
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ threadId: string }> }
) {
  try {
    const { threadId } = await context.params
    if (!threadId) {
      return NextResponse.json(
        { code: 'THREAD_ID_REQUIRED', message: 'Thread ID is required' },
        { status: 400 }
      )
    }

    const { data: thread, error } = await supabaseAdmin
      .from('threads')
      .select('id,privacy,expires_at,deleted_at')
      .eq('id', threadId)
      .maybeSingle<ThreadStatusRow>()

    if (error || !thread) {
      return NextResponse.json(
        { code: 'THREAD_NOT_FOUND', message: 'This thread is no longer available.' },
        { status: 404 }
      )
    }

    if (thread.deleted_at) {
      return NextResponse.json(
        { code: 'THREAD_UNAVAILABLE', message: 'This thread is no longer available.' },
        { status: 410 }
      )
    }

    if (thread.expires_at && new Date(thread.expires_at) <= new Date()) {
      return NextResponse.json(
        { code: 'THREAD_EXPIRED', message: 'This thread has expired.' },
        { status: 410 }
      )
    }

    if (thread.privacy !== 'public') {
      return NextResponse.json(
        { code: 'THREAD_RESTRICTED', message: 'You do not have access to this thread.' },
        { status: 403 }
      )
    }

    return NextResponse.json(
      { code: 'THREAD_ACTIVE', message: 'Thread is active.' },
      { status: 200, headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (error) {
    console.error('Thread status API error:', error)
    return NextResponse.json(
      { code: 'THREAD_STATUS_FAILED', message: 'Failed to inspect thread status.' },
      { status: 500 }
    )
  }
}
