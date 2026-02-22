-- Harden expired-thread cleanup to avoid FK failures from payment/ledger tables.
-- Behavior: every hour, mark expired non-saved threads as deleted (soft delete).
-- Saved threads are excluded from cleanup.

CREATE OR REPLACE FUNCTION public.cleanup_expired_threads()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cleaned_count INTEGER := 0;
BEGIN
  -- Soft-delete expired threads that are not saved.
  -- Soft delete is required because some financial tables reference threads
  -- without ON DELETE CASCADE.
  WITH expired AS (
    SELECT t.id
    FROM public.threads t
    WHERE t.expires_at IS NOT NULL
      AND t.expires_at < NOW()
      AND t.deleted_at IS NULL
      AND COALESCE(t.is_saved, FALSE) = FALSE
    FOR UPDATE SKIP LOCKED
  ),
  marked AS (
    UPDATE public.threads t
    SET
      deleted_at = NOW(),
      updated_at = NOW()
    FROM expired e
    WHERE t.id = e.id
    RETURNING t.id
  )
  SELECT COUNT(*) INTO v_cleaned_count FROM marked;

  -- Invalidate invite paths for cleaned threads so old links cannot be redeemed.
  DELETE FROM public.thread_invites ti
  USING public.threads t
  WHERE ti.thread_id = t.id
    AND t.deleted_at IS NOT NULL;

  DELETE FROM public.thread_user_invites tui
  USING public.threads t
  WHERE tui.thread_id = t.id
    AND t.deleted_at IS NOT NULL;

  RETURN v_cleaned_count;
END;
$$;

-- Ensure hourly schedule exists.
CREATE EXTENSION IF NOT EXISTS pg_cron;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'cleanup-expired-threads') THEN
    PERFORM cron.unschedule('cleanup-expired-threads');
  END IF;

  PERFORM cron.schedule(
    'cleanup-expired-threads',
    '0 * * * *',
    'SELECT public.cleanup_expired_threads()'
  );
END $$;

