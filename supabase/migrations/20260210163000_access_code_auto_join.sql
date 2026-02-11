-- ==========================================================
-- Auto-join thread when redeeming partner access code
-- ==========================================================

CREATE OR REPLACE FUNCTION public.redeem_thread_access_code(
  p_thread_id UUID,
  p_code TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code_record public.thread_access_codes%ROWTYPE;
  v_expires_at TIMESTAMPTZ;
  v_deleted_at TIMESTAMPTZ;
  v_is_premium BOOLEAN;
  v_inserted INTEGER;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF public.is_thread_banned(p_thread_id, auth.uid()) THEN
    RAISE EXCEPTION 'You are banned from this thread';
  END IF;

  SELECT expires_at, deleted_at, is_premium
  INTO v_expires_at, v_deleted_at, v_is_premium
  FROM public.threads
  WHERE id = p_thread_id;

  IF v_deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'Thread is deleted';
  END IF;

  IF COALESCE(v_is_premium, FALSE) = FALSE THEN
    RAISE EXCEPTION 'Access codes are only available for premium threads';
  END IF;

  IF v_expires_at IS NOT NULL AND v_expires_at <= NOW() THEN
    RAISE EXCEPTION 'Thread has expired';
  END IF;

  SELECT *
  INTO v_code_record
  FROM public.thread_access_codes
  WHERE thread_id = p_thread_id
    AND code = UPPER(p_code)
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid access code';
  END IF;

  IF v_code_record.is_active = FALSE THEN
    RAISE EXCEPTION 'Access code is inactive';
  END IF;

  IF v_code_record.max_uses > 0 AND v_code_record.current_uses >= v_code_record.max_uses THEN
    RAISE EXCEPTION 'Access code has been fully used';
  END IF;

  INSERT INTO public.thread_purchases (thread_id, user_id, amount)
  VALUES (p_thread_id, auth.uid(), 0)
  ON CONFLICT (thread_id, user_id) DO NOTHING;

  GET DIAGNOSTICS v_inserted = ROW_COUNT;

  IF v_inserted > 0 THEN
    UPDATE public.thread_access_codes
    SET current_uses = current_uses + 1,
        is_active = CASE
          WHEN max_uses > 0 AND current_uses + 1 >= max_uses THEN FALSE
          ELSE TRUE
        END
    WHERE id = v_code_record.id;
  END IF;

  -- Ensure the user is a participant so UI shows "Leave Thread"
  PERFORM public.join_thread(p_thread_id);

  RETURN TRUE;
END;
$$;
