export const PROMPT_CATEGORIES = ['work', 'money', 'love', 'family', 'campus', 'general'] as const
export const PROMPT_DURATIONS = ['24h', '48h', '7d'] as const

export type PromptCategory = (typeof PROMPT_CATEGORIES)[number]
export type PromptDuration = (typeof PROMPT_DURATIONS)[number]
export type PromptMode = 'private' | 'open'

export interface PromptLibraryItem {
  key: string
  question: string
  category: PromptCategory
  personas: string[]
}

export interface Prompt {
  id: string
  creator_id: string
  question: string
  mode: PromptMode
  category: PromptCategory
  library_key: string | null
  response_count: number
  expires_at: string
  is_saved: boolean
  created_at: string
}

export interface PromptResponse {
  id: string
  prompt_id: string
  content: string
  is_starred: boolean
  starred_at: string | null
  created_at: string
}

export interface PromptDetail extends Prompt {
  responses: PromptResponse[]
  is_premium: boolean
}
