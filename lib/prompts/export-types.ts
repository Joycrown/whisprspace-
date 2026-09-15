import type { PromptResponse, PromptResponseFormat } from './types'

export type ExportSourceKind = 'prompt' | 'thread'

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
  responses: PromptResponse[]
  url: string
  finalCta: string
  responseFormat?: PromptResponseFormat
  choice?: ExportChoiceMeta
}
