'use client'

import { forwardRef } from 'react'

interface UserShareCardProps {
  displayName: string
  handle: string
  inboxUrl: string
}

/**
 * 1080×1080 (1:1) square share card — built for Instagram/status downloads.
 * - Single centered column: wordmark → headline → avatar → recipient → CTA → URL → trust badges.
 * - CSS animations make it look alive on screen.
 * - html-to-image captures a sharp static PNG frame for download (pixelRatio 1 → 1080px PNG).
 */
const UserShareCard = forwardRef<HTMLDivElement, UserShareCardProps>(
  ({ displayName, inboxUrl }, ref) => {
    const shortUrl = inboxUrl.replace(/^https?:\/\//, '')
    const initial = displayName.charAt(0).toUpperCase()
    const nameFontSize = displayName.length > 12 ? 44 : displayName.length > 8 ? 54 : 64

    return (
      <>
        <style>{`
          @keyframes whispr-pulse-purple {
            0%, 100% { opacity: 0.18; transform: scale(1); }
            50%       { opacity: 0.30; transform: scale(1.08); }
          }
          @keyframes whispr-pulse-orange {
            0%, 100% { opacity: 0.12; transform: scale(1); }
            50%       { opacity: 0.22; transform: scale(1.1); }
          }
          @keyframes whispr-float-1 {
            0%, 100% { transform: translateY(0px) translateX(0px); opacity: 0.35; }
            33%       { transform: translateY(-14px) translateX(6px); opacity: 0.55; }
            66%       { transform: translateY(8px) translateX(-4px); opacity: 0.25; }
          }
          @keyframes whispr-float-2 {
            0%, 100% { transform: translateY(0px) translateX(0px); opacity: 0.20; }
            40%       { transform: translateY(12px) translateX(-8px); opacity: 0.45; }
            70%       { transform: translateY(-6px) translateX(5px); opacity: 0.15; }
          }
          @keyframes whispr-float-3 {
            0%, 100% { transform: translateY(0px); opacity: 0.15; }
            50%       { transform: translateY(-18px); opacity: 0.40; }
          }
          @keyframes whispr-shimmer {
            0%   { background-position: -200% center; }
            100% { background-position: 200% center; }
          }
          @keyframes whispr-bar {
            0%   { background-position: 0% center; }
            100% { background-position: 200% center; }
          }
          @keyframes whispr-avatar-ring {
            0%, 100% { box-shadow: 0 0 0 0px rgba(139,92,246,0.5), 0 0 0 6px rgba(249,115,22,0.15); }
            50%       { box-shadow: 0 0 0 5px rgba(139,92,246,0.25), 0 0 0 12px rgba(249,115,22,0.08); }
          }
          @keyframes whispr-dot-blink {
            0%, 100% { opacity: 1; }
            50%       { opacity: 0.3; }
          }
          .whispr-glow-purple { animation: whispr-pulse-purple 4s ease-in-out infinite; }
          .whispr-glow-orange { animation: whispr-pulse-orange 5s ease-in-out infinite 1s; }
          .whispr-float-1 { animation: whispr-float-1 6s ease-in-out infinite; }
          .whispr-float-2 { animation: whispr-float-2 8s ease-in-out infinite 2s; }
          .whispr-float-3 { animation: whispr-float-3 7s ease-in-out infinite 1s; }
          .whispr-shimmer-cta {
            background: linear-gradient(90deg, #8B5CF6 0%, #F97316 40%, #fff6 50%, #F97316 60%, #8B5CF6 100%);
            background-size: 200% auto;
            animation: whispr-shimmer 3s linear infinite;
          }
          .whispr-top-bar {
            background: linear-gradient(90deg, #8B5CF6, #F97316, #8B5CF6);
            background-size: 200% auto;
            animation: whispr-bar 4s linear infinite;
          }
          .whispr-avatar { animation: whispr-avatar-ring 3s ease-in-out infinite; }
          .whispr-dot { animation: whispr-dot-blink 2s ease-in-out infinite; }
        `}</style>

        <div
          ref={ref}
          style={{
            width: 1080,
            height: 1080,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
            background: 'radial-gradient(120% 90% at 20% 0%, #14101F 0%, #0A0A10 55%)',
            position: 'relative',
            overflow: 'hidden',
            padding: '72px 80px 64px',
            boxSizing: 'border-box',
          }}
        >
          {/* Animated top accent bar */}
          <div className="whispr-top-bar" style={{
            position: 'absolute',
            top: 0, left: 0, right: 0,
            height: 5,
            zIndex: 3,
          }} />

          {/* Animated purple glow — top left */}
          <div className="whispr-glow-purple" style={{
            position: 'absolute',
            top: -140, left: -120,
            width: 560, height: 560,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(139,92,246,0.20) 0%, transparent 65%)',
          }} />

          {/* Animated orange glow — bottom right */}
          <div className="whispr-glow-orange" style={{
            position: 'absolute',
            bottom: -140, right: -100,
            width: 480, height: 480,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(249,115,22,0.14) 0%, transparent 65%)',
          }} />

          {/* Floating particles */}
          <div className="whispr-float-1" style={{ position: 'absolute', top: 180, left: 200, width: 7, height: 7, borderRadius: '50%', background: '#8B5CF6' }} />
          <div className="whispr-float-2" style={{ position: 'absolute', top: 440, right: 160, width: 5, height: 5, borderRadius: '50%', background: '#F97316' }} />
          <div className="whispr-float-3" style={{ position: 'absolute', bottom: 300, left: 260, width: 6, height: 6, borderRadius: '50%', background: '#5DCAA5' }} />

          {/* ── Wordmark ── */}
          <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', zIndex: 1 }}>
            <span style={{ fontSize: 30, fontWeight: 800, color: '#8B5CF6', letterSpacing: '-0.4px' }}>Whispr</span>
            <span style={{ fontSize: 30, fontWeight: 800, color: '#F97316', letterSpacing: '-0.4px' }}>Space</span>
          </div>

          {/* ── Center column ── */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            zIndex: 1,
            width: '100%',
          }}>
            {/* Eyebrow */}
            <div style={{
              fontSize: 14,
              fontWeight: 600,
              color: '#5C5C6E',
              letterSpacing: '5px',
              textTransform: 'uppercase',
              marginBottom: 28,
            }}>
              Anonymous Inbox
            </div>

            {/* Headline */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 56 }}>
              <div style={{ fontSize: 96, fontWeight: 900, color: '#F2F2F6', lineHeight: 1.02, letterSpacing: '-3px', textAlign: 'center' }}>
                The truth
              </div>
              <div style={{ fontSize: 96, fontWeight: 900, color: '#F2F2F6', lineHeight: 1.02, letterSpacing: '-3px', textAlign: 'center' }}>
                you&apos;ve been
              </div>
              <div style={{ fontSize: 96, fontWeight: 900, color: 'rgba(242,242,246,0.20)', lineHeight: 1.02, letterSpacing: '-3px', textAlign: 'center' }}>
                holding back.
              </div>
            </div>

            {/* Avatar with animated ring */}
            <div className="whispr-avatar" style={{
              width: 116,
              height: 116,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #8B5CF6 0%, #F97316 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              marginBottom: 22,
            }}>
              <span style={{ fontSize: 48, fontWeight: 800, color: '#ffffff' }}>{initial}</span>
            </div>

            {/* Recipient */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, marginBottom: 36 }}>
              <span style={{ fontSize: 16, color: '#5C5C6E', fontWeight: 500, letterSpacing: '0.5px' }}>Tell</span>
              <span style={{ fontSize: nameFontSize, fontWeight: 800, color: '#F2F2F6', letterSpacing: '-1.5px', lineHeight: 1, textAlign: 'center' }}>
                {displayName}
              </span>
              <span style={{ fontSize: 16, color: '#5C5C6E', fontWeight: 500, letterSpacing: '0.5px' }}>the truth.</span>
            </div>

            {/* Shimmer CTA */}
            <div className="whispr-shimmer-cta" style={{
              borderRadius: 60,
              padding: '20px 56px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 20,
            }}>
              <span style={{ fontSize: 20, fontWeight: 700, color: '#ffffff', letterSpacing: '-0.2px' }}>
                Send anonymous message →
              </span>
            </div>

            {/* URL */}
            <span style={{ fontSize: 15, color: '#4A4A5C', letterSpacing: '0.3px', textAlign: 'center' }}>
              {shortUrl}
            </span>
          </div>

          {/* ── Trust badges ── */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 22,
            zIndex: 1,
            width: '100%',
          }}>
            <div style={{
              display: 'flex',
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              width: '100%',
              padding: '22px 40px',
              borderRadius: 20,
              border: '1px solid #1E1E2A',
              background: 'rgba(255,255,255,0.02)',
              boxSizing: 'border-box',
            }}>
              <TrustBadge icon="shield" color="#8B5CF6" title="100% Anonymous" subtitle="No identity. No trace." />
              <div style={{ width: 1, height: 44, background: '#1E1E2A', flexShrink: 0 }} />
              <TrustBadge icon="lock" color="#F97316" title="Safe & Private" subtitle="Your secret stays secret." />
              <div style={{ width: 1, height: 44, background: '#1E1E2A', flexShrink: 0 }} />
              <TrustBadge icon="heart" color="#EC4899" title="Honest Connections" subtitle="Real feedback. Real growth." />
            </div>

            {/* Footer trust line */}
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <div className="whispr-dot" style={{ width: 7, height: 7, borderRadius: '50%', background: '#5DCAA5', marginRight: 12, flexShrink: 0 }} />
              <span style={{ fontSize: 15, color: '#5C5C6E', letterSpacing: '0.2px' }}>
                No name. No trace. Always anonymous.
              </span>
            </div>
          </div>
        </div>
      </>
    )
  }
)

