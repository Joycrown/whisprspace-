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

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          fontFamily: 'system-ui, sans-serif',
          position: 'relative',
          overflow: 'hidden',
          background: '#0A0A10',
        }}
      >
        {/* LEFT PANEL — gradient fill, 55% width */}
        <div
          style={{
            width: '55%',
            height: '100%',
            background: 'linear-gradient(145deg, #3B1FA8 0%, #6D28D9 40%, #C2410C 100%)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            padding: '56px 52px',
            position: 'relative',
          }}
        >
          {/* Noise texture overlay — diagonal stripes */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'linear-gradient(135deg, rgba(255,255,255,0.04) 25%, transparent 25%, transparent 50%, rgba(255,255,255,0.04) 50%, rgba(255,255,255,0.04) 75%, transparent 75%)',
              backgroundSize: '8px 8px',
            }}
          />

          {/* Top: Wordmark */}
          <div style={{ display: 'flex', flexDirection: 'row', position: 'relative' }}>
            <span style={{ fontSize: 22, fontWeight: 800, color: 'rgba(255,255,255,0.9)', letterSpacing: '-0.3px' }}>
              Whispr
            </span>
            <span style={{ fontSize: 22, fontWeight: 800, color: 'rgba(255,255,255,0.5)', letterSpacing: '-0.3px' }}>
              Space
            </span>
          </div>

          {/* Middle: Big headline */}
          <div style={{ display: 'flex', flexDirection: 'column', position: 'relative' }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: 'rgba(255,255,255,0.55)', letterSpacing: '2px', marginBottom: 16, textTransform: 'uppercase' }}>
              Anonymous inbox
            </div>
            <div style={{ fontSize: 52, fontWeight: 800, color: '#ffffff', letterSpacing: '-2px', lineHeight: 1.05 }}>
              Say what
            </div>
            <div style={{ fontSize: 52, fontWeight: 800, color: '#ffffff', letterSpacing: '-2px', lineHeight: 1.05 }}>
              you really
            </div>
            <div style={{ fontSize: 52, fontWeight: 800, color: 'rgba(255,255,255,0.4)', letterSpacing: '-2px', lineHeight: 1.05 }}>
              think.
            </div>
          </div>

          {/* Bottom: CTA pill */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              background: 'rgba(255,255,255,0.15)',
              borderRadius: 50,
              padding: '10px 22px',
              position: 'relative',
            }}
          >
            <span style={{ fontSize: 14, fontWeight: 600, color: '#ffffff', letterSpacing: '0.3px' }}>
              No name · No trace · Always anonymous
            </span>
          </div>
        </div>

        {/* RIGHT PANEL — dark, recipient info */}
        <div
          style={{
            width: '45%',
            height: '100%',
            background: '#0F0F1A',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '48px 40px',
            position: 'relative',
          }}
        >
          {/* Subtle top border accent */}
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 40,
              right: 40,
              height: 2,
              background: 'linear-gradient(90deg, #8B5CF6, #F97316)',
            }}
          />

          {/* Avatar circle with initial */}
          <div
            style={{
              width: 96,
              height: 96,
              borderRadius: 48,
              background: 'linear-gradient(135deg, #8B5CF6 0%, #F97316 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 24,
              fontSize: 40,
              fontWeight: 800,
              color: '#ffffff',
            }}
          >
            {displayName.charAt(0).toUpperCase()}
          </div>

          {/* "Tell X the truth" */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              marginBottom: 32,
            }}
          >
            <div style={{ fontSize: 15, color: '#5C5C6E', fontWeight: 500, marginBottom: 8, letterSpacing: '0.5px' }}>
              Tell
            </div>
            <div
              style={{
                fontSize: displayName.length > 10 ? 28 : 36,
                fontWeight: 800,
                color: '#F2F2F6',
                letterSpacing: '-1px',
                textAlign: 'center',
                lineHeight: 1.1,
              }}
            >
              {displayName}
            </div>
            <div style={{ fontSize: 15, color: '#5C5C6E', fontWeight: 500, marginTop: 8, letterSpacing: '0.5px' }}>
              the truth.
            </div>
          </div>

          {/* Send button */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'linear-gradient(90deg, #8B5CF6 0%, #F97316 100%)',
              borderRadius: 50,
              padding: '14px 36px',
              fontSize: 16,
              fontWeight: 700,
              color: '#ffffff',
              letterSpacing: '-0.2px',
            }}
          >
            Send anonymous message
          </div>

          {/* Domain tag */}
          <div
            style={{
              position: 'absolute',
              bottom: 28,
              display: 'flex',
              fontSize: 12,
              color: '#3A3A4E',
              letterSpacing: '0.5px',
            }}
          >
            whisprspace.com
          </div>
        </div>

        {/* Vertical divider */}
        <div
          style={{
            position: 'absolute',
            left: '55%',
            top: 0,
            bottom: 0,
            width: 1,
            background: 'linear-gradient(180deg, transparent, #2A2A38 20%, #2A2A38 80%, transparent)',
          }}
        />
      </div>
    ),
    { ...size }
  )
}
