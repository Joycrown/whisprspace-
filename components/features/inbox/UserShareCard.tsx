'use client'

import { forwardRef } from 'react'

interface UserShareCardProps {
  displayName: string
  handle: string
  inboxUrl: string
}

/**
 * 1920×1080 (16:9) card for WhatsApp Status, Twitter, etc.
 * Captured to PNG via html-to-image.
 */
const UserShareCard = forwardRef<HTMLDivElement, UserShareCardProps>(
  ({ displayName, handle, inboxUrl }, ref) => {
    const shortUrl = inboxUrl.replace(/^https?:\/\//, '')
    const initial = displayName.charAt(0).toUpperCase()
    const nameFontSize = displayName.length > 12 ? 56 : displayName.length > 8 ? 72 : 88

    return (
      <div
        ref={ref}
        style={{
          width: 1920,
          height: 1080,
          display: 'flex',
          flexDirection: 'row',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
          background: '#0A0A10',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Top gradient accent bar */}
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 5,
          background: 'linear-gradient(90deg, #8B5CF6 0%, #F97316 100%)',
          zIndex: 2,
        }} />

        {/* Purple glow — top left */}
        <div style={{
          position: 'absolute',
          top: -160,
          left: -160,
          width: 800,
          height: 800,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(139,92,246,0.18) 0%, transparent 65%)',
        }} />

        {/* Orange glow — bottom right */}
        <div style={{
          position: 'absolute',
          bottom: -160,
          right: -80,
          width: 700,
          height: 700,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(249,115,22,0.14) 0%, transparent 65%)',
        }} />

        {/* ── LEFT — headline ── */}
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '80px 100px',
          position: 'relative',
          zIndex: 1,
        }}>
          {/* Wordmark */}
          <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center' }}>
            <span style={{ fontSize: 36, fontWeight: 800, color: '#8B5CF6', letterSpacing: '-0.5px' }}>Whispr</span>
            <span style={{ fontSize: 36, fontWeight: 800, color: '#F97316', letterSpacing: '-0.5px' }}>Space</span>
          </div>

          {/* Headline */}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{
              fontSize: 18,
              fontWeight: 600,
              color: '#3A3A4E',
              letterSpacing: '4px',
              textTransform: 'uppercase',
              marginBottom: 28,
            }}>
              Anonymous Inbox
            </div>
            <div style={{ fontSize: 112, fontWeight: 900, color: '#F2F2F6', lineHeight: 1.05, letterSpacing: '-4px' }}>
              The truth
            </div>
            <div style={{ fontSize: 112, fontWeight: 900, color: '#F2F2F6', lineHeight: 1.05, letterSpacing: '-4px' }}>
              you&apos;ve been
            </div>
            <div style={{ fontSize: 112, fontWeight: 900, color: 'rgba(242,242,246,0.22)', lineHeight: 1.05, letterSpacing: '-4px' }}>
              holding back.
            </div>
          </div>

          {/* Footer tag */}
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#5DCAA5', marginRight: 14 }} />
            <span style={{ fontSize: 20, color: '#5C5C6E', letterSpacing: '0.3px' }}>
              No name · No trace · Always anonymous
            </span>
          </div>
        </div>

        {/* ── DIVIDER ── */}
        <div style={{
          width: 1,
          margin: '80px 0',
          background: 'linear-gradient(180deg, transparent, #2A2A38 20%, #2A2A38 80%, transparent)',
          flexShrink: 0,
          zIndex: 1,
        }} />

        {/* ── RIGHT — recipient ── */}
        <div style={{
          width: 620,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '80px 80px',
          position: 'relative',
          zIndex: 1,
          gap: 32,
        }}>
          {/* Avatar */}
          <div style={{
            width: 160,
            height: 160,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #8B5CF6 0%, #F97316 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}>
            <span style={{ fontSize: 68, fontWeight: 800, color: '#ffffff' }}>{initial}</span>
          </div>

          {/* Name block */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 22, color: '#5C5C6E', fontWeight: 500, letterSpacing: '1px' }}>Tell</span>
            <span style={{
              fontSize: nameFontSize,
              fontWeight: 800,
              color: '#F2F2F6',
              letterSpacing: '-2px',
              lineHeight: 1,
              textAlign: 'center',
            }}>
              {displayName}
            </span>
            <span style={{ fontSize: 22, color: '#5C5C6E', fontWeight: 500, letterSpacing: '1px' }}>the truth.</span>
          </div>

          {/* CTA pill */}
          <div style={{
            background: 'linear-gradient(90deg, #8B5CF6 0%, #F97316 100%)',
            borderRadius: 50,
            padding: '22px 0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '100%',
          }}>
            <span style={{ fontSize: 24, fontWeight: 700, color: '#ffffff', letterSpacing: '-0.3px' }}>
              Send anonymous message →
            </span>
          </div>

          {/* URL */}
          <span style={{ fontSize: 18, color: '#3A3A4E', letterSpacing: '0.3px', textAlign: 'center' }}>
            {shortUrl}
          </span>
        </div>
      </div>
    )
  }
)

UserShareCard.displayName = 'UserShareCard'
export default UserShareCard
