export type AspectRatio = 'square' | 'portrait' | 'story'

export interface CarouselReply {
  id: string
  content: string
  optionLabel?: string | null
}

export interface ReplySlide {
  kind: 'responses'
  replies: CarouselReply[]
}

/**
 * One response per slide, capped at maxSlides. Pure and DOM-free so it can be
 * exercised against real response-length distributions without any rendering.
 */
export function distributeReplies(
  replies: CarouselReply[],
  ratio: AspectRatio,
  maxSlides: number
): ReplySlide[] {
  void ratio
  return replies.slice(0, maxSlides).map((reply) => ({ kind: 'responses', replies: [reply] }))
}
