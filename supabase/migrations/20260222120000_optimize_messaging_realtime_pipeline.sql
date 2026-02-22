-- ============================================
-- MESSAGING + REALTIME PERFORMANCE OPTIMIZATIONS
-- - Remove DM conversation N+1 fetch path with a single snapshot RPC
-- - Batch read-state writes to reduce per-message client RPC storms
-- - Add thread_id on message interactions for thread-scoped realtime filters
-- ============================================

-- ----------------------------
-- 1) Thread-scoped interaction metadata for realtime filtering
-- ----------------------------
ALTER TABLE public.message_likes
  ADD COLUMN IF NOT EXISTS thread_id UUID;

ALTER TABLE public.message_reactions
  ADD COLUMN IF NOT EXISTS thread_id UUID;

UPDATE public.message_likes ml
SET thread_id = m.thread_id
FROM public.messages m
WHERE ml.thread_id IS NULL
  AND ml.message_id = m.id;

UPDATE public.message_reactions mr
SET thread_id = m.thread_id
FROM public.messages m
WHERE mr.thread_id IS NULL
  AND mr.message_id = m.id;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'message_likes_thread_id_fkey'
  ) THEN
    ALTER TABLE public.message_likes
      ADD CONSTRAINT message_likes_thread_id_fkey
      FOREIGN KEY (thread_id)
      REFERENCES public.threads(id)
      ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'message_reactions_thread_id_fkey'
  ) THEN
    ALTER TABLE public.message_reactions
      ADD CONSTRAINT message_reactions_thread_id_fkey
      FOREIGN KEY (thread_id)
      REFERENCES public.threads(id)
      ON DELETE CASCADE;
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_message_likes_thread
  ON public.message_likes(thread_id);

CREATE INDEX IF NOT EXISTS idx_message_likes_thread_message
  ON public.message_likes(thread_id, message_id);

CREATE INDEX IF NOT EXISTS idx_message_reactions_thread
  ON public.message_reactions(thread_id);

CREATE INDEX IF NOT EXISTS idx_message_reactions_thread_message
  ON public.message_reactions(thread_id, message_id);

CREATE OR REPLACE FUNCTION public.sync_message_interaction_thread_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  SELECT m.thread_id INTO NEW.thread_id
  FROM public.messages m
  WHERE m.id = NEW.message_id;

  IF NEW.thread_id IS NULL THEN
    RAISE EXCEPTION 'Unable to resolve thread_id for message interaction %', NEW.message_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_message_likes_thread_id ON public.message_likes;
CREATE TRIGGER sync_message_likes_thread_id
BEFORE INSERT OR UPDATE OF message_id ON public.message_likes
FOR EACH ROW
EXECUTE FUNCTION public.sync_message_interaction_thread_id();

DROP TRIGGER IF EXISTS sync_message_reactions_thread_id ON public.message_reactions;
CREATE TRIGGER sync_message_reactions_thread_id
BEFORE INSERT OR UPDATE OF message_id ON public.message_reactions
FOR EACH ROW
EXECUTE FUNCTION public.sync_message_interaction_thread_id();

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.message_likes WHERE thread_id IS NULL) THEN
    ALTER TABLE public.message_likes
      ALTER COLUMN thread_id SET NOT NULL;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.message_reactions WHERE thread_id IS NULL) THEN
    ALTER TABLE public.message_reactions
      ALTER COLUMN thread_id SET NOT NULL;
  END IF;
END;
$$;

-- ----------------------------
-- 2) DM query/index tuning
-- ----------------------------
CREATE INDEX IF NOT EXISTS idx_conversation_participants_user_conversation_read
  ON public.conversation_participants(user_id, conversation_id, last_read_at);

CREATE INDEX IF NOT EXISTS idx_direct_messages_active_conversation_created
  ON public.direct_messages(conversation_id, created_at DESC)
  WHERE is_deleted = FALSE;

CREATE INDEX IF NOT EXISTS idx_direct_messages_active_unread_lookup
  ON public.direct_messages(conversation_id, sender_id, created_at DESC)
  WHERE is_deleted = FALSE;

