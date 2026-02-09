-- Migration: Single invite code per thread (unlimited by default)
-- Date: 2026-02-07

-- Keep only the most recent invite per thread
WITH ranked AS (
  SELECT id,
         thread_id,
         ROW_NUMBER() OVER (PARTITION BY thread_id ORDER BY created_at DESC, id DESC) AS rn
  FROM public.thread_invites
)
DELETE FROM public.thread_invites ti
USING ranked r
WHERE ti.id = r.id
  AND r.rn > 1;

-- Allow unlimited uses by default
ALTER TABLE public.thread_invites
  ALTER COLUMN max_uses DROP DEFAULT;

UPDATE public.thread_invites
SET max_uses = NULL
WHERE max_uses IS NOT NULL;

-- Ensure only one active invite per thread
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'thread_invites_one_per_thread'
      AND conrelid = 'public.thread_invites'::regclass
  ) THEN
    ALTER TABLE public.thread_invites
      ADD CONSTRAINT thread_invites_one_per_thread UNIQUE (thread_id);
  END IF;
END $$;

-- Allow thread creators to update invite codes for their threads
DROP POLICY IF EXISTS "Thread creators can update invites" ON public.thread_invites;
CREATE POLICY "Thread creators can update invites"
  ON public.thread_invites
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM public.threads t
      WHERE t.id = thread_invites.thread_id
        AND t.creator_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.threads t
      WHERE t.id = thread_invites.thread_id
        AND t.creator_id = auth.uid()
    )
  );

-- Update redeem logic to support unlimited uses (max_uses NULL)
CREATE OR REPLACE FUNCTION public.redeem_thread_invite(p_code TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invite RECORD;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_invite
  FROM public.thread_invites
  WHERE code = p_code;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid invite code';
  END IF;

  IF v_invite.expires_at IS NOT NULL AND v_invite.expires_at < NOW() THEN
    RAISE EXCEPTION 'Invite code has expired';
  END IF;

  IF v_invite.max_uses IS NOT NULL AND v_invite.current_uses >= v_invite.max_uses THEN
    RAISE EXCEPTION 'Invite code has been fully used';
  END IF;

  IF public.is_thread_banned(v_invite.thread_id, auth.uid()) THEN
    RAISE EXCEPTION 'You are banned from this thread';
  END IF;

  INSERT INTO public.thread_participants (thread_id, user_id)
  VALUES (v_invite.thread_id, auth.uid())
  ON CONFLICT DO NOTHING;

  UPDATE public.thread_invites
  SET current_uses = current_uses + 1
  WHERE id = v_invite.id;

  RETURN v_invite.thread_id;
END;
$$;
