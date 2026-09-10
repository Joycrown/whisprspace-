'use client'

import { forwardRef } from 'react'

interface PromptShareCardProps {
  question: string
  creatorName: string
  expiresAt: string
  promptUrl: string
}

const PromptShareCard = forwardRef<HTMLDivElement, PromptShareCardProps>(
  ({ question, creatorName, expiresAt, promptUrl }, ref) => {
    const hoursLeft = Math.max(0, Math.ceil((new Date(expiresAt).getTime() - Date.now()) / (1000 * 60 * 60)))
    const shortUrl = promptUrl.replace(/^https?:\/\//, '')

    return (
      <div
        ref={ref}
        style={{
          width: 1080,
          height: 1080,
          position: 'relative',
          overflow: 'hidden',
          boxSizing: 'border-box',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '76px 82px',
          background: 'radial-gradient(100% 80% at 12% 0%, #2b1c4c 0%, #0A0A10 58%)',
          color: '#F2F2F6',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        }}
      >
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 7, background: 'linear-gradient(90deg, #8B5CF6, #F97316, #8B5CF6)' }} />
        <div style={{ position: 'absolute', right: -140, bottom: -120, width: 540, height: 540, borderRadius: '50%', background: 'radial-gradient(circle, rgba(249,115,22,0.2), transparent 68%)' }} />

        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ color: '#C4B5FD', fontWeight: 800, fontSize: 30, letterSpacing: '-0.8px' }}>WhisprSpace</span>
          <span style={{ color: '#8F8FA3', fontSize: 22, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Curiosity Ask</span>
        </div>

        <div style={{ position: 'relative' }}>
          <div style={{ color: '#F97316', fontSize: 23, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 34 }}>Answer honestly</div>
          <div style={{ fontSize: question.length > 100 ? 56 : 72, lineHeight: 1.08, fontWeight: 800, letterSpacing: '-2px', maxWidth: 850 }}>
            {question}
          </div>
        </div>

        <div style={{ position: 'relative', borderTop: '1px solid #2A2A38', paddingTop: 34 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
            <span style={{ color: '#8F8FA3', fontSize: 25 }}>Asked by {creatorName}</span>
            <span style={{ color: '#5DCAA5', fontSize: 25, fontWeight: 700 }}>Closes in {hoursLeft}h</span>
          </div>
          <div style={{ display: 'inline-flex', padding: '19px 30px', borderRadius: 999, background: 'linear-gradient(100deg, #8B5CF6, #F97316)', fontSize: 26, fontWeight: 750 }}>
            Share your answer →
          </div>
          <div style={{ color: '#5C5C6E', fontSize: 21, marginTop: 24 }}>{shortUrl}</div>
        </div>
      </div>
    )
  }
)

PromptShareCard.displayName = 'PromptShareCard'
export default PromptShareCard
