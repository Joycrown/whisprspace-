import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const contentType = 'image/png'
export const size = { width: 1200, height: 630 }

interface Props {
  params: Promise<{ handle: string }>
}

async function resolveDisplayName(handle: string): Promise<string> {
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

export default async function OgImage({ params }: Props) {
  const { handle } = await params
  const displayName = await resolveDisplayName(handle)
  const initial = displayName.charAt(0).toUpperCase()
  const nameFontSize = displayName.length > 14 ? 42 : displayName.length > 10 ? 52 : 62

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          fontFamily: 'system-ui, sans-serif',
          background: '#07070E',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* ── BACKGROUND TEXTURE — vertical light bars ── */}
        <div style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'row',
        }}>
          {[...Array(24)].map((_, i) => (
            <div key={i} style={{
              flex: 1,
              height: '100%',
              borderRight: '1px solid rgba(255,255,255,0.018)',
            }} />
          ))}
        </div>

        {/* ── PURPLE GLOW — top left ── */}
        <div style={{
          position: 'absolute',
          top: -180,
          left: -120,
          width: 560,
          height: 560,
          borderRadius: '50%',
          background: 'linear-gradient(135deg, rgba(109,40,217,0.55) 0%, rgba(109,40,217,0) 70%)',
        }} />

        {/* ── ORANGE GLOW — bottom center-right ── */}
        <div style={{
          position: 'absolute',
          bottom: -160,
          right: 200,
          width: 480,
          height: 480,
          borderRadius: '50%',
          background: 'linear-gradient(315deg, rgba(194,65,12,0.40) 0%, rgba(194,65,12,0) 70%)',
        }} />

        {/* ── TOP ACCENT BAR ── */}
        <div style={{
          position: 'absolute',
          top: 0, left: 0, right: 0,
          height: 3,
          background: 'linear-gradient(90deg, #7C3AED 0%, #EA580C 100%)',
          display: 'flex',
        }} />

        {/* ── MAIN CONTENT ROW ── */}
        <div style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'stretch',
        }}>

          {/* ── LEFT — 62% — brand + headline ── */}
          <div style={{
            width: '62%',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            padding: '52px 64px 48px 64px',
            position: 'relative',
          }}>

            {/* Wordmark row */}
            <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center' }}>
              <div style={{
                display: 'flex',
                flexDirection: 'row',
                alignItems: 'center',
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 8,
                padding: '6px 14px',
              }}>
                <span style={{ fontSize: 15, fontWeight: 800, color: '#A78BFA', letterSpacing: '-0.2px' }}>Whispr</span>
                <span style={{ fontSize: 15, fontWeight: 800, color: '#FB923C', letterSpacing: '-0.2px' }}>Space</span>
              </div>
              <div style={{
                marginLeft: 16,
                display: 'flex',
                flexDirection: 'row',
                alignItems: 'center',
                background: 'rgba(93,202,165,0.1)',
                border: '1px solid rgba(93,202,165,0.2)',
                borderRadius: 50,
                padding: '5px 12px',
              }}>
                <div style={{
                  width: 6, height: 6,
                  borderRadius: '50%',
                  background: '#5DCAA5',
                  marginRight: 7,
                }} />
                <span style={{ fontSize: 12, fontWeight: 600, color: '#5DCAA5', letterSpacing: '0.5px' }}>
                  ANONYMOUS
                </span>
              </div>
            </div>

            {/* Headline block */}
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{
                fontSize: 11,
                fontWeight: 700,
                color: '#3D3D52',
                letterSpacing: '3.5px',
                textTransform: 'uppercase',
                marginBottom: 22,
              }}>
                Anonymous Inbox
              </div>
              <div style={{
                fontSize: 76,
                fontWeight: 900,
                color: '#FFFFFF',
                lineHeight: 1.0,
                letterSpacing: '-3px',
              }}>
                The truth
              </div>
              <div style={{
                fontSize: 76,
                fontWeight: 900,
                color: '#FFFFFF',
                lineHeight: 1.0,
                letterSpacing: '-3px',
              }}>
                you&apos;ve been
              </div>
              <div style={{
                fontSize: 76,
                fontWeight: 900,
                color: 'rgba(255,255,255,0.18)',
                lineHeight: 1.0,
                letterSpacing: '-3px',
              }}>
                holding back.
              </div>
            </div>

            {/* Bottom trust row */}
            <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center' }}>
              <span style={{ fontSize: 13, color: '#3D3D52', letterSpacing: '0.3px' }}>
                No name · No trace · No identity
              </span>
            </div>
          </div>

          {/* ── DIVIDER ── */}
          <div style={{
            width: 1,
            margin: '0',
            background: 'linear-gradient(180deg, transparent 0%, rgba(60,60,80,0.6) 20%, rgba(60,60,80,0.6) 80%, transparent 100%)',
            flexShrink: 0,
          }} />

          {/* ── RIGHT — 38% — recipient card ── */}
          <div style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '48px 44px',
            position: 'relative',
          }}>

            {/* Card container */}
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: 20,
              padding: '36px 32px',
              width: '100%',
            }}>

              {/* Avatar */}
              <div style={{
                width: 80,
                height: 80,
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #7C3AED 0%, #EA580C 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 34,
                fontWeight: 800,
                color: '#ffffff',
              }}>
                {initial}
              </div>

              {/* Name block */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: 20 }}>
                <span style={{ fontSize: 12, color: '#3D3D52', fontWeight: 600, letterSpacing: '2px', textTransform: 'uppercase' }}>
                  Send to
                </span>
                <span style={{
                  fontSize: nameFontSize,
                  fontWeight: 900,
                  color: '#F4F4F8',
                  letterSpacing: '-1.5px',
                  lineHeight: 1.05,
                  textAlign: 'center',
                  marginTop: 8,
                }}>
                  {displayName}
                </span>
              </div>

              {/* Divider line */}
              <div style={{
                width: '100%',
                height: 1,
                background: 'rgba(255,255,255,0.06)',
                marginTop: 28,
                marginBottom: 28,
              }} />

              {/* CTA */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'linear-gradient(90deg, #7C3AED 0%, #EA580C 100%)',
                borderRadius: 12,
                padding: '16px 24px',
                width: '100%',
              }}>
                <span style={{ fontSize: 15, fontWeight: 700, color: '#ffffff', letterSpacing: '-0.2px' }}>
                  Send anonymous message →
                </span>
              </div>

              {/* URL */}
              <span style={{ fontSize: 11, color: '#2E2E42', letterSpacing: '0.3px', marginTop: 18 }}>
                whisprspace.com/message/{handle}
              </span>
            </div>
          </div>
        </div>
      </div>
    ),
    { ...size }
  )
}
