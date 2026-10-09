import type { PromptMode, PromptResponseFormat } from './types'

export interface PublicAsk {
  id: string
  question: string
  mode: PromptMode
  expires_at: string | null
  deleted_at: string | null
  response_format: PromptResponseFormat
  options: string[] | null
  response_count: number
  is_official: boolean
  correct_option_index: number | null
  tally: number[] | null
}

export interface PublicAskResponse {
  id: string
  content: string | null
  option_index: number | null
  created_at: string
}

export interface PublicAskResponsesPage {
  items: PublicAskResponse[]
  nextCursor: string | null
}
