-- Migration: Thread participant blacklist
-- Description: Allow thread creators to ban participants from specific threads
-- Date: 2026-02-06

-- 1) Blacklist table
CREATE TABLE IF NOT EXISTS public.thread_banned_participants (
  thread_id UUID REFERENCES public.threads(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  banned_by UUID REFERENCES public.users(id),
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (thread_id, user_id)
);

ALTER TABLE public.thread_banned_participants ENABLE ROW LEVEL SECURITY;

-- 2) RLS: creators can manage bans for their threads
DROP POLICY IF EXISTS "Creators can manage thread bans" ON public.thread_banned_participants;
CREATE POLICY "Creators can manage thread bans"
  ON public.thread_banned_participants
  FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.threads t
      WHERE t.id = thread_banned_participants.thread_id
      AND t.creator_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.threads t
      WHERE t.id = thread_banned_participants.thread_id
      AND t.creator_id = auth.uid()
    )
  );

-- 3) Helper: check if user is banned from a thread
CREATE OR REPLACE FUNCTION public.is_thread_banned(p_thread_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.thread_banned_participants tb
    WHERE tb.thread_id = p_thread_id
      AND tb.user_id = p_user_id
  );
$$;

-- 4) Update has_thread_access to respect thread bans
CREATE OR REPLACE FUNCTION public.has_thread_access(thread_uuid UUID, user_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
  -- Block banned users
  IF user_uuid IS NOT NULL AND public.is_thread_banned(thread_uuid, user_uuid) THEN
    RETURN FALSE;
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM threads
    WHERE id = thread_uuid
    AND (
      -- Public threads
      privacy = 'public'
      -- Thread creator
      OR creator_id = user_uuid
      -- Purchased access
      OR EXISTS (
        SELECT 1 FROM thread_purchases
        WHERE thread_id = thread_uuid AND user_id = user_uuid
      )
      -- Has valid invite
      OR (privacy = 'invite_only' AND EXISTS (
        SELECT 1 FROM thread_invites ti
        WHERE ti.thread_id = thread_uuid
        AND (ti.expires_at IS NULL OR ti.expires_at > NOW())
        AND ti.current_uses < ti.max_uses
      ))
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5) Replace join_thread to block banned users
CREATE OR REPLACE FUNCTION public.join_thread(p_thread_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF public.is_thread_banned(p_thread_id, auth.uid()) THEN
    RAISE EXCEPTION 'You are banned from this thread';
  END IF;

  -- Ensure user has access to the thread
  IF NOT has_thread_access(p_thread_id, auth.uid()) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  INSERT INTO public.thread_participants (thread_id, user_id)
  VALUES (p_thread_id, auth.uid())
  ON CONFLICT DO NOTHING;

  RETURN TRUE;
END;
$$;

-- 6) Remove + ban participant (creator only)
CREATE OR REPLACE FUNCTION public.remove_thread_participant(
  p_thread_id UUID,
  p_user_id UUID,
  p_reason TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_creator_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT t.creator_id INTO v_creator_id
  FROM public.threads t
  WHERE t.id = p_thread_id;

  IF v_creator_id IS NULL THEN
    RAISE EXCEPTION 'Thread not found';
  END IF;

  IF v_creator_id <> auth.uid() THEN
    RAISE EXCEPTION 'Only the thread creator can remove participants';
  END IF;

  IF p_user_id = v_creator_id THEN
    RAISE EXCEPTION 'Cannot remove thread creator';
  END IF;

  INSERT INTO public.thread_banned_participants (thread_id, user_id, banned_by, reason)
  VALUES (p_thread_id, p_user_id, auth.uid(), p_reason)
  ON CONFLICT (thread_id, user_id) DO UPDATE
    SET banned_by = EXCLUDED.banned_by,
        reason = COALESCE(EXCLUDED.reason, public.thread_banned_participants.reason),
        created_at = NOW();

  DELETE FROM public.thread_participants
  WHERE thread_id = p_thread_id
    AND user_id = p_user_id;

  RETURN TRUE;
END;
$$;
