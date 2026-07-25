import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'crypto'
import { supabaseAdmin } from '@/lib/core/supabase/admin-client'

const NEUTRAL_ERROR = 'This link is no longer valid.'

export async function POST(req: NextRequest) {
  let body: { token?: string; password?: string; email?: string }
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const { token, password, email } = body

  if (!token || typeof token !== 'string') {
    return NextResponse.json({ error: NEUTRAL_ERROR }, { status: 400 })
  }
  if (!password || password.length < 8) {
    return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
  }

  const tokenHash = createHash('sha256').update(token).digest('hex')

  // ── Atomic token consume ────────────────────────────────────────────────────
  // UPDATE ... SET claimed_at = now() WHERE token_hash = $1
  //   AND claimed_at IS NULL AND expires_at > now()
  // Zero rows returned = already used, expired, or fake — all the same message.
  const { data: consumed, error: consumeError } = await supabaseAdmin
    .from('seed_claim_tokens')
    .update({ claimed_at: new Date().toISOString() })
    .eq('token_hash', tokenHash)
    .is('claimed_at', null)
    .gt('expires_at', new Date().toISOString())
    .select('user_id')
    .single()

  if (consumeError || !consumed) {
    return NextResponse.json({ error: NEUTRAL_ERROR }, { status: 410 })
  }

  const userId = consumed.user_id

  // ── Fetch the reserved user row ─────────────────────────────────────────────
  const { data: existingUser } = await supabaseAdmin
    .from('users')
    .select('id, username, anonymous_id')
    .eq('id', userId)
    .eq('account_state', 'unclaimed')
    .single()

  if (!existingUser) {
    // Roll back the consume in case of race
    await supabaseAdmin
      .from('seed_claim_tokens')
      .update({ claimed_at: null })
      .eq('token_hash', tokenHash)
    return NextResponse.json({ error: NEUTRAL_ERROR }, { status: 410 })
  }

  const handle = existingUser.username || existingUser.anonymous_id

  // ── Create the auth user with the exact same UUID (Shape B) ─────────────────
  // admin.createUser with email_confirm: true bypasses email verification.
  // Supabase allows specifying id so auth.users.id = public.users.id — the FK resolves instantly.
  const createPayload: {
    id: string
    password: string
    email?: string
    email_confirm: boolean
    user_metadata: { account_state: string; username: string }
  } = {
    id: userId,
    password,
    email_confirm: true,
    user_metadata: { account_state: 'active', username: handle },
  }
  if (email && email.trim()) {
    createPayload.email = email.trim().toLowerCase()
  }

  let { data: authUser, error: createError } = await supabaseAdmin.auth.admin.createUser(createPayload)

  // An auth row for this reserved UUID may already exist (e.g. a prior claim attempt
  // that partially completed). In that case, set the credentials on the existing
  // row instead of failing — the claim is idempotent from the user's perspective.
  if (createError) {
    const msg = (createError.message || '').toLowerCase()
    const alreadyExists =
      msg.includes('already registered') ||
      msg.includes('already been registered') ||
      msg.includes('already exists') ||
      msg.includes('duplicate')

    if (alreadyExists) {
      const updatePayload: { password: string; email_confirm: boolean; email?: string } = {
        password,
        email_confirm: true,
      }
      if (email && email.trim()) updatePayload.email = email.trim().toLowerCase()

      const { data: updated, error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
        userId,
        updatePayload
      )
      if (!updateError && updated?.user) {
        authUser = updated
        createError = null
      } else {
        console.error('[Claim] Auth update fallback failed:', updateError?.message)
      }
    }
  }

  if (createError || !authUser?.user) {
    // Roll back the consume
    await supabaseAdmin
      .from('seed_claim_tokens')
      .update({ claimed_at: null })
      .eq('token_hash', tokenHash)
    console.error('[Claim] Auth user creation failed:', createError?.message)

    // Surface a specific, safe message for the common "email taken" case so the
    // user knows to use a different email or sign in, instead of a dead-end retry.
    const raw = (createError?.message || '').toLowerCase()
    if (raw.includes('already registered') || raw.includes('already been registered') || (raw.includes('email') && raw.includes('exist'))) {
      return NextResponse.json(
        { error: 'That email is already in use. Try a different email, or leave it blank.' },
        { status: 409 }
      )
    }
    // Include the underlying reason to aid debugging on staging. Supabase auth
    // messages are safe to surface (no secrets); this replaces the opaque
    // "please try again" that hid the real cause.
    return NextResponse.json(
      {
        error: 'Failed to create account. Please try again.',
        detail: createError?.message || 'Unknown auth error',
      },
      { status: 500 }
    )
  }

  // ── Flip account_state → active ─────────────────────────────────────────────
  await supabaseAdmin
    .from('users')
    .update({ account_state: 'active' })
    .eq('id', userId)

  // ── Mint a session by signing in with the just-set password ────────────────
  // We know the password because we just received it in this request.
  // Use the Supabase Auth REST endpoint directly (same raw-auth pattern).
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

  const signInBody = email?.trim()
    ? { email: email.trim().toLowerCase(), password }
    : null

  let sessionData: Record<string, unknown> | null = null

  if (signInBody) {
    const signInRes = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: supabaseAnonKey },
      body: JSON.stringify(signInBody),
    })
    if (signInRes.ok) {
      sessionData = await signInRes.json()
    }
  }

  if (!sessionData) {
    // No email provided or sign-in failed — account is active, user needs to sign in manually.
    return NextResponse.json({
      success: true,
      handle,
      session: null,
      fallbackToSignIn: true,
      email: email?.trim() || null,
    })
  }

  // Count queued messages
  const participantRows = await supabaseAdmin
    .from('conversation_participants')
    .select('conversation_id')
    .eq('user_id', userId)
  const convIds = (participantRows.data ?? []).map((r: { conversation_id: string }) => r.conversation_id)
  let messageCount = 0
  if (convIds.length > 0) {
    const { count } = await supabaseAdmin
      .from('direct_messages')
      .select('id', { count: 'exact', head: true })
      .in('conversation_id', convIds)
      .neq('sender_id', userId)
    messageCount = count ?? 0
  }

  const base =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    'https://whisprspace.com'

  return NextResponse.json({
    success: true,
    handle,
    session: sessionData,
    messageCount,
    inboxUrl: `${base}/message/${handle}`,
    inboxReadUrl: `${base}/inbox`,
  })
}
