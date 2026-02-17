-- ============================================
-- Fix Thread Message Count Accuracy
-- ============================================
-- Ensures threads.message_count reflects total non-deleted
-- messages across all senders (not creator-only).

-- 1) Backfill all existing thread message counts from source-of-truth messages table.
UPDATE public.threads t
SET message_count = COALESCE(src.message_count, 0)
FROM (
  SELECT
    t2.id AS thread_id,
    COALESCE(COUNT(m.id), 0)::INTEGER AS message_count
  FROM public.threads t2
  LEFT JOIN public.messages m
    ON m.thread_id = t2.id
   AND m.deleted_at IS NULL
  GROUP BY t2.id
) src
WHERE src.thread_id = t.id;

-- 2) Incremental sync trigger function for inserts/updates/deletes on messages.
CREATE OR REPLACE FUNCTION public.sync_thread_message_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.deleted_at IS NULL THEN
      UPDATE public.threads
      SET message_count = GREATEST(0, COALESCE(message_count, 0) + 1)
      WHERE id = NEW.thread_id;
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    IF OLD.deleted_at IS NULL THEN
      UPDATE public.threads
      SET message_count = GREATEST(0, COALESCE(message_count, 0) - 1)
      WHERE id = OLD.thread_id;
    END IF;
    RETURN OLD;
  END IF;

  -- UPDATE
  IF NEW.thread_id IS DISTINCT FROM OLD.thread_id THEN
    IF OLD.deleted_at IS NULL THEN
      UPDATE public.threads
      SET message_count = GREATEST(0, COALESCE(message_count, 0) - 1)
      WHERE id = OLD.thread_id;
    END IF;

    IF NEW.deleted_at IS NULL THEN
      UPDATE public.threads
      SET message_count = GREATEST(0, COALESCE(message_count, 0) + 1)
      WHERE id = NEW.thread_id;
    END IF;

    RETURN NEW;
  END IF;

  IF OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL THEN
    UPDATE public.threads
    SET message_count = GREATEST(0, COALESCE(message_count, 0) - 1)
    WHERE id = NEW.thread_id;
  ELSIF OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL THEN
    UPDATE public.threads
    SET message_count = GREATEST(0, COALESCE(message_count, 0) + 1)
    WHERE id = NEW.thread_id;
  END IF;

  RETURN NEW;
END;
$$;

-- 3) Replace legacy insert-only trigger with robust sync trigger.
DROP TRIGGER IF EXISTS message_added ON public.messages;
DROP TRIGGER IF EXISTS trigger_sync_thread_message_count ON public.messages;

CREATE TRIGGER trigger_sync_thread_message_count
AFTER INSERT OR UPDATE OF thread_id, deleted_at OR DELETE
ON public.messages
FOR EACH ROW
EXECUTE FUNCTION public.sync_thread_message_count();

-- 4) RPC helper for efficient per-thread message count fetch in UI.
CREATE OR REPLACE FUNCTION public.get_thread_message_counts(p_thread_ids UUID[])
RETURNS TABLE (
  thread_id UUID,
  message_count INTEGER
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    t.id AS thread_id,
    COALESCE(COUNT(m.id), 0)::INTEGER AS message_count
  FROM public.threads t
  LEFT JOIN public.messages m
    ON m.thread_id = t.id
   AND m.deleted_at IS NULL
  WHERE (p_thread_ids IS NULL OR t.id = ANY (p_thread_ids))
    AND public.has_thread_access(t.id, auth.uid())
  GROUP BY t.id;
$$;

REVOKE ALL ON FUNCTION public.get_thread_message_counts(UUID[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_thread_message_counts(UUID[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_thread_message_counts(UUID[]) TO service_role;
