-- Unified DM retention window: 3 months for all users and DM types.
-- Testing policy:
-- 1) One-off conversations are removed after 3 months of inactivity.
-- 2) Regular direct conversation messages are removed after 3 months from creation.

CREATE OR REPLACE FUNCTION public.clean_old_messages()
RETURNS VOID
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- One-off conversations: delete the whole conversation after 3 months
  -- based on last visible activity (or conversation creation if no messages).
  WITH one_off_activity AS (
    SELECT
      c.id AS conversation_id,
      COALESCE(MAX(dm.created_at), c.created_at) AS last_activity_at
    FROM public.conversations c
    LEFT JOIN public.direct_messages dm
      ON dm.conversation_id = c.id
      AND dm.is_deleted = FALSE
    WHERE c.type = 'one_time'
    GROUP BY c.id, c.created_at
  )
  DELETE FROM public.conversations c
  USING one_off_activity a
  WHERE c.id = a.conversation_id
    AND a.last_activity_at < NOW() - INTERVAL '3 months';

  -- Regular conversations: remove messages older than 3 months.
  -- This applies to every user type (premium and non-premium).
  DELETE FROM public.direct_messages dm
  USING public.conversations c
  WHERE c.id = dm.conversation_id
    AND c.type <> 'one_time'
    AND dm.created_at < NOW() - INTERVAL '3 months';
END;
$$;

-- Keep daily cleanup schedule and ensure it points to the updated function.
CREATE EXTENSION IF NOT EXISTS pg_cron;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'cleanup-direct-messages') THEN
    PERFORM cron.unschedule('cleanup-direct-messages');
  END IF;

  PERFORM cron.schedule(
    'cleanup-direct-messages',
    '0 3 * * *',
    $cmd$SELECT public.clean_old_messages();$cmd$
  );
END $$;
