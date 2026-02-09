-- Migration: Update DM cleanup policy + schedule job
-- Description: Soft-delete after 30 days, hard-delete 15 days after soft-delete
-- Date: 2026-02-07

-- 1) Update cleanup function to new retention windows
CREATE OR REPLACE FUNCTION clean_old_messages()
RETURNS VOID AS $$
BEGIN
  -- Soft delete messages older than 30 days
  UPDATE direct_messages
  SET is_deleted = TRUE
  WHERE created_at < NOW() - INTERVAL '30 days'
  AND is_deleted = FALSE;

  -- Hard delete messages marked as deleted for 15+ days
  DELETE FROM direct_messages
  WHERE is_deleted = TRUE
  AND updated_at < NOW() - INTERVAL '15 days';
END;
$$ LANGUAGE plpgsql;

-- 2) Schedule daily cleanup job (requires pg_cron)
CREATE EXTENSION IF NOT EXISTS pg_cron;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'cleanup-direct-messages') THEN
    PERFORM cron.unschedule('cleanup-direct-messages');
  END IF;

  PERFORM cron.schedule(
    'cleanup-direct-messages',
    '0 3 * * *',
    $cmd$SELECT clean_old_messages();$cmd$
  );
END $$;
