-- Migration: Allow users to read their own thread bans + secure helper
-- Date: 2026-02-06

-- Allow users to check their own ban status
DROP POLICY IF EXISTS "Users can view own thread bans" ON public.thread_banned_participants;
CREATE POLICY "Users can view own thread bans"
  ON public.thread_banned_participants
  FOR SELECT
  USING (auth.uid() = user_id);

-- Replace helper with SECURITY DEFINER to bypass RLS safely
CREATE OR REPLACE FUNCTION public.is_thread_banned(p_thread_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.thread_banned_participants tb
    WHERE tb.thread_id = p_thread_id
      AND tb.user_id = p_user_id
  );
$$;
