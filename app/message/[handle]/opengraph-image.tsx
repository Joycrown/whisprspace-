import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const contentType = 'image/png';
export const size = { width: 1200, height: 630 };

interface Props {
  params: Promise<{ handle: string }>;
}

export default async function OgImage({ params }: Props) {
  const { handle } = await params;
  const displayName = decodeURIComponent(handle);
  const initial = displayName.charAt(0).toUpperCase();

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
          background: '#111111',
          fontFamily: 'sans-serif',
          padding: '60px',
        }}
      >
        {/* Avatar */}
        <div
          style={{
            width: 120,
            height: 120,
            borderRadius: '50%',
            background: 'rgba(147, 51, 234, 0.25)',
            border: '2px solid rgba(147, 51, 234, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 32,
          }}
        >
          <span style={{ fontSize: 52, fontWeight: 700, color: '#d8b4fe' }}>
            {initial}
          </span>
        </div>

        {/* Headline */}
        <div
          style={{
            fontSize: 52,
            fontWeight: 700,
            color: '#ffffff',
            textAlign: 'center',
            lineHeight: 1.2,
            marginBottom: 20,
            maxWidth: 900,
          }}
        >
          Tell {displayName} the truth.
        </div>

        {/* Subline */}
        <div
          style={{
            fontSize: 26,
            color: '#9ca3af',
            textAlign: 'center',
            marginBottom: 48,
          }}
        >
          No name. No trace. Just what you actually think.
        </div>

        {/* Brand pill */}
        <div
          style={{
            padding: '10px 28px',
            borderRadius: 999,
            border: '1px solid rgba(147, 51, 234, 0.4)',
            background: 'rgba(147, 51, 234, 0.15)',
            color: '#c084fc',
            fontSize: 20,
            fontWeight: 600,
            letterSpacing: '0.05em',
          }}
        >
          WhisprSpace
        </div>
      </div>
    ),
    { ...size }
  );
}
