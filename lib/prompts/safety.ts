/**
 * Prompts must invite a sender's own experience, never a rating or accusation
 * about a named third party. This catches the clear framing patterns; the main
 * blocklist remains the shared harm-language safety check.
 */
const THIRD_PARTY_PROMPT_PATTERNS = [
  /\b(?:rate|review|rank|expose|name and shame|drag)\b/i,
  /\b(?:is|was|are|were)\s+@?[a-z][\w.-]{1,}\s+(?:the\s+)?(?:worst|toxic|a liar|abusive|a cheat)/i,
  /\b(?:what do you think of|tell me about)\s+@/i,
]

export const hasThirdPartyPromptFraming = (question: string): boolean =>
  THIRD_PARTY_PROMPT_PATTERNS.some((pattern) => pattern.test(question))
