import { ImageResponse } from 'next/og'

// Edge file-convention entry for crawlers that auto-discover opengraph-image.
// The og:image meta in layout.tsx points at /og (Node route, has Content-Length)
// which is what WhatsApp actually fetches.
export const runtime = 'edge'
export const revalidate = 86400
export const alt = 'WhisprSpace — Anonymous Social Platform'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

function getBaseHost(): string {
  const url =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    'https://whisprspace.com'
  try { return new URL(url).host } catch { return 'whisprspace.com' }
}

export default function Image() {
  const baseHost = getBaseHost()

  return new ImageResponse(
    (
      <div
        style={{
          width: '1200px',
          height: '630px',
          display: 'flex',
          flexDirection: 'row',
          fontFamily: 'system-ui, sans-serif',
          background: '#0A0A10',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '5px', background: 'linear-gradient(90deg, #8B5CF6 0%, #F97316 100%)', display: 'flex' }} />
        <div style={{ position: 'absolute', top: '-160px', left: '-100px', width: '600px', height: '600px', borderRadius: '50%', background: 'linear-gradient(135deg, rgba(139,92,246,0.30) 0%, transparent 68%)', display: 'flex' }} />
        <div style={{ position: 'absolute', bottom: '-140px', right: '-80px', width: '520px', height: '520px', borderRadius: '50%', background: 'linear-gradient(315deg, rgba(249,115,22,0.22) 0%, transparent 68%)', display: 'flex' }} />

        <div style={{ width: '58%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '60px 56px 52px 68px', position: 'relative' }}>
          <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center' }}>
            <span style={{ fontSize: 28, fontWeight: 800, color: '#8B5CF6', letterSpacing: '-0.4px' }}>Whispr</span>
            <span style={{ fontSize: 28, fontWeight: 800, color: '#F97316', letterSpacing: '-0.4px' }}>Space</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#5C5C6E', letterSpacing: '4px', textTransform: 'uppercase', marginBottom: 24, display: 'flex' }}>Anonymous Social Platform</div>
            <div style={{ fontSize: 72, fontWeight: 900, color: '#F2F2F6', lineHeight: 1.02, letterSpacing: '-2.5px', display: 'flex' }}>Speak freely.</div>
            <div style={{ fontSize: 72, fontWeight: 900, color: '#F2F2F6', lineHeight: 1.02, letterSpacing: '-2.5px', display: 'flex' }}>Stay</div>
            <div style={{ fontSize: 72, fontWeight: 900, color: 'rgba(242,242,246,0.22)', lineHeight: 1.02, letterSpacing: '-2.5px', display: 'flex' }}>anonymous.</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center' }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#5DCAA5', marginRight: 11, display: 'flex' }} />
            <span style={{ fontSize: 15, color: '#5C5C6E', letterSpacing: '0.2px', display: 'flex' }}>No name. No trace. Always anonymous.</span>
          </div>
        </div>

        <div style={{ width: '1px', margin: '52px 0', background: 'linear-gradient(180deg, transparent 0%, #2A2A38 20%, #2A2A38 80%, transparent 100%)', display: 'flex' }} />

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 44px', gap: '20px' }}>
          {[
            { icon: '💬', label: 'Anonymous Threads' },
            { icon: '📥', label: 'Anonymous Inbox' },
            { icon: '💰', label: 'Earn with Premium' },
          ].map((f) => (
            <div key={f.label} style={{ display: 'flex', alignItems: 'center', gap: '14px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '14px', padding: '14px 22px', width: '100%' }}>
              <span style={{ fontSize: 26, display: 'flex' }}>{f.icon}</span>
              <span style={{ fontSize: 18, fontWeight: 600, color: '#C4B5FD', display: 'flex' }}>{f.label}</span>
            </div>
          ))}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(90deg, #8B5CF6 0%, #F97316 100%)', borderRadius: '50px', padding: '16px 36px', marginTop: '8px' }}>
            <span style={{ fontSize: 18, fontWeight: 700, color: '#ffffff', letterSpacing: '-0.2px', display: 'flex' }}>Join for free →</span>
          </div>
          <span style={{ fontSize: 13, color: '#3A3A4E', letterSpacing: '0.3px', display: 'flex' }}>{baseHost}</span>
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  )
}
