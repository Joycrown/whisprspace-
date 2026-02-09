-- Enable realtime for thread_participants
-- This migration adds the table to the supabase_realtime publication
-- and sets replica identity to full to ensure all fields are available in realtime payloads (especially for DELETE)

-- 1. Ensure the table exists (in case it wasn't created properly)
CREATE TABLE IF NOT EXISTS public.thread_participants (
  thread_id UUID REFERENCES threads(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  last_read_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (thread_id, user_id)
);

-- 2. Add to publication
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'thread_participants'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables 
      WHERE pubname = 'supabase_realtime' AND tablename = 'thread_participants'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.thread_participants;
    END IF;
  END IF;
END $$;

-- 3. Set replica identity
ALTER TABLE public.thread_participants REPLICA IDENTITY FULL;
