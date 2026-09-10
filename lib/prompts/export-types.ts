import type { PromptResponse } from './types'

export type ExportSourceKind = 'prompt' | 'thread'

export interface ExportSource {
  id: string
  kind: ExportSourceKind
  question: string
  responseCount: number
  isPremium: boolean
  responses: PromptResponse[]
  url: string
  finalCta: string
}
