-- ============================================
-- SCHEDULE THREAD CLEANUP
-- Enable pg_cron and schedule the cleanup job
-- ============================================

-- Enable the pg_cron extension
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule the cleanup job
DO $$
BEGIN
  -- Safely unschedule if it exists
  -- We check cron.job table first to avoid "could not find valid entry" error
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'cleanup-expired-threads') THEN
    PERFORM cron.unschedule('cleanup-expired-threads');
  END IF;

  -- Schedule the job to run every hour at minute 0
  -- Using public.cleanup_expired_threads() to ensure correct schema
  PERFORM cron.schedule(
    'cleanup-expired-threads',
    '0 * * * *',
    'SELECT public.cleanup_expired_threads()'
  );
END $$;
