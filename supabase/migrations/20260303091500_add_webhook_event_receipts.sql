-- Webhook event receipts for replay protection and traceability
CREATE TABLE IF NOT EXISTS public.webhook_event_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL,
  event_key TEXT NOT NULL,
  event_type TEXT,
  payload_hash TEXT,
  status TEXT NOT NULL DEFAULT 'processing',
  error_message TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_webhook_event_receipts_provider_event_key
  ON public.webhook_event_receipts(provider, event_key);

CREATE INDEX IF NOT EXISTS idx_webhook_event_receipts_status
  ON public.webhook_event_receipts(status);

CREATE INDEX IF NOT EXISTS idx_webhook_event_receipts_received_at
  ON public.webhook_event_receipts(received_at DESC);

ALTER TABLE public.webhook_event_receipts ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'webhook_event_receipts'
      AND policyname = 'System can manage webhook event receipts'
  ) THEN
    CREATE POLICY "System can manage webhook event receipts"
    ON public.webhook_event_receipts
    FOR ALL
    USING (true)
    WITH CHECK (true);
  END IF;
END
$$;

GRANT ALL ON TABLE public.webhook_event_receipts TO authenticated, anon;
