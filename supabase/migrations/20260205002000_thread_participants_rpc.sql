-- RPC helpers to join/leave threads (bypass RLS safely)

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

CREATE OR REPLACE FUNCTION public.leave_thread(p_thread_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  DELETE FROM public.thread_participants
  WHERE thread_id = p_thread_id
    AND user_id = auth.uid();

  RETURN TRUE;
END;
$$;
