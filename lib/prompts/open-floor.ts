import type { CreateThreadForm } from '@/types'

export const PROMPT_THREAD_DRAFT_KEY = 'whisprspace_prompt_thread_draft'

export interface PromptThreadDraft {
  promptId: string
  form: Partial<CreateThreadForm>
}
