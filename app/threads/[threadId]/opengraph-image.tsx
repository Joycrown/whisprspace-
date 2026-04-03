import { ImageResponse } from 'next/og'
import { createClient } from '@supabase/supabase-js'
import { extractThreadIdFromRef } from '@/lib/threads/thread-url'

export const runtime = 'edge'
export const alt = 'WhisprSpace Thread'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
)

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

export default async function Image({ params }: { params: { threadId: string } }) {
  const threadId = extractThreadIdFromRef(params.threadId)

  let title = 'Anonymous Thread'
  let content = 'An honest conversation happening right now on WhisprSpace.'
  let category = 'general'

  if (threadId) {
    const { data } = await supabaseAdmin
      .from('threads')
      .select('title, content, category')
      .eq('id', threadId)
      .maybeSingle()

    if (data) {
      title   = data.title?.trim()   || title
      content = data.content?.trim() || content
      category = data.category       || category
    }
  }

  const accent = categoryColor(category)
  const displayTitle   = truncate(title,   72)
  const displayContent = truncate(content, 120)
  const categoryLabel  = (category || 'General').replace(/_/g, ' ')

  return new ImageResponse(
    (
      <div
        style={{
          width: '1200px',
          height: '630px',
          display: 'flex',
          flexDirection: 'column',
          background: '#0d0d12',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Gradient glow top-left */}
        <div style={{
          position: 'absolute',
          top: '-120px',
          left: '-80px',
          width: '500px',
          height: '500px',
          borderRadius: '50%',
          background: `radial-gradient(circle, ${accent}33 0%, transparent 70%)`,
          display: 'flex',
        }} />

        {/* Gradient glow bottom-right */}
        <div style={{
          position: 'absolute',
          bottom: '-100px',
          right: '-60px',
          width: '400px',
          height: '400px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, #6366f122 0%, transparent 70%)',
          display: 'flex',
        }} />

        {/* Top accent bar */}
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '4px',
          background: `linear-gradient(90deg, ${accent}, #6366f1, #3b82f6)`,
          display: 'flex',
        }} />

        {/* Main content */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '60px 72px 56px',
          height: '100%',
          boxSizing: 'border-box',
        }}>

          {/* Header — wordmark + category pill */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{
              fontSize: '22px',
              fontWeight: 700,
              letterSpacing: '0.04em',
              color: '#ffffff',
            }}>
              WhisprSpace
            </span>

            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: `${accent}22`,
              border: `1px solid ${accent}55`,
              borderRadius: '100px',
              padding: '6px 18px',
            }}>
              <div style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: accent,
                display: 'flex',
              }} />
              <span style={{
                fontSize: '13px',
                fontWeight: 600,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                color: accent,
              }}>
                {categoryLabel}
              </span>
            </div>
          </div>

          {/* Thread title */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{
              fontSize: displayTitle.length > 50 ? '38px' : '46px',
              fontWeight: 800,
              lineHeight: 1.25,
              letterSpacing: '-0.03em',
              color: '#f1f5f9',
              display: 'flex',
            }}>
              {displayTitle}
            </div>

            {displayContent && displayContent !== displayTitle && (
              <div style={{
                fontSize: '22px',
                fontWeight: 400,
                lineHeight: 1.6,
                color: '#64748b',
                display: 'flex',
              }}>
                {displayContent}
              </div>
            )}
          </div>

          {/* Footer */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{
                width: '10px',
                height: '10px',
                borderRadius: '50%',
                background: '#4ade80',
                display: 'flex',
              }} />
              <span style={{ fontSize: '16px', color: '#4ade80', fontWeight: 600 }}>
                Open now
              </span>
            </div>

            <span style={{
              fontSize: '15px',
              color: '#334155',
              letterSpacing: '0.02em',
            }}>
              app.whisprspace.com
            </span>
          </div>

        </div>
      </div>
    ),
    { ...size }
  )
}
