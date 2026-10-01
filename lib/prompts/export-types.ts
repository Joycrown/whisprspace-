import type { PromptResponse, PromptResponseFormat } from './types'

export type ExportSourceKind = 'prompt' | 'thread'

export const THREAD_EXPORT_LIMITS = { free: 3, premium: 7 } as const

export interface ExportChoiceMeta {
  options: string[]
  correctOptionIndex: number | null
}

export interface ExportSource {
  id: string
  kind: ExportSourceKind
  question: string
  responseCount: number
  isPremium: boolean
  maxReplies?: number
  responses: PromptResponse[]
  url: string
  finalCta: string
  responseFormat?: PromptResponseFormat
  choice?: ExportChoiceMeta
}
