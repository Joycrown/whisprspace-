import { ImageResponse } from 'next/og'

export const OG_SIZE = { width: 1200, height: 630 }

export async function resolveDisplayName(handle: string): Promise<string> {
  const normalized = decodeURIComponent(handle).trim()
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseKey) return normalized

  const headers = {
    apikey: supabaseKey,
    Authorization: `Bearer ${supabaseKey}`,
    'Content-Type': 'application/json',
  }

  try {
    const byUsernameRes = await fetch(
      `${supabaseUrl}/rest/v1/users?select=username,anonymous_id&username=ilike.${encodeURIComponent(normalized)}&limit=1`,
      { headers }
    )
    if (byUsernameRes.ok) {
      const rows = await byUsernameRes.json()
      if (rows.length > 0) return rows[0].username || rows[0].anonymous_id || normalized
    }

    const byAnonRes = await fetch(
      `${supabaseUrl}/rest/v1/users?select=username,anonymous_id&anonymous_id=eq.${encodeURIComponent(normalized)}&limit=1`,
      { headers }
    )
    if (byAnonRes.ok) {
      const rows = await byAnonRes.json()
      if (rows.length > 0) return rows[0].username || rows[0].anonymous_id || normalized
    }
  } catch {
    // fall through
  }

  return normalized
}

/**
 * Builds the 1200×630 landscape link-preview card (WhatsApp / Twitter / Facebook).
 * Shares the visual language of the downloadable square card (UserShareCard.tsx):
 * gradient identity, ghosted last headline line, centered recipient + gradient CTA.
 * Static render (next/og / Satori) — no CSS animations, flexbox only.
 *
 * Returns a raw ImageResponse. Callers decide how to serve it — the route handler
 * buffers it with an explicit Content-Length so WhatsApp renders the thumbnail.
 */
function getBaseHost(): string {
  const url =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    'https://whisprspace.com'
  try { return new URL(url).host } catch { return 'whisprspace.com' }
}

export async function renderOgCard(handle: string): Promise<ImageResponse> {
  const displayName = await resolveDisplayName(handle)
  const initial = displayName.charAt(0).toUpperCase()
  const nameFontSize = displayName.length > 14 ? 40 : displayName.length > 10 ? 48 : 58
  const baseHost = getBaseHost()

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'row',
          fontFamily: 'system-ui, sans-serif',
          background: '#0A0A10',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* ── Top accent bar ── */}
        <div style={{
          position: 'absolute',
          top: 0, left: 0, right: 0,
          height: 5,
          background: 'linear-gradient(90deg, #8B5CF6 0%, #F97316 100%)',
          display: 'flex',
        }} />

        {/* ── Purple glow — top left ── */}
        <div style={{
          position: 'absolute',
          top: -180, left: -120,
          width: 620, height: 620,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(139,92,246,0.28) 0%, rgba(139,92,246,0) 68%)',
          display: 'flex',
        }} />

        {/* ── Orange glow — bottom right ── */}
        <div style={{
          position: 'absolute',
          bottom: -160, right: -100,
          width: 520, height: 520,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(249,115,22,0.20) 0%, rgba(249,115,22,0) 68%)',
          display: 'flex',
        }} />

        {/* ── LEFT — brand + headline ── */}
        <div style={{
          width: '60%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '52px 60px 44px 60px',
          position: 'relative',
        }}>
          {/* Wordmark */}
          <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center' }}>
            <span style={{ fontSize: 26, fontWeight: 800, color: '#8B5CF6', letterSpacing: '-0.4px' }}>Whispr</span>
            <span style={{ fontSize: 26, fontWeight: 800, color: '#F97316', letterSpacing: '-0.4px' }}>Space</span>
          </div>

          {/* Headline */}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{
              fontSize: 17,
              fontWeight: 800,
              color: '#5C5C6E',
              letterSpacing: '4px',
              textTransform: 'uppercase',
              marginBottom: 22,
              display: 'flex',
            }}>
              Anonymous Inbox
            </div>
            <div style={{ fontSize: 74, fontWeight: 900, color: '#F2F2F6', lineHeight: 1.02, letterSpacing: '-2.5px', display: 'flex' }}>
              The truth
            </div>
            <div style={{ fontSize: 74, fontWeight: 900, color: '#F2F2F6', lineHeight: 1.02, letterSpacing: '-2.5px', display: 'flex' }}>
              you&apos;ve been
            </div>
            <div style={{ fontSize: 74, fontWeight: 900, color: 'rgba(242,242,246,0.22)', lineHeight: 1.02, letterSpacing: '-2.5px', display: 'flex' }}>
              holding back.
            </div>
          </div>

          {/* Footer trust line */}
          <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center' }}>
            <div style={{ width: 9, height: 9, borderRadius: '50%', background: '#5DCAA5', marginRight: 11, display: 'flex' }} />
            <span style={{ fontSize: 20, fontWeight: 700, color: '#5C5C6E', letterSpacing: '0.2px', display: 'flex' }}>
              No name. No trace. Always anonymous.
            </span>
          </div>
        </div>

        {/* ── DIVIDER ── */}
        <div style={{
          width: 1,
          margin: '52px 0',
          background: 'linear-gradient(180deg, transparent 0%, #2A2A38 20%, #2A2A38 80%, transparent 100%)',
          display: 'flex',
        }} />

        {/* ── RIGHT — recipient ── */}
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '48px 44px',
          position: 'relative',
        }}>
          {/* Avatar with gradient ring */}
          <div style={{
            width: 108,
            height: 108,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #8B5CF6 0%, #F97316 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 0 4px rgba(139,92,246,0.22), 0 0 0 10px rgba(249,115,22,0.08)',
          }}>
            <span style={{ fontSize: 46, fontWeight: 800, color: '#ffffff', display: 'flex' }}>{initial}</span>
          </div>

          {/* Recipient */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: 22 }}>
            <span style={{ fontSize: 20, color: '#5C5C6E', fontWeight: 700, letterSpacing: '0.5px', display: 'flex' }}>Tell</span>
            <span style={{
              fontSize: nameFontSize,
              fontWeight: 800,
              color: '#F2F2F6',
              letterSpacing: '-1.5px',
              lineHeight: 1.05,
              textAlign: 'center',
              marginTop: 6,
              marginBottom: 6,
              display: 'flex',
            }}>
              {displayName}
            </span>
            <span style={{ fontSize: 20, color: '#5C5C6E', fontWeight: 700, letterSpacing: '0.5px', display: 'flex' }}>the truth.</span>
          </div>

          {/* CTA */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'linear-gradient(90deg, #8B5CF6 0%, #F97316 100%)',
            borderRadius: 50,
            padding: '16px 34px',
            marginTop: 30,
          }}>
            <span style={{ fontSize: 22, fontWeight: 700, color: '#ffffff', letterSpacing: '-0.2px', display: 'flex' }}>
              Send anonymous message →
            </span>
          </div>

          {/* URL */}
          <span style={{ fontSize: 18, fontWeight: 600, color: '#3A3A4E', letterSpacing: '0.3px', marginTop: 20, display: 'flex' }}>
            {baseHost}/message/{handle}
          </span>
        </div>
      </div>
    ),
    { ...OG_SIZE }
  )
}
