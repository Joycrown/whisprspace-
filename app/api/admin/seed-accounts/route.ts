import { NextRequest, NextResponse } from 'next/server'
import { createHash, randomBytes } from 'crypto'
import { supabaseAdmin } from '@/lib/core/supabase/admin-client'
import { resolveUserFromRequest } from '@/lib/security/request-auth'
import { generatePseudonym } from '@/lib/utils/pseudonym-generator'
import { validateUsername } from '@/lib/utils/username-validation'
import { sanitizeSingleLineInput } from '@/lib/security/input-sanitization'

// ─── Config ──────────────────────────────────────────────────────────────────

const TOKEN_TTL_DAYS = 7

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function verifyAdmin(req: NextRequest): Promise<string | null> {
  const user = await resolveUserFromRequest(req)
  if (!user) return null

  const { data: adminRow } = await supabaseAdmin
    .from('admin_users').select('user_id').eq('user_id', user.id).single()
  if (adminRow) return user.id

  // Fallback: accept users with is_admin flag and backfill admin_users row
  // so FK constraints on seeded_by / created_by are always satisfied.
  const { data: userRow } = await supabaseAdmin
    .from('users').select('is_admin').eq('id', user.id).single()
  if (userRow?.is_admin !== true) return null

  await supabaseAdmin
    .from('admin_users')
    .upsert({ user_id: user.id, role: 'admin' }, { onConflict: 'user_id' })

  return user.id
}

function generateRawToken(): string {
  return randomBytes(32).toString('base64url')
}

function hashToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex')
}

function getBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    'https://whisprspace.com'
  )
}

function buildClaimUrl(token: string): string {
  return `${getBaseUrl()}/claim/${token}`
}

function buildInboxUrl(handle: string): string {
  return `${getBaseUrl()}/message/${handle}`
}

// ─── GET — list all seed accounts ────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const adminId = await verifyAdmin(req)
  if (!adminId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabaseAdmin
    .from('users')
    .select(`
      id, username, anonymous_id, account_state, seeded_at, created_at,
      seed_claim_tokens ( expires_at, claimed_at, created_at )
    `)
    .not('seeded_at', 'is', null)
    .order('seeded_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Count messages waiting for each unclaimed account
  const enriched = await Promise.all(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (data ?? []).map(async (row: any) => {
      const { count } = await supabaseAdmin
        .from('direct_messages')
        .select('id', { count: 'exact', head: true })
        .in(
          'conversation_id',
          (await supabaseAdmin
            .from('conversation_participants')
            .select('conversation_id')
            .eq('user_id', row.id)
          ).data?.map((r: { conversation_id: string }) => r.conversation_id) ?? []
        )

      const token = Array.isArray(row.seed_claim_tokens)
        ? row.seed_claim_tokens[0]
        : row.seed_claim_tokens

      return {
        id: row.id,
        handle: row.username || row.anonymous_id,
        seededAt: row.seeded_at,
        expiresAt: token?.expires_at ?? null,
        claimedAt: token?.claimed_at ?? null,
        messageCount: count ?? 0,
        inboxUrl: buildInboxUrl(row.username || row.anonymous_id),
      }
    })
  )

  return NextResponse.json({ accounts: enriched })
}

// ─── POST — create unclaimed seed account ─────────────────────────────────────

export async function POST(req: NextRequest) {
  const adminId = await verifyAdmin(req)
  if (!adminId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { handle?: string }
  try { body = await req.json() } catch { body = {} }

  // Resolve handle
  const handle = body.handle
    ? sanitizeSingleLineInput(body.handle, { maxLength: 30 }).replace(/[^a-zA-Z0-9-]/g, '')
    : generatePseudonym()

  if (!handle || handle.length < 3) {
    return NextResponse.json({ error: 'Handle must be at least 3 characters' }, { status: 400 })
  }

  const validation = validateUsername(handle)
  if (!validation.isValid) {
    return NextResponse.json({ error: validation.error }, { status: 400 })
  }

  // Check handle availability (case-insensitive)
  const { data: existing } = await supabaseAdmin
    .from('users').select('id').ilike('username', handle).single()
  if (existing) {
    return NextResponse.json({ error: 'That handle is already taken' }, { status: 409 })
  }

  // Generate a stable UUID for this account — used as both public.users id
  // and will become auth.users id when the person claims (Shape B: same UUID)
  const userId = crypto.randomUUID()

  // Anonymous id in the normal ANON_XXXXXXXX format (derived from the UUID) —
  // NOT prefixed with ANON_SEED so nothing ever surfaces the seed origin to users.
  const anonymousId = `ANON_${userId.replace(/-/g, '').slice(0, 8).toUpperCase()}`

  // Create the public.users row with no auth linkage yet
  const { data: newUser, error: userError } = await supabaseAdmin
    .from('users')
    .insert({
      id: userId,
      anonymous_id: anonymousId,
      username: handle,
      is_anonymous: false,
      account_state: 'unclaimed',
      seeded_by: adminId,
      seeded_at: new Date().toISOString(),
    })
    .select('id, username')
    .single()

  if (userError || !newUser) {
    console.error('[seed-accounts] users insert failed:', userError)
    return NextResponse.json({ error: 'Failed to create account' }, { status: 500 })
  }

  // Generate claim token
  const rawToken = generateRawToken()
  const tokenHash = hashToken(rawToken)
  const expiresAt = new Date(Date.now() + TOKEN_TTL_DAYS * 86400 * 1000).toISOString()

  const { error: tokenError } = await supabaseAdmin
    .from('seed_claim_tokens')
    .insert({
      user_id: newUser.id,
      token_hash: tokenHash,
      created_by: adminId,
      expires_at: expiresAt,
    })

  if (tokenError) {
    console.error('[seed-accounts] seed_claim_tokens insert failed:', tokenError)
    await supabaseAdmin.from('users').delete().eq('id', newUser.id)
    return NextResponse.json({ error: 'Failed to generate claim token' }, { status: 500 })
  }

  // Audit log
  await supabaseAdmin.from('seed_audit_log').insert({
    admin_id: adminId,
    action: 'created',
    user_id: newUser.id,
    handle,
  })

  const claimUrl = buildClaimUrl(rawToken)
  const inboxUrl = buildInboxUrl(handle)

  return NextResponse.json({
    id: newUser.id,
    handle,
    claimUrl,
    inboxUrl,
    expiresAt,
    whatsappText: `Hey! I've set up your WhisprSpace inbox — people can send you anonymous messages here.\n\n📥 Inbox: ${inboxUrl}\n\n👉 Claim your account (takes 1 min): ${claimUrl}\n\nLink expires in 7 days.`,
  })
}
