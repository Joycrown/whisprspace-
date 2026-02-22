-- One-off direct message retention by account tier.
-- Normal users: 3 days
-- Premium users: 7 days
--
-- This updates the existing DM cleanup function so one-off conversations
-- are fully removed (conversation + messages + receipts via cascade),
-- while regular direct conversations keep the existing 30d/15d policy.

CREATE OR REPLACE FUNCTION public.clean_old_messages()
RETURNS VOID
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- One-off conversations are ephemeral.
  -- Determine retention based on the recipient account tier:
  -- recipient = participant who is not the first message sender.
  WITH one_off_base AS (
    SELECT
      c.id AS conversation_id,
      COALESCE(MAX(dm.created_at), c.created_at) AS last_activity_at,
      (
        SELECT dm_sender.sender_id
        FROM public.direct_messages dm_sender
        WHERE dm_sender.conversation_id = c.id
          AND dm_sender.is_deleted = FALSE
        ORDER BY dm_sender.created_at ASC
        LIMIT 1
      ) AS first_sender_id
    FROM public.conversations c
    LEFT JOIN public.direct_messages dm
      ON dm.conversation_id = c.id
      AND dm.is_deleted = FALSE
    WHERE c.type = 'one_time'
    GROUP BY c.id, c.created_at
  ),
  one_off_retention AS (
    SELECT
      b.conversation_id,
      b.last_activity_at,
      (
        COALESCE(u.is_premium, FALSE)
        AND (u.premium_expires_at IS NULL OR u.premium_expires_at > NOW())
      ) AS is_active_premium
    FROM one_off_base b
    JOIN LATERAL (
      SELECT cp.user_id
      FROM public.conversation_participants cp
      WHERE cp.conversation_id = b.conversation_id
        AND (b.first_sender_id IS NULL OR cp.user_id <> b.first_sender_id)
      ORDER BY cp.joined_at DESC, cp.user_id
      LIMIT 1
    ) retention_user ON TRUE
    LEFT JOIN public.users u
      ON u.id = retention_user.user_id
  )
  DELETE FROM public.conversations c
  USING one_off_retention r
  WHERE c.id = r.conversation_id
    AND r.last_activity_at < NOW() - CASE
      WHEN r.is_active_premium THEN INTERVAL '7 days'
      ELSE INTERVAL '3 days'
    END;

  -- Existing lifecycle for regular direct conversations:
  -- soft-delete after 30 days, hard-delete 15 days after soft-delete.
  UPDATE public.direct_messages dm
  SET is_deleted = TRUE
  FROM public.conversations c
  WHERE c.id = dm.conversation_id
    AND c.type <> 'one_time'
    AND dm.created_at < NOW() - INTERVAL '30 days'
    AND dm.is_deleted = FALSE;

  DELETE FROM public.direct_messages dm
  USING public.conversations c
  WHERE c.id = dm.conversation_id
    AND c.type <> 'one_time'
    AND dm.is_deleted = TRUE
    AND dm.updated_at < NOW() - INTERVAL '15 days';
END;
$$;

-- Keep the existing daily DM cleanup schedule, but ensure the job calls
-- the schema-qualified function after this function update.
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
