-- ============================================
-- ENABLE REALTIME FOR THREAD ACTIVITY TABLES
-- Ensures message/reaction/like activity streams instantly
-- ============================================

DO $$
BEGIN
  -- Core thread messages
  IF to_regclass('public.messages') IS NOT NULL THEN
    ALTER TABLE public.messages REPLICA IDENTITY FULL;
    IF NOT EXISTS (
      SELECT 1
      FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'messages'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
    END IF;
  END IF;

  -- Thread likes
  IF to_regclass('public.thread_likes') IS NOT NULL THEN
    ALTER TABLE public.thread_likes REPLICA IDENTITY FULL;
    IF NOT EXISTS (
      SELECT 1
      FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'thread_likes'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.thread_likes;
    END IF;
  END IF;

  -- Message likes (used for per-message like counters)
  IF to_regclass('public.message_likes') IS NOT NULL THEN
    ALTER TABLE public.message_likes REPLICA IDENTITY FULL;
    IF NOT EXISTS (
      SELECT 1
      FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'message_likes'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.message_likes;
    END IF;
  END IF;

  -- Message reactions (emoji reactions)
  IF to_regclass('public.message_reactions') IS NOT NULL THEN
    ALTER TABLE public.message_reactions REPLICA IDENTITY FULL;
    IF NOT EXISTS (
      SELECT 1
      FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'message_reactions'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.message_reactions;
    END IF;
  END IF;

  -- Participant membership changes
  IF to_regclass('public.thread_participants') IS NOT NULL THEN
    ALTER TABLE public.thread_participants REPLICA IDENTITY FULL;
    IF NOT EXISTS (
      SELECT 1
      FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'thread_participants'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.thread_participants;
    END IF;
  END IF;

  -- Poll votes (poll thread activity)
  IF to_regclass('public.poll_votes') IS NOT NULL THEN
    ALTER TABLE public.poll_votes REPLICA IDENTITY FULL;
    IF NOT EXISTS (
      SELECT 1
      FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'poll_votes'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.poll_votes;
    END IF;
  END IF;
END $$;

