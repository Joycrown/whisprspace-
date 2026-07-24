import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAnon = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  { auth: { persistSession: false } }
)

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ threadId: string }> }
) {
  const { threadId } = await params

  if (!threadId || threadId.length > 128) {
    return NextResponse.json({ error: 'Invalid thread' }, { status: 400 })
  }

  const { data, error } = await supabaseAnon.rpc('get_thread_buyer_likes', {
    p_thread_id: threadId,
  })

  if (error) {
    console.error('[buyer-likes]', error.message)
    return NextResponse.json({ error: 'Failed to fetch signal' }, { status: 500 })
  }

  const row = Array.isArray(data) ? data[0] : data
  if (!row) {
    return NextResponse.json({ liked_count: 0, paid_buyer_count: 0 })
  }

  return new NextResponse(
    JSON.stringify({
      liked_count: Number(row.liked_count ?? 0),
      paid_buyer_count: Number(row.paid_buyer_count ?? 0),
    }),
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        // Cache 5 min — signal doesn't need to be real-time
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=60',
      },
    }
  )
}
