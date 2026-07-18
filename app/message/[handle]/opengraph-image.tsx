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
    // fall through to raw handle
  }

  return normalized
}

export default async function OgImage({ params }: Props) {
  const { handle } = await params
  const displayName = await resolveDisplayName(handle)

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0A0A10',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        {/* Top purple glow band — linear-gradient simulating radial (Satori safe) */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: 320,
            background:
              'linear-gradient(180deg, rgba(139,92,246,0.18) 0%, rgba(139,92,246,0.04) 70%, transparent 100%)',
          }}
        />

        {/* Wordmark */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'row',
            marginBottom: 36,
            position: 'relative',
          }}
        >
          <span style={{ fontSize: 28, fontWeight: 700, color: '#8B5CF6', letterSpacing: '-0.5px' }}>
            Whispr
          </span>
          <span style={{ fontSize: 28, fontWeight: 700, color: '#F97316', letterSpacing: '-0.5px' }}>
            Space
          </span>
        </div>

        {/* Card */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            background: '#12121A',
            border: '1px solid #2A2A38',
            borderRadius: 24,
            padding: '48px 72px',
            width: 840,
            position: 'relative',
          }}
        >
          {/* Gradient top accent bar */}
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 80,
              right: 80,
              height: 2,
              background: 'linear-gradient(90deg, #8B5CF6 0%, #F97316 100%)',
              borderRadius: 2,
            }}
          />

          {/* Icon circle */}
          <div
            style={{
              width: 76,
              height: 76,
              borderRadius: 38,
              background: 'linear-gradient(135deg, #8B5CF6 0%, #F97316 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 28,
              fontSize: 34,
            }}
          >
            👀
          </div>

          {/* Headline — single line, no flexWrap */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 14,
            }}
          >
            <span style={{ fontSize: 50, fontWeight: 700, color: '#F2F2F6', letterSpacing: '-1px' }}>
              Tell&nbsp;
            </span>
            <span style={{ fontSize: 50, fontWeight: 700, color: '#A78BFA', letterSpacing: '-1px' }}>
              {displayName}
            </span>
            <span style={{ fontSize: 50, fontWeight: 700, color: '#F2F2F6', letterSpacing: '-1px' }}>
              &nbsp;the truth.
            </span>
          </div>

          {/* Sub-text */}
          <div
            style={{
              fontSize: 22,
              color: '#8F8FA3',
              textAlign: 'center',
              marginBottom: 36,
            }}
          >
            No name. No trace. Just what you actually think.
          </div>

          {/* CTA pill */}
          <div
            style={{
              background: 'linear-gradient(90deg, #8B5CF6 0%, #F97316 100%)',
              borderRadius: 50,
              padding: '14px 40px',
              fontSize: 20,
              fontWeight: 600,
              color: '#ffffff',
            }}
          >
            Send anonymous message →
          </div>
        </div>

        {/* Bottom domain tag */}
        <div
          style={{
            position: 'absolute',
            bottom: 28,
            display: 'flex',
            fontSize: 14,
            color: '#5C5C6E',
            letterSpacing: '0.5px',
          }}
        >
          whisprspace.com
        </div>
      </div>
    ),
    { ...size }
  )
}
