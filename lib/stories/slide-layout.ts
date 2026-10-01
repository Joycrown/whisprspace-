export const MAX_BODY_SLIDES = 2
export const CHARS_PER_SLIDE = 420

export const SLIDE_HOOKS = [
  'The discussion will leave you hanging.',
  'The replies are a story of their own.',
  'The ending isn’t here. It’s in the replies.',
  'What people said next split the discussions.',
  'The discussion is like nothing you’ve seen before.',
  'Everyone has a take. Wait till you read them.',
  'The story ends here. The discussion doesn’t.',
  'The discussion is even wilder than the story.',
  'You’ll want to read what happened in the discussions.',
  'The story is only half of it. The discussion is the rest.',
]

export function pickSlideHook(seed: string): string {
  let hash = 0
  for (let index = 0; index < seed.length; index += 1) hash = (hash * 31 + seed.charCodeAt(index)) >>> 0
  return SLIDE_HOOKS[hash % SLIDE_HOOKS.length]
}

function splitSentences(paragraph: string): string[] {
  return paragraph.match(/[^.!?…]+[.!?…]+["'”’)]*\s*|[^.!?…]+$/g)?.map((part) => part.trim()).filter(Boolean) ?? [paragraph]
}

function splitLong(text: string, budget: number): string[] {
  const words = text.split(/\s+/)
  const parts: string[] = []
  let current = ''
  for (const word of words) {
    if ((current ? current.length + 1 : 0) + word.length > budget && current) {
      parts.push(current)
      current = word
    } else {
      current = current ? `${current} ${word}` : word
    }
  }
  if (current) parts.push(current)
  return parts
}

export function chunkStoryText(body: string, maxSlides: number = MAX_BODY_SLIDES): { chunks: string[]; truncated: boolean } {
  const budget = CHARS_PER_SLIDE
  const units = body
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.replace(/\s*\n\s*/g, ' ').trim())
    .filter(Boolean)
    .flatMap((paragraph) => (paragraph.length <= budget ? [paragraph] : splitSentences(paragraph).flatMap((sentence) => (sentence.length <= budget ? [sentence] : splitLong(sentence, budget)))))

  const chunks: string[] = []
  let current = ''
  for (const unit of units) {
    const joined = current ? `${current}\n\n${unit}` : unit
    if (joined.length > budget && current) {
      chunks.push(current)
      current = unit
    } else {
      current = joined
    }
  }
  if (current) chunks.push(current)

  if (chunks.length <= maxSlides) return { chunks, truncated: false }
  const kept = chunks.slice(0, maxSlides)
  kept[kept.length - 1] = `${kept[kept.length - 1].replace(/[.!?…]*$/, '')}…`
  return { chunks: kept, truncated: true }
}
