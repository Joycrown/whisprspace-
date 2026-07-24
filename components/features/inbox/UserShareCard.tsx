'use client'

import { forwardRef } from 'react'

interface UserShareCardProps {
  displayName: string
  handle: string
  inboxUrl: string
}

/**
 * 1200×675 (16:9) share card.
 * - CSS animations make it look alive on screen.
 * - html-to-image captures a sharp static PNG frame for download.
 */
const UserShareCard = forwardRef<HTMLDivElement, UserShareCardProps>(
  ({ displayName, handle, inboxUrl }, ref) => {
    const shortUrl = inboxUrl.replace(/^https?:\/\//, '')
    const initial = displayName.charAt(0).toUpperCase()
    const nameFontSize = displayName.length > 12 ? 36 : displayName.length > 8 ? 44 : 54

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
            50%       { box-shadow: 0 0 0 4px rgba(139,92,246,0.25), 0 0 0 10px rgba(249,115,22,0.08); }
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
            width: 1200,
            height: 675,
            display: 'flex',
            flexDirection: 'row',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
            background: '#0A0A10',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {/* Animated top accent bar */}
          <div className="whispr-top-bar" style={{
            position: 'absolute',
            top: 0, left: 0, right: 0,
            height: 4,
            zIndex: 3,
          }} />

          {/* Animated purple glow — top left */}
          <div className="whispr-glow-purple" style={{
            position: 'absolute',
            top: -100, left: -100,
            width: 500, height: 500,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(139,92,246,0.18) 0%, transparent 65%)',
          }} />

          {/* Animated orange glow — bottom right */}
          <div className="whispr-glow-orange" style={{
            position: 'absolute',
            bottom: -100, right: -60,
            width: 420, height: 420,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(249,115,22,0.14) 0%, transparent 65%)',
          }} />

          {/* Floating particle 1 */}
          <div className="whispr-float-1" style={{
            position: 'absolute',
            top: 120, left: 180,
            width: 6, height: 6,
            borderRadius: '50%',
            background: '#8B5CF6',
          }} />
          {/* Floating particle 2 */}
          <div className="whispr-float-2" style={{
            position: 'absolute',
            top: 320, left: 520,
            width: 4, height: 4,
            borderRadius: '50%',
            background: '#F97316',
          }} />
          {/* Floating particle 3 */}
          <div className="whispr-float-3" style={{
            position: 'absolute',
            bottom: 140, left: 300,
            width: 5, height: 5,
            borderRadius: '50%',
            background: '#5DCAA5',
          }} />

          {/* ── LEFT — headline ── */}
          <div style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            padding: '48px 60px',
            position: 'relative',
            zIndex: 1,
          }}>
            {/* Wordmark */}
            <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center' }}>
              <span style={{ fontSize: 22, fontWeight: 800, color: '#8B5CF6', letterSpacing: '-0.3px' }}>Whispr</span>
              <span style={{ fontSize: 22, fontWeight: 800, color: '#F97316', letterSpacing: '-0.3px' }}>Space</span>
            </div>

            {/* Headline */}
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{
                fontSize: 11,
                fontWeight: 600,
                color: '#3A3A4E',
                letterSpacing: '3px',
                textTransform: 'uppercase',
                marginBottom: 20,
              }}>
                Anonymous Inbox
              </div>
              <div style={{ fontSize: 70, fontWeight: 900, color: '#F2F2F6', lineHeight: 1.05, letterSpacing: '-2.5px' }}>
                The truth
              </div>
              <div style={{ fontSize: 70, fontWeight: 900, color: '#F2F2F6', lineHeight: 1.05, letterSpacing: '-2.5px' }}>
                you&apos;ve been
              </div>
              <div style={{ fontSize: 70, fontWeight: 900, color: 'rgba(242,242,246,0.20)', lineHeight: 1.05, letterSpacing: '-2.5px' }}>
                holding back.
              </div>
            </div>

            {/* Footer */}
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <div className="whispr-dot" style={{ width: 6, height: 6, borderRadius: '50%', background: '#5DCAA5', marginRight: 10, flexShrink: 0 }} />
              <span style={{ fontSize: 13, color: '#5C5C6E', letterSpacing: '0.2px' }}>
                No name · No trace · Always anonymous
              </span>
            </div>
          </div>

          {/* ── DIVIDER ── */}
          <div style={{
            width: 1,
            margin: '48px 0',
            background: 'linear-gradient(180deg, transparent, #2A2A38 20%, #2A2A38 80%, transparent)',
            flexShrink: 0,
            zIndex: 1,
          }} />

          {/* ── RIGHT — recipient ── */}
          <div style={{
            width: 380,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '48px 44px',
            position: 'relative',
            zIndex: 1,
            gap: 20,
          }}>
            {/* Avatar with animated ring */}
            <div className="whispr-avatar" style={{
              width: 100,
              height: 100,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #8B5CF6 0%, #F97316 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}>
              <span style={{ fontSize: 42, fontWeight: 800, color: '#ffffff' }}>{initial}</span>
            </div>

            {/* Name block */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <span style={{ fontSize: 13, color: '#5C5C6E', fontWeight: 500, letterSpacing: '0.5px' }}>Tell</span>
              <span style={{
                fontSize: nameFontSize,
                fontWeight: 800,
                color: '#F2F2F6',
                letterSpacing: '-1.5px',
                lineHeight: 1,
                textAlign: 'center',
              }}>
                {displayName}
              </span>
              <span style={{ fontSize: 13, color: '#5C5C6E', fontWeight: 500, letterSpacing: '0.5px' }}>the truth.</span>
            </div>

            {/* Animated shimmer CTA */}
            <div className="whispr-shimmer-cta" style={{
              borderRadius: 50,
              padding: '14px 0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '100%',
            }}>
              <span style={{ fontSize: 15, fontWeight: 700, color: '#ffffff', letterSpacing: '-0.2px' }}>
                Send anonymous message →
              </span>
            </div>

            {/* URL */}
            <span style={{ fontSize: 11, color: '#3A3A4E', letterSpacing: '0.2px', textAlign: 'center' }}>
              {shortUrl}
            </span>
          </div>
        </div>
      </>
    )
  }
)

UserShareCard.displayName = 'UserShareCard'
export default UserShareCard
