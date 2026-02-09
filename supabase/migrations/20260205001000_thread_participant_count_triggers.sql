-- Keep threads.participant_count in sync with thread_participants

-- Backfill counts for existing threads
UPDATE public.threads t
SET participant_count = COALESCE(tp.count, 0)
FROM (
  SELECT thread_id, COUNT(*) AS count
  FROM public.thread_participants
  GROUP BY thread_id
) tp
WHERE t.id = tp.thread_id;

-- Default any missing rows to at least 1 (creator) if no participants exist
UPDATE public.threads
SET participant_count = 1
WHERE participant_count IS NULL OR participant_count = 0;

-- Function to increment participant_count
CREATE OR REPLACE FUNCTION public.increment_thread_participant_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.threads
  SET participant_count = COALESCE(participant_count, 0) + 1
  WHERE id = NEW.thread_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to decrement participant_count
CREATE OR REPLACE FUNCTION public.decrement_thread_participant_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.threads
  SET participant_count = GREATEST(COALESCE(participant_count, 1) - 1, 0)
  WHERE id = OLD.thread_id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Drop existing triggers if they exist
DROP TRIGGER IF EXISTS thread_participant_added ON public.thread_participants;
DROP TRIGGER IF EXISTS thread_participant_removed ON public.thread_participants;

-- Create triggers
CREATE TRIGGER thread_participant_added
AFTER INSERT ON public.thread_participants
FOR EACH ROW EXECUTE FUNCTION public.increment_thread_participant_count();

CREATE TRIGGER thread_participant_removed
AFTER DELETE ON public.thread_participants
FOR EACH ROW EXECUTE FUNCTION public.decrement_thread_participant_count();
