'use client'

import { forwardRef } from 'react'
import { FaFacebook, FaInstagram, FaThreads, FaTiktok, FaXTwitter } from 'react-icons/fa6'
import type { AspectRatio, CarouselReply, ReplySlide } from '@/lib/prompts/carousel-layout'

const SOCIAL_HANDLE = '@whisprspace'
const WEB_DOMAIN = 'app.whisprspace.com'
const SOCIAL_ICONS = [FaInstagram, FaTiktok, FaXTwitter, FaFacebook, FaThreads]

export type ExportSlide =
  | { kind: 'cover' }
  | ReplySlide
  | { kind: 'cta'; url: string; cta: string }

interface CarouselSlideProps {
  slide: ExportSlide
  ratio: AspectRatio
  question: string
  responseCount: number
  sourceKind: 'prompt' | 'thread'
}

const dimensions: Record<AspectRatio, { width: number; height: number }> = {
  square: { width: 1080, height: 1080 },
  portrait: { width: 1080, height: 1350 },
  story: { width: 1080, height: 1920 },
}

const CarouselSlide = forwardRef<HTMLDivElement, CarouselSlideProps>(
  ({ slide, ratio, question, responseCount, sourceKind }, ref) => {
    const { width, height } = dimensions[ratio]
    const isStory = ratio === 'story'
    const questionFontSize = question.length > 100 ? 46 : isStory ? 66 : 58
    const isPrompt = sourceKind === 'prompt'

    return (
      <div ref={ref} style={{ width, height, boxSizing: 'border-box', padding: isStory ? '82px 76px' : '68px 72px', background: 'radial-gradient(120% 80% at 0% 0%, #2A1947 0%, #0A0A10 58%)', color: '#F2F2F6', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 7, background: 'linear-gradient(90deg, #8B5CF6, #F97316, #8B5CF6)' }} />
        <div style={{ position: 'absolute', right: -180, bottom: -140, width: 570, height: 570, borderRadius: '50%', background: 'radial-gradient(circle, rgba(249,115,22,0.17), transparent 68%)' }} />
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: isStory ? 70 : 48 }}>
          <span style={{ color: '#C4B5FD', fontSize: 26, fontWeight: 800 }}>WhisprSpace</span>
          <span style={{ color: '#5C5C6E', fontSize: 17, letterSpacing: '0.12em', textTransform: 'uppercase' }}>{isPrompt ? 'Anonymous answers' : 'Discussion replies'}</span>
        </div>

        {slide.kind === 'cover' && (
          <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', justifyContent: 'center', flex: 1 }}>
            <div style={{ color: '#F97316', fontSize: 20, letterSpacing: '0.14em', fontWeight: 700, textTransform: 'uppercase', marginBottom: 25 }}>{isPrompt ? 'The question' : 'The discussion'}</div>
            <div style={{ fontSize: questionFontSize, lineHeight: 1.1, fontWeight: 800, letterSpacing: '-1.8px' }}>{question}</div>
            <div style={{ marginTop: 48, display: 'inline-flex', alignSelf: 'flex-start', alignItems: 'center', gap: 14, borderRadius: 999, padding: '16px 28px', background: 'rgba(139,92,246,0.12)', border: '1px solid rgba(139,92,246,0.3)' }}>
              <span style={{ color: '#C4B5FD', fontSize: isStory ? 30 : 26, fontWeight: 800 }}>{responseCount}</span>
              <span style={{ color: '#B9B9C6', fontSize: isStory ? 21 : 19 }}>{isPrompt ? 'anonymous answers' : 'replies'}</span>
            </div>
          </div>
        )}

        {slide.kind === 'responses' && (
          <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'center', gap: 22 }}>
            {slide.replies.map((reply) => (
              <div key={reply.id} style={{ border: '1px solid #29283A', borderRadius: 28, padding: isStory ? '48px 40px' : '40px 40px', background: 'rgba(255,255,255,0.035)' }}>
                <div style={{ color: '#F97316', fontSize: 17, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 20 }}>{isPrompt ? 'Anonymous' : 'Reply'}</div>
                <div style={{ color: '#ECECF1', fontSize: isStory ? 40 : 34, lineHeight: 1.4, fontWeight: 600 }}>&ldquo;{reply.content}&rdquo;</div>
              </div>
            ))}
          </div>
        )}

        {slide.kind === 'cta' && (
          <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center', flex: 1 }}>
            <div style={{ color: '#F97316', fontSize: 20, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 28 }}>Your turn</div>
            <div style={{ fontSize: isStory ? 72 : 62, lineHeight: 1.08, fontWeight: 800, letterSpacing: '-2px', maxWidth: 780 }}>{slide.cta}.</div>
            <div style={{ marginTop: 44, borderRadius: 999, padding: '20px 32px', background: 'linear-gradient(100deg, #8B5CF6, #F97316)', color: '#fff', fontSize: 23, fontWeight: 700 }}>{isPrompt ? 'No name. No trace.' : 'Join the conversation.'}</div>
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
  },
)

CarouselSlide.displayName = 'CarouselSlide'

export default CarouselSlide