-- ----------------------------
-- 3) Single-query conversation snapshot RPC
-- ----------------------------
CREATE OR REPLACE FUNCTION public.get_user_conversations_snapshot(
  p_user_id UUID DEFAULT auth.uid(),
  p_limit INTEGER DEFAULT 200
)
RETURNS TABLE (
  id UUID,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  last_message_at TIMESTAMPTZ,
  type TEXT,
  participants JSONB,
  last_message JSONB,
  unread_count INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  effective_limit INTEGER;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN;
  END IF;

  IF auth.uid() IS NOT NULL AND auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'Cannot fetch conversations for another user';
  END IF;

  effective_limit := LEAST(GREATEST(COALESCE(p_limit, 200), 1), 500);

  RETURN QUERY
  WITH user_conversations AS (
    SELECT cp.conversation_id, cp.last_read_at
    FROM public.conversation_participants cp
    WHERE cp.user_id = p_user_id
  )
  SELECT
    c.id,
    c.created_at,
    c.updated_at,
    c.last_message_at,
    COALESCE(c.type, 'direct') AS type,
    COALESCE(participant_rows.participants, '[]'::jsonb) AS participants,
    last_message_row.last_message,
    COALESCE(unread_row.unread_count, 0)::INTEGER AS unread_count
  FROM user_conversations uc
  JOIN public.conversations c
    ON c.id = uc.conversation_id
  LEFT JOIN LATERAL (
    SELECT jsonb_agg(
      jsonb_build_object(
        'conversation_id', cp.conversation_id,
        'user_id', cp.user_id,
        'joined_at', cp.joined_at,
        'last_read_at', cp.last_read_at,
        'is_muted', cp.is_muted,
        'user', jsonb_build_object(
          'id', u.id,
          'anonymous_id', u.anonymous_id,
          'avatar_url', u.avatar_url,
          'is_premium', u.is_premium
        )
      )
    ) AS participants
    FROM public.conversation_participants cp
    LEFT JOIN public.users u ON u.id = cp.user_id
    WHERE cp.conversation_id = c.id
  ) participant_rows ON TRUE
  LEFT JOIN LATERAL (
    SELECT jsonb_build_object(
      'id', dm.id,
      'conversation_id', dm.conversation_id,
      'sender_id', dm.sender_id,
      'content', dm.content,
      'message_type', dm.message_type,
      'attachment_url', dm.attachment_url,
      'is_edited', dm.is_edited,
      'is_deleted', dm.is_deleted,
      'created_at', dm.created_at,
      'updated_at', dm.updated_at,
      'sender', CASE
        WHEN u.id IS NULL THEN NULL
        ELSE jsonb_build_object(
          'id', u.id,
          'anonymous_id', u.anonymous_id,
          'avatar_url', u.avatar_url
        )
      END
    ) AS last_message
    FROM public.direct_messages dm
    LEFT JOIN public.users u ON u.id = dm.sender_id
    WHERE dm.conversation_id = c.id
      AND dm.is_deleted = FALSE
    ORDER BY dm.created_at DESC
    LIMIT 1
  ) last_message_row ON TRUE
  LEFT JOIN LATERAL (
    SELECT COUNT(*)::INTEGER AS unread_count
    FROM public.direct_messages dm
    WHERE dm.conversation_id = c.id
      AND dm.is_deleted = FALSE
      AND dm.sender_id IS DISTINCT FROM p_user_id
      AND dm.created_at > COALESCE(uc.last_read_at, 'epoch'::timestamptz)
  ) unread_row ON TRUE
  ORDER BY c.last_message_at DESC NULLS LAST, c.created_at DESC
  LIMIT effective_limit;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_conversations_snapshot(UUID, INTEGER) TO authenticated;

-- ----------------------------
-- 4) Batched read-state + read-receipt sync RPC
-- ----------------------------
CREATE OR REPLACE FUNCTION public.mark_conversation_read_with_receipts(
  p_conversation_id UUID,
  p_user_id UUID DEFAULT auth.uid()
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inserted_count INTEGER := 0;
BEGIN
  IF p_conversation_id IS NULL OR p_user_id IS NULL THEN
    RETURN 0;
  END IF;

  IF auth.uid() IS NOT NULL AND auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'Cannot mark another user read state';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.conversation_participants cp
    WHERE cp.conversation_id = p_conversation_id
      AND cp.user_id = p_user_id
  ) THEN
    RETURN 0;
  END IF;

  UPDATE public.conversation_participants
  SET last_read_at = NOW()
  WHERE conversation_id = p_conversation_id
    AND user_id = p_user_id;

  INSERT INTO public.message_read_receipts (message_id, user_id, read_at)
  SELECT dm.id, p_user_id, NOW()
  FROM public.direct_messages dm
  WHERE dm.conversation_id = p_conversation_id
    AND dm.is_deleted = FALSE
    AND dm.sender_id IS DISTINCT FROM p_user_id
  ON CONFLICT (message_id, user_id) DO NOTHING;

  GET DIAGNOSTICS inserted_count = ROW_COUNT;
  RETURN inserted_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_conversation_read_with_receipts(UUID, UUID) TO authenticated;
