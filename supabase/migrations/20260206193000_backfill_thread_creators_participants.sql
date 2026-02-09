-- Migration: Backfill thread creators into thread_participants
-- Description: Ensure thread creators are always listed as participants
-- Date: 2026-02-06

INSERT INTO public.thread_participants (thread_id, user_id)
SELECT t.id, t.creator_id
FROM public.threads t
LEFT JOIN public.thread_participants tp
  ON tp.thread_id = t.id AND tp.user_id = t.creator_id
WHERE tp.user_id IS NULL
  AND t.creator_id IS NOT NULL
ON CONFLICT DO NOTHING;
