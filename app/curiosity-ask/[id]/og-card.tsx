import { ImageResponse } from 'next/og'
import { supabaseAdmin } from '@/lib/core/supabase/admin-client'
import { extractPromptIdFromRef } from '@/lib/prompts/prompt-url'

export async function renderPromptOgCard(id: string): Promise<ImageResponse> {
  const promptId = extractPromptIdFromRef(id)
  const { data } = promptId
    ? await supabaseAdmin.from('prompts').select('question, expires_at').eq('id', promptId).maybeSingle()
    : { data: null }
  const question = data?.question || 'Answer this anonymously.'
  const hours = data ? Math.max(0, Math.ceil((new Date(data.expires_at).getTime() - Date.now()) / (60 * 60 * 1000))) : 0

  return new ImageResponse(
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '54px 64px', boxSizing: 'border-box', color: '#F2F2F6', background: 'radial-gradient(100% 95% at 0% 0%, #2A1947 0%, #0A0A10 58%)', fontFamily: 'system-ui, sans-serif', position: 'relative' }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 6, display: 'flex', background: 'linear-gradient(90deg, #8B5CF6, #F97316)' }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 23, fontWeight: 700 }}><span style={{ color: '#C4B5FD' }}>WhisprSpace</span><span style={{ color: '#8F8FA3', fontSize: 17, textTransform: 'uppercase', letterSpacing: '0.14em' }}>Curiosity Ask</span></div>
      <div style={{ display: 'flex', flexDirection: 'column', maxWidth: 960 }}><span style={{ color: '#F97316', fontSize: 20, fontWeight: 700, letterSpacing: '0.13em', textTransform: 'uppercase', marginBottom: 24 }}>Answer honestly</span><span style={{ fontSize: question.length > 105 ? 48 : 62, fontWeight: 800, letterSpacing: '-1.7px', lineHeight: 1.1 }}>{question}</span></div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #2A2A38', paddingTop: 26 }}><span style={{ color: '#8F8FA3', fontSize: 21 }}>No name. No trace.</span><span style={{ color: '#5DCAA5', fontSize: 21, fontWeight: 700 }}>Closes in {hours}h</span></div>
    </div>,
    { width: 1200, height: 630 }
  )
}
