import type { SupabaseClient } from '@supabase/supabase-js'

type ClaimWebhookEventInput = {
  supabase: SupabaseClient
  provider: string
  eventKey: string
  eventType?: string
  payloadHash?: string
  metadata?: Record<string, unknown>
}

type ClaimWebhookEventResult = {
  duplicate: boolean
  receiptId: string | null
}

type CompleteWebhookEventInput = {
  supabase: SupabaseClient
  receiptId: string
  status: 'processed' | 'failed'
  errorMessage?: string
}

export const claimWebhookEvent = async ({
  supabase,
  provider,
  eventKey,
  eventType,
  payloadHash,
  metadata,
}: ClaimWebhookEventInput): Promise<ClaimWebhookEventResult> => {
  const { data, error } = await supabase
    .from('webhook_event_receipts')
    .insert({
      provider,
      event_key: eventKey,
      event_type: eventType || null,
      payload_hash: payloadHash || null,
      status: 'processing',
      metadata: metadata || {},
    })
    .select('id')
    .single()

  if (!error && data?.id) {
    return { duplicate: false, receiptId: String(data.id) }
  }

  if (error?.code === '23505') {
    return { duplicate: true, receiptId: null }
  }

  throw error || new Error('Failed to claim webhook event')
}

export const completeWebhookEvent = async ({
  supabase,
  receiptId,
  status,
  errorMessage,
}: CompleteWebhookEventInput): Promise<void> => {
  const payload = {
    status,
    processed_at: new Date().toISOString(),
    error_message: errorMessage || null,
  }

  await supabase
    .from('webhook_event_receipts')
    .update(payload)
    .eq('id', receiptId)
}
