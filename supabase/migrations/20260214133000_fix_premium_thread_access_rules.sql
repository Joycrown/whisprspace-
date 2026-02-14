-- Ensure premium threads always require a paid/free access grant.
-- This prevents public premium threads from being readable without purchase.

CREATE OR REPLACE FUNCTION public.has_thread_access(thread_uuid UUID, user_uuid UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_thread RECORD;
  v_has_purchase BOOLEAN := FALSE;
  v_has_participant BOOLEAN := FALSE;
  v_has_user_invite BOOLEAN := FALSE;
BEGIN
  -- Block banned users early.
  IF user_uuid IS NOT NULL AND public.is_thread_banned(thread_uuid, user_uuid) THEN
    RETURN FALSE;
  END IF;

  SELECT id, creator_id, privacy, is_premium
  INTO v_thread
  FROM public.threads
  WHERE id = thread_uuid;

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  -- Thread creators always have access.
  IF v_thread.creator_id = user_uuid THEN
    RETURN TRUE;
  END IF;

  IF user_uuid IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.thread_purchases tp
      WHERE tp.thread_id = thread_uuid
        AND tp.user_id = user_uuid
    )
    INTO v_has_purchase;

    SELECT EXISTS (
      SELECT 1
      FROM public.thread_participants tpart
      WHERE tpart.thread_id = thread_uuid
        AND tpart.user_id = user_uuid
    )
    INTO v_has_participant;

    SELECT EXISTS (
      SELECT 1
      FROM public.thread_user_invites tui
      WHERE tui.thread_id = thread_uuid
        AND tui.invited_user_id = user_uuid
        AND tui.status IN ('pending', 'accepted')
    )
    INTO v_has_user_invite;
  END IF;

  -- Premium threads must have an explicit purchase grant.
  -- Access-code redemption creates a thread_purchases row with amount=0.
  IF COALESCE(v_thread.is_premium, FALSE) THEN
    RETURN v_has_purchase;
  END IF;

  -- Non-premium public threads remain open.
  IF v_thread.privacy = 'public' THEN
    RETURN TRUE;
  END IF;

  -- Non-premium private/invite-only access paths.
  RETURN v_has_purchase OR v_has_participant OR v_has_user_invite;
END;
$$;
