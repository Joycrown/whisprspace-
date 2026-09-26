'use client'

import { forwardRef } from 'react'
import { FaFacebook, FaInstagram, FaThreads, FaTiktok, FaXTwitter } from 'react-icons/fa6'
import type { AspectRatio } from '@/lib/prompts/carousel-layout'
import { CATEGORY_META, type StoryCategory, type StoryFamily } from '@/lib/stories/types'

const SOCIAL_HANDLE = '@whisprspace'
const WEB_DOMAIN = 'app.whisprspace.com'
const SOCIAL_ICONS = [FaInstagram, FaTiktok, FaXTwitter, FaFacebook, FaThreads]

export type StorySlideData =
  | { kind: 'cover'; episodeNumber: number | null }
  | { kind: 'body'; text: string; index: number; total: number; truncated: boolean }
  | { kind: 'cta'; hook: string }

interface StorySlideProps {
  slide: StorySlideData
  ratio: AspectRatio
  title: string
  category: StoryCategory
  family: StoryFamily
}

const dimensions: Record<AspectRatio, { width: number; height: number }> = {
  square: { width: 1080, height: 1080 },
  portrait: { width: 1080, height: 1350 },
  story: { width: 1080, height: 1920 },
}

const StorySlide = forwardRef<HTMLDivElement, StorySlideProps>(({ slide, ratio, title, category, family }, ref) => {
  const { width, height } = dimensions[ratio]
  const isStory = ratio === 'story'
  const meta = CATEGORY_META[category]
  const isTrue = family === 'true_story'
  const tagColor = isTrue ? '#7FE0BF' : '#C4B5FD'
  const tagBorder = isTrue ? 'rgba(93,202,165,0.45)' : 'rgba(139,92,246,0.45)'

  return (
    <div ref={ref} style={{ width, height, boxSizing: 'border-box', padding: isStory ? '82px 76px' : '68px 72px', background: 'radial-gradient(120% 80% at 0% 0%, #2A1947 0%, #0A0A10 58%)', color: '#F2F2F6', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 7, background: 'linear-gradient(90deg, #8B5CF6, #F97316, #8B5CF6)' }} />
      <div style={{ position: 'absolute', right: -180, bottom: -140, width: 570, height: 570, borderRadius: '50%', background: 'radial-gradient(circle, rgba(249,115,22,0.15), transparent 68%)' }} />
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: isStory ? 64 : 44 }}>
        <span style={{ color: '#C4B5FD', fontSize: 26, fontWeight: 800 }}>WhisprSpace</span>
        <span style={{ color: tagColor, border: `2px solid ${tagBorder}`, borderRadius: 999, padding: '8px 18px', fontSize: 17, fontWeight: 800, letterSpacing: '0.12em' }}>{meta.tag}</span>
      </div>

      {slide.kind === 'cover' && (
        <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', justifyContent: 'center', flex: 1 }}>
          <div style={{ color: '#F97316', fontSize: 21, letterSpacing: '0.14em', fontWeight: 700, textTransform: 'uppercase', marginBottom: 26 }}>
            {meta.label}{slide.episodeNumber ? ` · Episode ${slide.episodeNumber}` : ''}
          </div>
          <div style={{ fontSize: title.length > 70 ? 58 : isStory ? 78 : 70, lineHeight: 1.08, fontWeight: 800, letterSpacing: '-2px' }}>{title}</div>
          <div style={{ marginTop: 44, color: '#8F8FA3', fontSize: isStory ? 26 : 23 }}>Shared anonymously</div>
        </div>
      )}

      {slide.kind === 'body' && (
        <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'center' }}>
          <div style={{ color: '#ECECF1', fontSize: isStory ? 40 : ratio === 'portrait' ? 36 : 33, lineHeight: 1.55, fontWeight: 500, whiteSpace: 'pre-wrap' }}>{slide.text}</div>
          <div style={{ marginTop: 36, display: 'flex', justifyContent: 'space-between', color: '#5C5C6E', fontSize: 19 }}>
            <span>{slide.truncated && slide.index === slide.total ? 'Continued on WhisprSpace' : ''}</span>
            <span>{slide.index}/{slide.total}</span>
          </div>
        </div>
      )}

      {slide.kind === 'cta' && (
        <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center', flex: 1 }}>
          <div style={{ color: '#F97316', fontSize: 20, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 22 }}>Read the full story on WhisprSpace</div>
          <div style={{ color: '#DFDFE7', fontSize: isStory ? 34 : 30, lineHeight: 1.25, fontWeight: 600, maxWidth: 820, fontStyle: 'italic' }}>&ldquo;{title}&rdquo;</div>
          <div style={{ marginTop: 36, fontSize: isStory ? 64 : 54, lineHeight: 1.1, fontWeight: 800, letterSpacing: '-1.8px', maxWidth: 820 }}>{slide.hook}</div>
          <div style={{ marginTop: 44, borderRadius: 999, padding: '20px 32px', background: 'linear-gradient(100deg, #8B5CF6, #F97316)', color: '#fff', fontSize: 23, fontWeight: 700 }}>{WEB_DOMAIN}</div>
          <div style={{ marginTop: 46, display: 'flex', alignItems: 'center', gap: 20 }}>
            {SOCIAL_ICONS.map((Icon, index) => (
              <Icon key={index} size={isStory ? 34 : 30} color="#C4B5FD" />
            ))}
          </div>
          <div style={{ marginTop: 20, color: '#8F8FA3', fontSize: 20, fontWeight: 600 }}>{SOCIAL_HANDLE}</div>
          <div style={{ marginTop: 6, color: '#5C5C6E', fontSize: 18 }}>{WEB_DOMAIN}</div>
        </div>
      )}
    </div>
  )
})

StorySlide.displayName = 'StorySlide'

export default StorySlide
