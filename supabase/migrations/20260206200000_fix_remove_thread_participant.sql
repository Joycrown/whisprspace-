-- Migration: Fix ambiguous creator_id in remove_thread_participant
-- Date: 2026-02-06

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
