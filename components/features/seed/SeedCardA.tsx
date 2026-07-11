'use client'

import { forwardRef } from 'react'

interface SeedCardAProps {
  handle: string
  inboxUrl: string
}

/**
 * Card A — 1080×1920 portrait card for WhatsApp Status sharing.
 * Rendered as a DOM element then captured via html-to-image in the admin UI.
 * Dimensions are fixed at 1080×1920 to match WhatsApp Status aspect ratio.
 */
const SeedCardA = forwardRef<HTMLDivElement, SeedCardAProps>(({ handle, inboxUrl }, ref) => {
  const initial = handle.charAt(0).toUpperCase()
  const shortUrl = inboxUrl.replace(/^https?:\/\//, '')

  return (
    <div
      ref={ref}
      style={{
        width: 1080,
        height: 1920,
        background: 'linear-gradient(160deg, #0e0e0e 0%, #111118 60%, #0d0d16 100%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Background glow */}
      <div style={{
        position: 'absolute',
        top: '30%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: 700,
        height: 700,
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(126,34,206,0.18) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      {/* Top brand mark */}
      <div style={{
        position: 'absolute',
        top: 80,
        left: 0,
        right: 0,
        display: 'flex',
        justifyContent: 'center',
      }}>
        <div style={{
          padding: '10px 32px',
          borderRadius: 999,
          border: '1px solid rgba(147,51,234,0.35)',
          background: 'rgba(147,51,234,0.10)',
          color: '#c084fc',
          fontSize: 26,
          fontWeight: 700,
          letterSpacing: '0.08em',
        }}>
          WhisprSpace
        </div>
      </div>

      {/* Main content */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '0 96px',
        zIndex: 1,
      }}>
        {/* Avatar */}
        <div style={{
          width: 180,
          height: 180,
          borderRadius: '50%',
          background: 'rgba(126,34,206,0.20)',
          border: '2px solid rgba(147,51,234,0.45)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 44,
          boxShadow: '0 0 60px rgba(126,34,206,0.25)',
        }}>
          <span style={{ fontSize: 80, fontWeight: 800, color: '#d8b4fe' }}>{initial}</span>
        </div>

        {/* Handle */}
        <p style={{
          fontSize: 44,
          fontWeight: 600,
          color: 'rgba(255,255,255,0.45)',
          letterSpacing: '0.04em',
          marginBottom: 28,
        }}>
          @{handle}
        </p>

        {/* Headline */}
        <h1 style={{
          fontSize: 88,
          fontWeight: 800,
          color: '#ffffff',
          textAlign: 'center',
          lineHeight: 1.08,
          marginBottom: 48,
          letterSpacing: '-0.02em',
        }}>
          Say what you can&apos;t say to my face.
        </h1>

        {/* Subline */}
        <p style={{
          fontSize: 40,
          color: 'rgba(156,163,175,0.85)',
          textAlign: 'center',
          lineHeight: 1.45,
          marginBottom: 72,
          maxWidth: 760,
        }}>
          No name. No trace. Just what you actually think.
        </p>

        {/* URL pill */}
        <div style={{
          padding: '22px 56px',
          borderRadius: 999,
          border: '1.5px solid rgba(147,51,234,0.50)',
          background: 'rgba(126,34,206,0.15)',
          backdropFilter: 'blur(8px)',
        }}>
          <span style={{
            fontSize: 36,
            fontWeight: 700,
            color: '#c084fc',
            letterSpacing: '0.02em',
          }}>
            {shortUrl}
          </span>
        </div>
      </div>

      {/* Bottom strip */}
      <div style={{
        position: 'absolute',
        bottom: 80,
        left: 0,
        right: 0,
        display: 'flex',
        justifyContent: 'center',
      }}>
        <p style={{
          fontSize: 28,
          color: 'rgba(107,114,128,0.8)',
          letterSpacing: '0.03em',
        }}>
          Anonymous. Always.
        </p>
      </div>
    </div>
  )
})

SeedCardA.displayName = 'SeedCardA'
export default SeedCardA
