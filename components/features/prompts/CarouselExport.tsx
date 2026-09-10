'use client'

import { useMemo, useRef, useState } from 'react'
import { Check, Copy, Download, Loader2 } from 'lucide-react'
import posthog from 'posthog-js'
import type { ExportSource } from '@/lib/prompts/export-types'
import { distributeReplies, type AspectRatio, type CarouselReply } from '@/lib/prompts/carousel-layout'
import { formatCaptionTemplate, formatPodcastTranscript, formatXThread } from '@/lib/prompts/text-exports'
import CarouselSlide, { type ExportSlide } from './CarouselSlide'

const ratioOptions: Array<{ value: AspectRatio; label: string; detail: string }> = [
  { value: 'square', label: '1:1', detail: 'Feed' },
  { value: 'portrait', label: '4:5', detail: 'Carousel' },
  { value: 'story', label: '9:16', detail: 'Story / TikTok' },
]

interface CarouselExportProps { source: ExportSource }

export default function CarouselExport({ source }: CarouselExportProps) {
  const starred = source.responses.filter((response) => response.is_starred)
  const maxReplies = source.isPremium ? 24 : 9
  const [selectedIds, setSelectedIds] = useState(() => starred.slice(0, maxReplies).map((response) => response.id))
  const [ratio, setRatio] = useState<AspectRatio>('portrait')
  const [isDownloading, setIsDownloading] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)
  const slideRefs = useRef<Array<HTMLDivElement | null>>([])

  const selected = useMemo<CarouselReply[]>(() => starred.filter((response) => selectedIds.includes(response.id)).slice(0, maxReplies).map((response) => ({ id: response.id, content: response.content })), [starred, selectedIds, maxReplies])
  const slides = useMemo<ExportSlide[]>(() => {
    if (!selected.length) return []
    const contentSlides = distributeReplies(selected, ratio, source.isPremium ? 8 : 3)
    return [{ kind: 'cover', featured: selected.slice(0, 2) }, ...contentSlides, { kind: 'cta', url: source.url, cta: source.finalCta }]
  }, [selected, ratio, source.isPremium, source.url, source.finalCta])

  const toggle = (id: string) => {
    setSelectedIds((current) => current.includes(id) ? current.filter((value) => value !== id) : current.length >= maxReplies ? current : [...current, id])
  }

  const download = async () => {
    if (!slides.length || isDownloading) return
    setIsDownloading(true)
    try {
      const { toPng } = await import('html-to-image')
      for (let index = 0; index < slides.length; index += 1) {
        const node = slideRefs.current[index]
        if (!node) continue
        const dataUrl = await toPng(node, { pixelRatio: 2, cacheBust: true, backgroundColor: '#0A0A10' })
        const link = document.createElement('a')
        link.href = dataUrl
        link.download = `whisprspace-${source.kind}-${source.id}-slide-${index + 1}.png`
        link.click()
      }
      try { posthog.capture(`${source.kind}_export_generated`, { [`${source.kind}_id`]: source.id, ratio, slides: slides.length, tier: source.isPremium ? 'premium' : 'free' }) } catch { /* analytics is optional */ }
    } finally { setIsDownloading(false) }
  }

  const copy = async (kind: 'x' | 'podcast' | 'caption') => {
    const value = kind === 'x' ? formatXThread(source, selected, source.url) : kind === 'podcast' ? formatPodcastTranscript(source, selected) : formatCaptionTemplate(source, source.url)
    await navigator.clipboard.writeText(value).catch(() => {})
    setCopied(kind); window.setTimeout(() => setCopied(null), 1600)
  }

  return <div className="space-y-7"><section className="rounded-2xl border border-[#23232E] bg-[#12121A] p-5"><h2 className="text-lg font-medium">Choose responses</h2><p className="mt-1 text-sm text-[#8F8FA3]">{source.kind === 'prompt' ? 'Your highlights are preselected.' : 'Choose the replies you want to feature.'} {source.isPremium ? 'Choose up to 24.' : 'Free exports include up to 9.'}</p><div className="mt-4 space-y-2">{starred.map((response) => <button key={response.id} type="button" onClick={() => toggle(response.id)} className={`flex w-full items-start gap-3 rounded-xl border p-3 text-left transition-colors ${selectedIds.includes(response.id) ? 'border-[#F97316]/50 bg-[#F97316]/[0.06]' : 'border-[#2A2A38] bg-white/[0.01]'}`}><span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border ${selectedIds.includes(response.id) ? 'border-[#F97316] bg-[#F97316] text-[#0A0A10]' : 'border-[#5C5C6E]'}`}>{selectedIds.includes(response.id) && <Check className="h-3.5 w-3.5" strokeWidth={3} />}</span><span className="text-sm leading-5 text-[#DFDFE7]">{response.content}</span></button>)}</div>{!starred.length && <p className="mt-4 text-sm text-[#8F8FA3]">Return to the source and select the responses you want to export.</p>}</section>
    <section className="rounded-2xl border border-[#23232E] bg-[#12121A] p-5"><h2 className="text-lg font-medium">Format</h2><div className="mt-4 grid grid-cols-3 gap-2">{ratioOptions.map((option) => <button key={option.value} type="button" onClick={() => setRatio(option.value)} className={`rounded-xl border py-3 text-center transition-colors ${ratio === option.value ? 'border-[#8B5CF6]/70 bg-[#8B5CF6]/15 text-white' : 'border-[#2A2A38] text-[#8F8FA3]'}`}><span className="block text-sm font-medium">{option.label}</span><span className="mt-1 block text-[11px]">{option.detail}</span></button>)}</div><p className="mt-4 text-sm text-[#8F8FA3]">{slides.length ? `${slides.length} slides: cover, ${source.kind === 'prompt' ? 'anonymous answers' : 'discussion replies'}, and a final link back to this ${source.kind}.` : 'Select at least one response to build your export.'}</p><button disabled={!slides.length || isDownloading} onClick={download} className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#8B5CF6] to-[#F97316] text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-40">{isDownloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}{isDownloading ? 'Preparing slides…' : 'Download carousel'}</button><p className="mt-2 text-center text-xs text-[#5C5C6E]">Your browser may ask to allow multiple downloads.</p></section>
    <section className="rounded-2xl border border-[#23232E] bg-[#12121A] p-5"><h2 className="text-lg font-medium">Text exports</h2><p className="mt-1 text-sm text-[#8F8FA3]">Your words stay exactly as submitted.</p><div className="mt-4 grid gap-2 sm:grid-cols-3">{([['x', 'Copy as X thread'], ['podcast', 'Podcast transcript'], ['caption', 'Caption + hashtags']] as const).map(([kind, label]) => <button key={kind} disabled={!selected.length} onClick={() => copy(kind)} className="flex h-11 items-center justify-center gap-2 rounded-xl border border-[#2A2A38] text-xs text-[#E6E6EC] hover:border-[#8B5CF6]/45 disabled:opacity-40"><Copy className="h-3.5 w-3.5" />{copied === kind ? 'Copied' : label}</button>)}</div></section>
    <div className="pointer-events-none fixed -left-[3000px] top-0">{slides.map((slide, index) => <CarouselSlide key={`${slide.kind}-${index}`} ref={(node) => { slideRefs.current[index] = node }} slide={slide} ratio={ratio} question={source.question} responseCount={source.responseCount} sourceKind={source.kind} />)}</div>
  </div>
}
