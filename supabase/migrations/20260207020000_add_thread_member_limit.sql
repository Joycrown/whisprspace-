-- Migration: Add member_limit to threads for invite-only privacy
-- Date: 2026-02-07

ALTER TABLE public.threads
ADD COLUMN IF NOT EXISTS member_limit INTEGER;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'threads_member_limit_positive'
      AND conrelid = 'public.threads'::regclass
  ) THEN
    ALTER TABLE public.threads
    ADD CONSTRAINT threads_member_limit_positive
    CHECK (member_limit IS NULL OR member_limit > 0);
  END IF;
END $$;

-- Backfill defaults for invite-only threads
UPDATE public.threads
SET member_limit = 10
WHERE privacy = 'invite_only'
  AND member_limit IS NULL;
