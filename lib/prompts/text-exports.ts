import type { CarouselReply } from './carousel-layout'

const clean = (text: string) => text.trim().replace(/\s+/g, ' ')

export function formatXThread(source: { question: string; kind: 'prompt' | 'thread' }, replies: CarouselReply[], url: string): string {
  const intro = `${source.kind === 'prompt' ? 'Anonymous answers' : 'Selected replies'} to: “${clean(source.question)}”\n\nA thread 🧵`
  const posts = replies.map((reply, index) => `${index + 1}/${replies.length}\n${clean(reply.content)}`)
  return [intro, ...posts, `${source.kind === 'prompt' ? 'Answer anonymously' : 'Join the discussion'}: ${url}`].join('\n\n')
}

export function formatPodcastTranscript(source: { question: string; kind: 'prompt' | 'thread' }, replies: CarouselReply[]): string {
  const label = source.kind === 'prompt' ? 'ANONYMOUS' : 'REPLY'
  const answers = replies.map((reply, index) => `${label} ${index + 1}\n${clean(reply.content)}`).join('\n\n')
  return `WHISPRSPACE — ${source.kind === 'prompt' ? 'ANONYMOUS RESPONSES' : 'DISCUSSION REPLIES'}\n\nQUESTION\n${clean(source.question)}\n\n${answers}`
}

export function formatCaptionTemplate(source: { question: string; responseCount: number; finalCta: string; kind: 'prompt' | 'thread' }, url: string): string {
  const context = source.kind === 'prompt' ? `${source.responseCount} people answered anonymously.` : `${source.responseCount} replies were shared in this discussion.`
  return `I asked: “${clean(source.question)}”\n\n${context} Here are a few that stayed with me.\n\n${source.finalCta}: ${url}\n\n#WhisprSpace #RealTalk`
}
