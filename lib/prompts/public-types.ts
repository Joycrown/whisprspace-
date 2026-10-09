import type { PromptMode, PromptResponseFormat } from './types'

export const ASK_REACTIONS = ['same', 'bold', 'oof'] as const
export type AskReaction = (typeof ASK_REACTIONS)[number]

export const ASK_SORTS = ['latest', 'felt'] as const
export type AskSort = (typeof ASK_SORTS)[number]

export interface PublicAsk {
  id: string
  question: string
  mode: PromptMode
  expires_at: string | null
  deleted_at: string | null
  response_format: PromptResponseFormat
  options: string[] | null
  response_count: number
  view_count: number
  is_official: boolean
  correct_option_index: number | null
  tally: number[] | null
}

export interface PublicAskResponse {
  id: string
  content: string | null
  option_index: number | null
  created_at: string
  same_count: number
  bold_count: number
  oof_count: number
  reaction_total: number
}

export interface PublicAskResponsesPage {
  items: PublicAskResponse[]
  nextCursor: string | null
}

export interface AskViewerState {
  answered: boolean
  ownResponseIds: string[]
  reactions: Record<string, AskReaction[]>
}

export interface AskReactionResult {
  active: boolean
  same: number
  bold: number
  oof: number
}
