-- ============================================
-- ENABLE REALTIME FOR DIRECT MESSAGING TABLES
-- Ensures DM websocket updates stream without page refresh
-- ============================================

DO $$
BEGIN
  -- direct_messages (core DM stream)
  IF to_regclass('public.direct_messages') IS NOT NULL THEN
    ALTER TABLE public.direct_messages REPLICA IDENTITY FULL;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'direct_messages'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.direct_messages;
    END IF;
  END IF;

  -- conversations (last_message_at updates)
  IF to_regclass('public.conversations') IS NOT NULL THEN
    ALTER TABLE public.conversations REPLICA IDENTITY FULL;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'conversations'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;
    END IF;
  END IF;

  -- conversation_participants (read-state/unread dynamics)
  IF to_regclass('public.conversation_participants') IS NOT NULL THEN
    ALTER TABLE public.conversation_participants REPLICA IDENTITY FULL;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'conversation_participants'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.conversation_participants;
    END IF;
  END IF;

  -- message_read_receipts (double-check / read state)
  IF to_regclass('public.message_read_receipts') IS NOT NULL THEN
    ALTER TABLE public.message_read_receipts REPLICA IDENTITY FULL;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'message_read_receipts'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.message_read_receipts;
    END IF;
  END IF;

  -- message_delivery_receipts (WhatsApp-style delivered state)
  IF to_regclass('public.message_delivery_receipts') IS NOT NULL THEN
    ALTER TABLE public.message_delivery_receipts REPLICA IDENTITY FULL;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'message_delivery_receipts'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.message_delivery_receipts;
    END IF;
  END IF;
END $$;

