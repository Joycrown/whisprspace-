export const PROMPT_CATEGORIES = ['work', 'money', 'love', 'family', 'campus', 'general', 'icebreakers'] as const
export const PROMPT_DURATIONS = ['24h', '48h', '7d'] as const
export const PROMPT_RESPONSE_FORMATS = ['text', 'choice'] as const

export type PromptCategory = (typeof PROMPT_CATEGORIES)[number]
export type PromptDuration = (typeof PROMPT_DURATIONS)[number]
export type PromptMode = 'private' | 'open'
export type PromptResponseFormat = (typeof PROMPT_RESPONSE_FORMATS)[number]

export interface PromptLibraryItem {
  key: string
  question: string
  category: PromptCategory
  personas: string[]
  responseFormat?: PromptResponseFormat
  options?: string[]
  correctOptionIndex?: number
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
  export_count: number
  response_format: PromptResponseFormat
  options: string[] | null
  created_at: string
}

export interface PromptResponse {
  id: string
  prompt_id: string
  content: string | null
  is_starred: boolean
  starred_at: string | null
  option_index: number | null
  created_at: string
}

export interface PromptDetail extends Prompt {
  responses: PromptResponse[]
  is_premium: boolean
  // Only ever populated on the creator-authenticated manage route — never
  // present in any public-facing response, matching the boundary that
  // already keeps response content creator-only.
  correct_option_index: number | null
}
