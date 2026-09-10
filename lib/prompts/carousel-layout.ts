export type AspectRatio = 'square' | 'portrait' | 'story'

export interface CarouselReply {
  id: string
  content: string
}

export interface ReplySlide {
  kind: 'responses'
  replies: CarouselReply[]
}

const CHARACTER_BUDGET: Record<AspectRatio, number> = {
  square: 400,
  portrait: 510,
  story: 650,
}

/**
 * Pure response packing: it stays independent of React and the DOM so layout
 * rules can be exercised against real response-length distributions.
 */
export function distributeReplies(
  replies: CarouselReply[],
  ratio: AspectRatio,
  maxSlides: number
): ReplySlide[] {
  const budget = CHARACTER_BUDGET[ratio]
  const slides: ReplySlide[] = []
  let current: CarouselReply[] = []
  let currentLength = 0

  const commit = () => {
    if (current.length && slides.length < maxSlides) slides.push({ kind: 'responses', replies: current })
    current = []
    currentLength = 0
  }

  for (const reply of replies) {
    if (slides.length >= maxSlides) break
    const length = reply.content.trim().length
    const wouldOverflow = current.length > 0 && currentLength + length > budget
    const reachesReplyLimit = current.length >= 3
    if (wouldOverflow || reachesReplyLimit) commit()
    if (slides.length >= maxSlides) break

    current.push(reply)
    currentLength += length

    // A long answer gets its own readable slide instead of being crammed with
    // another response just to meet a fixed count.
    if (length >= budget * 0.62) commit()
  }
  commit()
  return slides
}
