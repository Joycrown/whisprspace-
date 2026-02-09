-- Migration: Thread invites (links + user invites) and access rules
-- Date: 2026-02-07

-- 1) Thread user invites table (invite by username)
CREATE TABLE IF NOT EXISTS public.thread_user_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID REFERENCES public.threads(id) ON DELETE CASCADE,
  invited_user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  invited_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (thread_id, invited_user_id)
);

ALTER TABLE public.thread_user_invites ENABLE ROW LEVEL SECURITY;

-- RLS: creator can manage invites for their threads
DROP POLICY IF EXISTS "Creators can manage thread user invites" ON public.thread_user_invites;
CREATE POLICY "Creators can manage thread user invites"
  ON public.thread_user_invites
  FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.threads t
      WHERE t.id = thread_user_invites.thread_id
        AND t.creator_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.threads t
      WHERE t.id = thread_user_invites.thread_id
        AND t.creator_id = auth.uid()
    )
  );

-- RLS: invited users can view/update their invites
DROP POLICY IF EXISTS "Invitees can view thread invites" ON public.thread_user_invites;
CREATE POLICY "Invitees can view thread invites"
  ON public.thread_user_invites
  FOR SELECT
  USING (invited_user_id = auth.uid());

DROP POLICY IF EXISTS "Invitees can update thread invites" ON public.thread_user_invites;
CREATE POLICY "Invitees can update thread invites"
  ON public.thread_user_invites
  FOR UPDATE
  USING (invited_user_id = auth.uid())
  WITH CHECK (invited_user_id = auth.uid());

DROP POLICY IF EXISTS "Invitees can delete thread invites" ON public.thread_user_invites;
CREATE POLICY "Invitees can delete thread invites"
  ON public.thread_user_invites
  FOR DELETE
  USING (invited_user_id = auth.uid());

-- 2) Notification type for thread invites
DO $$
BEGIN
  ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'thread_invite';
EXCEPTION
  WHEN undefined_object THEN
    -- Notification enum doesn't exist in some environments
    NULL;
END $$;

-- 3) Update has_thread_access to include participants + user invites
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
      -- Explicit participant (joined)
      OR EXISTS (
        SELECT 1 FROM public.thread_participants tp
        WHERE tp.thread_id = thread_uuid
          AND tp.user_id = user_uuid
      )
      -- Invited user (username invite)
      OR EXISTS (
        SELECT 1 FROM public.thread_user_invites tui
        WHERE tui.thread_id = thread_uuid
          AND tui.invited_user_id = user_uuid
          AND tui.status IN ('pending', 'accepted')
      )
      -- Purchased access
      OR EXISTS (
        SELECT 1 FROM thread_purchases
        WHERE thread_id = thread_uuid AND user_id = user_uuid
      )
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4) Update join_thread to mark invites accepted
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

  -- Mark invite accepted if exists
  UPDATE public.thread_user_invites
  SET status = 'accepted'
  WHERE thread_id = p_thread_id
    AND invited_user_id = auth.uid();

  RETURN TRUE;
END;
$$;

-- 5) Redeem invite link (code) and join thread
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

  IF v_invite.current_uses >= v_invite.max_uses THEN
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

-- 6) Invite user to thread by username (creates notification)
CREATE OR REPLACE FUNCTION public.invite_user_to_thread(
  p_thread_id UUID,
  p_username TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_creator_id UUID;
  v_thread_title TEXT;
  v_user_id UUID;
  v_username TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN json_build_object('success', FALSE, 'error', 'Not authenticated');
  END IF;

  SELECT t.creator_id, t.title INTO v_creator_id, v_thread_title
  FROM public.threads t
  WHERE t.id = p_thread_id;

  IF v_creator_id IS NULL THEN
    RETURN json_build_object('success', FALSE, 'error', 'Thread not found');
  END IF;

  IF v_creator_id <> auth.uid() THEN
    RETURN json_build_object('success', FALSE, 'error', 'Only the thread creator can invite users');
  END IF;

  v_username := TRIM(p_username);

  SELECT u.id INTO v_user_id
  FROM public.users u
  WHERE LOWER(u.username) = LOWER(v_username)
     OR LOWER(u.anonymous_id) = LOWER(v_username)
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RETURN json_build_object('success', FALSE, 'error', 'User not found');
  END IF;

  IF v_user_id = v_creator_id THEN
    RETURN json_build_object('success', FALSE, 'error', 'Cannot invite yourself');
  END IF;

  INSERT INTO public.thread_user_invites (thread_id, invited_user_id, invited_by)
  VALUES (p_thread_id, v_user_id, auth.uid())
  ON CONFLICT (thread_id, invited_user_id)
  DO UPDATE SET
    invited_by = EXCLUDED.invited_by,
    status = 'pending',
    created_at = NOW();

  INSERT INTO public.notifications (user_id, type, category, title, message, data)
  VALUES (
    v_user_id,
    'thread_invite',
    'social',
    'Thread Invite',
    FORMAT('You were invited to \"%s\"', COALESCE(v_thread_title, 'a thread')),
    json_build_object('thread_id', p_thread_id)
  );

  RETURN json_build_object('success', TRUE, 'user_id', v_user_id);
END;
$$;
