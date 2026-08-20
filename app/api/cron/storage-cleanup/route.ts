import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabaseAdminClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const maxDuration = 60

const BUCKET = 'thread-attachments'
const LIST_LIMIT = 1000
const DELETE_CHUNK = 100
const TIME_BUDGET_MS = 50_000

const supabaseAdmin = createSupabaseAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } }
)

const listFolder = async (prefix: string) => {
  const { data, error } = await supabaseAdmin.storage
    .from(BUCKET)
    .list(prefix, { limit: LIST_LIMIT })

  if (error) {
    console.error(`Failed to list ${prefix}:`, error.message)
    return []
  }

  return (data || [])
    .filter((entry) => entry.id !== null)
    .map((entry) => `${prefix}/${entry.name}`)
}

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret) {
    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  const startedAt = Date.now()

  const [threadFolders, dmFolders] = await Promise.all([
    listFolder('messages'),
    listFolder('direct-messages'),
  ])

  const threadIds = threadFolders.map((p) => p.split('/')[1]).filter(Boolean)
  const conversationIds = dmFolders.map((p) => p.split('/')[1]).filter(Boolean)

  const [liveThreads, liveConversations] = await Promise.all([
    threadIds.length
      ? supabaseAdmin.from('threads').select('id').in('id', threadIds)
      : Promise.resolve({ data: [], error: null }),
    conversationIds.length
      ? supabaseAdmin.from('conversations').select('id').in('id', conversationIds)
      : Promise.resolve({ data: [], error: null }),
  ])

  if (liveThreads.error || liveConversations.error) {
    console.error(
      'Storage cleanup aborted; parent lookup failed:',
      liveThreads.error?.message || liveConversations.error?.message
    )
    return NextResponse.json({ error: 'Parent lookup failed' }, { status: 500 })
  }

  const liveThreadIds = new Set((liveThreads.data || []).map((r) => r.id))
  const liveConversationIds = new Set(
    (liveConversations.data || []).map((r) => r.id)
  )

  const orphanFolders = [
    ...threadFolders.filter((p) => !liveThreadIds.has(p.split('/')[1])),
    ...dmFolders.filter((p) => !liveConversationIds.has(p.split('/')[1])),
  ]

  let filesRemoved = 0
  let foldersCleared = 0
  let timedOut = false

  for (const folder of orphanFolders) {
    if (Date.now() - startedAt > TIME_BUDGET_MS) {
      timedOut = true
      break
    }

    const files = await listFolder(folder)
    if (files.length === 0) continue

    for (let i = 0; i < files.length; i += DELETE_CHUNK) {
      const chunk = files.slice(i, i + DELETE_CHUNK)
      const { error } = await supabaseAdmin.storage.from(BUCKET).remove(chunk)

      if (error) {
        console.error(`Failed to remove files in ${folder}:`, error.message)
        continue
      }

      filesRemoved += chunk.length
    }

    foldersCleared += 1
  }

  return NextResponse.json({
    scannedFolders: threadFolders.length + dmFolders.length,
    orphanFolders: orphanFolders.length,
    foldersCleared,
    filesRemoved,
    timedOut,
  })
}
