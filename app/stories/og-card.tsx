import { ImageResponse } from 'next/og'
import { getStoryPage } from '@/lib/stories/server'
import { extractStoryIdFromRef } from '@/lib/stories/story-url'
import { CATEGORY_META } from '@/lib/stories/types'

const frame = {
  width: '100%',
  height: '100%',
  display: 'flex',
  flexDirection: 'column' as const,
  justifyContent: 'space-between',
  padding: '54px 64px',
  boxSizing: 'border-box' as const,
  color: '#F2F2F6',
  background: 'radial-gradient(100% 95% at 0% 0%, #2A1947 0%, #0A0A10 58%)',
  fontFamily: 'system-ui, sans-serif',
  position: 'relative' as const,
}

function Shell({ label, children, footer }: { label: string; children: React.ReactNode; footer: string }) {
  return (
    <div style={frame}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 6, display: 'flex', background: 'linear-gradient(90deg, #8B5CF6, #F97316)' }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 23, fontWeight: 700 }}>
        <span style={{ color: '#C4B5FD' }}>WhisprSpace</span>
        <span style={{ color: '#8F8FA3', fontSize: 17, textTransform: 'uppercase', letterSpacing: '0.14em' }}>{label}</span>
      </div>
      {children}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #2A2A38', paddingTop: 26 }}>
        <span style={{ color: '#8F8FA3', fontSize: 21 }}>Shared anonymously</span>
        <span style={{ color: '#5DCAA5', fontSize: 21, fontWeight: 700 }}>{footer}</span>
      </div>
    </div>
  )
}

export function renderStoriesOgCard(): ImageResponse {
  return new ImageResponse(
    <Shell label="Stories" footer="Read, relate, reply">
      <div style={{ display: 'flex', flexDirection: 'column', maxWidth: 980 }}>
        <span style={{ color: '#F97316', fontSize: 20, fontWeight: 700, letterSpacing: '0.13em', textTransform: 'uppercase', marginBottom: 24 }}>True stories · Fiction · Poetry</span>
        <span style={{ fontSize: 66, fontWeight: 800, letterSpacing: '-1.8px', lineHeight: 1.08 }}>Real stories. Written ones too.</span>
      </div>
    </Shell>,
    { width: 1200, height: 630 }
  )
}

export async function renderStoryOgCard(ref: string): Promise<ImageResponse> {
  const id = extractStoryIdFromRef(ref)
  const story = id ? await getStoryPage(id).catch(() => null) : null
  if (!story) return renderStoriesOgCard()

  const meta = CATEGORY_META[story.category]
  const excerpt = story.is_sensitive ? 'Contains sensitive themes. Tap to read with care.' : story.excerpt.slice(0, 150)
  const footer = story.is_episodic ? `${story.episode_count} ${story.episode_count === 1 ? 'episode' : 'episodes'}` : `${story.reply_count} ${story.reply_count === 1 ? 'comment' : 'comments'}`

  return new ImageResponse(
    <Shell label={meta.label} footer={footer}>
      <div style={{ display: 'flex', flexDirection: 'column', maxWidth: 1000 }}>
        <span
          style={{
            display: 'flex',
            alignSelf: 'flex-start',
            color: story.family === 'true_story' ? '#7FE0BF' : '#C4B5FD',
            border: `2px solid ${story.family === 'true_story' ? 'rgba(93,202,165,0.45)' : 'rgba(139,92,246,0.45)'}`,
            borderRadius: 999,
            padding: '6px 18px',
            fontSize: 19,
            fontWeight: 800,
            letterSpacing: '0.12em',
            marginBottom: 22,
          }}
        >
          {meta.tag}
        </span>
        <span style={{ fontSize: story.title.length > 70 ? 48 : 60, fontWeight: 800, letterSpacing: '-1.6px', lineHeight: 1.1 }}>{story.title}</span>
        <span style={{ marginTop: 20, fontSize: 24, lineHeight: 1.45, color: '#B9B9C6' }}>{excerpt}{!story.is_sensitive && story.excerpt.length > 150 ? '…' : ''}</span>
      </div>
    </Shell>,
    { width: 1200, height: 630 }
  )
}