/** Icon + two-line label used in the bottom trust-badge row. */
function TrustBadge({ icon, color, title, subtitle }: { icon: 'shield' | 'lock' | 'heart'; color: string; title: string; subtitle: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 14 }}>
      <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <TrustIcon icon={icon} color={color} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <span style={{ fontSize: 17, fontWeight: 700, color: '#F2F2F6', letterSpacing: '-0.3px', lineHeight: 1.2 }}>{title}</span>
        <span style={{ fontSize: 13, color: '#5C5C6E', letterSpacing: '0.1px', lineHeight: 1.3 }}>{subtitle}</span>
      </div>
    </div>
  )
}

/** Inline SVG icons so html-to-image captures them reliably (no icon-font dependency). */
function TrustIcon({ icon, color }: { icon: 'shield' | 'lock' | 'heart'; color: string }) {
  const common = { width: 28, height: 28, viewBox: '0 0 24 24', fill: 'none', stroke: color, strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
  if (icon === 'shield') {
    return (
      <svg {...common}>
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </svg>
    )
  }
  if (icon === 'lock') {
    return (
      <svg {...common}>
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
      </svg>
    )
  }
  return (
    <svg {...common}>
      <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1L12 21l7.7-7.6 1.1-1a5.5 5.5 0 0 0 0-7.8z" />
    </svg>
  )
}

UserShareCard.displayName = 'UserShareCard'
export default UserShareCard
