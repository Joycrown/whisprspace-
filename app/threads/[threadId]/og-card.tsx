import { ImageResponse } from 'next/og'
import { createClient } from '@supabase/supabase-js'
import { extractThreadIdFromRef } from '@/lib/threads/thread-url'

export const OG_SIZE = { width: 1200, height: 630 }

const CATEGORY_COLORS: Record<string, string> = {
  personal:      '#a855f7',
  relationships: '#3b82f6',
  career:        '#10b981',
  mental_health: '#f59e0b',
  family:        '#ec4899',
  finance:       '#06b6d4',
  society:       '#8b5cf6',
  confession:    '#ef4444',
  general:       '#6366f1',
}

function categoryColor(cat: string | null): string {
  return CATEGORY_COLORS[(cat || '').toLowerCase()] ?? '#6366f1'
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text
  return text.slice(0, max - 1) + '…'
}

function getBaseHost(): string {
  const url =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    'https://whisprspace.com'
  try { return new URL(url).host } catch { return 'whisprspace.com' }
}

export async function renderThreadOgCard(threadRef: string): Promise<ImageResponse> {
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

  const threadId = extractThreadIdFromRef(threadRef)

  let title    = 'Anonymous Thread'
  let content  = 'An honest conversation happening right now on WhisprSpace.'
  let category = 'general'

  if (threadId) {
    const { data } = await supabaseAdmin
      .from('threads')
      .select('title, content, category')
      .eq('id', threadId)
      .maybeSingle()

    if (data) {
      title    = data.title?.trim()   || title
      content  = data.content?.trim() || content
      category = data.category        || category
    }
  }

  const accent         = categoryColor(category)
  const displayTitle   = truncate(title,   72)
  const displayContent = truncate(content, 120)
  const categoryLabel  = (category || 'General').replace(/_/g, ' ')
  const baseHost       = getBaseHost()

  return new ImageResponse(
    (
      <div
        style={{
          width: '1200px',
          height: '630px',
          display: 'flex',
          flexDirection: 'column',
          background: '#0A0A10',
          fontFamily: 'system-ui, sans-serif',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Purple/category glow — top left */}
        <div style={{
          position: 'absolute',
          top: '-120px', left: '-80px',
          width: '500px', height: '500px',
          borderRadius: '50%',
          background: `linear-gradient(135deg, ${accent}44 0%, transparent 70%)`,
          display: 'flex',
        }} />

        {/* Indigo glow — bottom right */}
        <div style={{
          position: 'absolute',
          bottom: '-100px', right: '-60px',
          width: '400px', height: '400px',
          borderRadius: '50%',
          background: 'linear-gradient(315deg, rgba(99,102,241,0.22) 0%, transparent 70%)',
          display: 'flex',
        }} />

        {/* Top accent bar */}
        <div style={{
          position: 'absolute',
          top: 0, left: 0, right: 0,
          height: '5px',
          background: `linear-gradient(90deg, ${accent} 0%, #8B5CF6 50%, #F97316 100%)`,
          display: 'flex',
        }} />

        {/* Main layout */}
        <div style={{
          display: 'flex',
          flexDirection: 'row',
          height: '100%',
        }}>

          {/* LEFT — headline + content */}
          <div style={{
            width: '62%',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            padding: '60px 56px 52px 64px',
            position: 'relative',
          }}>
            {/* Wordmark */}
            <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '0px' }}>
              <span style={{ fontSize: 24, fontWeight: 800, color: '#8B5CF6', letterSpacing: '-0.3px' }}>Whispr</span>
              <span style={{ fontSize: 24, fontWeight: 800, color: '#F97316', letterSpacing: '-0.3px' }}>Space</span>
            </div>

            {/* Thread title */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              <div style={{
                fontSize: displayTitle.length > 50 ? 36 : displayTitle.length > 30 ? 44 : 52,
                fontWeight: 900,
                lineHeight: 1.2,
                letterSpacing: '-0.03em',
                color: '#F2F2F6',
                display: 'flex',
                flexWrap: 'wrap',
              }}>
                {displayTitle}
              </div>

              {displayContent && displayContent !== displayTitle && (
                <div style={{
                  fontSize: 26,
                  fontWeight: 600,
                  lineHeight: 1.5,
                  color: '#64748b',
                  display: 'flex',
                  flexWrap: 'wrap',
                }}>
                  {displayContent}
                </div>
              )}
            </div>

            {/* Footer */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  width: '9px', height: '9px',
                  borderRadius: '50%',
                  background: '#4ade80',
                  display: 'flex',
                }} />
                <span style={{ fontSize: 20, color: '#4ade80', fontWeight: 600 }}>Open now</span>
              </div>
              <span style={{ fontSize: 18, fontWeight: 600, color: '#3A3A4E', letterSpacing: '0.02em' }}>
                {baseHost}
              </span>
            </div>
          </div>

          {/* DIVIDER */}
          <div style={{
            width: '1px',
            margin: '52px 0',
            background: 'linear-gradient(180deg, transparent 0%, #2A2A38 20%, #2A2A38 80%, transparent 100%)',
            display: 'flex',
          }} />

          {/* RIGHT — category badge + engagement CTA */}
          <div style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '48px 40px',
            gap: '28px',
          }}>
            {/* Category pill */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              background: `${accent}1A`,
              border: `1px solid ${accent}55`,
              borderRadius: '100px',
              padding: '10px 22px',
            }}>
              <div style={{
                width: '10px', height: '10px',
                borderRadius: '50%',
                background: accent,
                display: 'flex',
              }} />
              <span style={{
                fontSize: 18,
                fontWeight: 700,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                color: accent,
              }}>
                {categoryLabel}
              </span>
            </div>

            {/* Icon circle */}
            <div style={{
              width: '96px', height: '96px',
              borderRadius: '50%',
              background: `linear-gradient(135deg, ${accent}33 0%, #1A1A2E 100%)`,
              border: `2px solid ${accent}44`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <div style={{
                fontSize: '44px',
                display: 'flex',
              }}>💬</div>
            </div>

            {/* CTA label */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: 20, color: '#8F8FA3', fontWeight: 700, display: 'flex' }}>
                Anonymous discussion
              </span>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'linear-gradient(90deg, #8B5CF6 0%, #F97316 100%)',
                borderRadius: '50px',
                padding: '16px 32px',
                marginTop: '4px',
              }}>
                <span style={{ fontSize: 22, fontWeight: 700, color: '#ffffff', letterSpacing: '-0.2px', display: 'flex' }}>
                  Join the conversation →
                </span>
              </div>
            </div>

            {/* No name. No trace. */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#5DCAA5', display: 'flex' }} />
              <span style={{ fontSize: 18, fontWeight: 700, color: '#5C5C6E', letterSpacing: '0.2px', display: 'flex' }}>
                No name. No trace. Always anonymous.
              </span>
            </div>
          </div>
        </div>
      </div>
    ),
    { ...OG_SIZE }
  )
}
