-- Add message_count column to thread_participants and create trigger
-- This migration fixes real-time participant message count updates

-- 1. Add message_count column to thread_participants
ALTER TABLE public.thread_participants
ADD COLUMN IF NOT EXISTS message_count INTEGER DEFAULT 0;

-- 2. Backfill existing message counts
UPDATE public.thread_participants tp
SET message_count = (
  SELECT COUNT(*)
  FROM public.messages m
  WHERE m.thread_id = tp.thread_id
    AND m.sender_id = tp.user_id
    AND m.deleted_at IS NULL
);

-- 3. Create function to increment participant message count
CREATE OR REPLACE FUNCTION increment_participant_message_count()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert or update participant record with message count
  INSERT INTO public.thread_participants (thread_id, user_id, message_count, last_read_at, joined_at)
  VALUES (NEW.thread_id, NEW.sender_id, 1, NOW(), NOW())
  ON CONFLICT (thread_id, user_id)
  DO UPDATE SET message_count = thread_participants.message_count + 1;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Create trigger to call function on message insert
DROP TRIGGER IF EXISTS participant_message_count_increment ON public.messages;

CREATE TRIGGER participant_message_count_increment
  AFTER INSERT ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION increment_participant_message_count();

-- 5. Add index for better performance
CREATE INDEX IF NOT EXISTS idx_thread_participants_message_count 
  ON public.thread_participants(thread_id, message_count DESC);
