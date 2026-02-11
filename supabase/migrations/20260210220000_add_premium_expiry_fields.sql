-- Add premium subscription tracking fields
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS premium_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS premium_provider TEXT,
  ADD COLUMN IF NOT EXISTS premium_last_tx_ref TEXT,
  ADD COLUMN IF NOT EXISTS premium_reminder_sent_for TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_users_premium_expires_at ON public.users(premium_expires_at);
