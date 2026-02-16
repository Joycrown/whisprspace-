-- ============================================
-- Push Dispatch Config Fallback (No ALTER DATABASE required)
-- ============================================
-- Supabase hosted roles may not be allowed to run:
--   ALTER DATABASE ... SET app.settings.push_dispatch_*
--
-- This migration adds a table-based config fallback and updates
-- enqueue_push_dispatch_webhook() to read from:
--   1) DB setting (if available)
--   2) public.app_runtime_config key/value row fallback

CREATE TABLE IF NOT EXISTS public.app_runtime_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION public.enqueue_push_dispatch_webhook()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_push_url TEXT;
  v_push_secret TEXT;
  v_headers JSONB;
  v_payload JSONB;
BEGIN
  -- Prefer DB-level setting when available.
  v_push_url := NULLIF(current_setting('app.settings.push_dispatch_url', true), '');
  IF v_push_url IS NULL THEN
    SELECT arc.value
    INTO v_push_url
    FROM public.app_runtime_config arc
    WHERE arc.key = 'push_dispatch_url'
    LIMIT 1;
  END IF;

  IF v_push_url IS NULL THEN
    RETURN NEW;
  END IF;

  v_push_secret := NULLIF(current_setting('app.settings.push_dispatch_secret', true), '');
  IF v_push_secret IS NULL THEN
    SELECT arc.value
    INTO v_push_secret
    FROM public.app_runtime_config arc
    WHERE arc.key = 'push_dispatch_secret'
    LIMIT 1;
  END IF;

  v_headers := jsonb_build_object(
    'Content-Type', 'application/json'
  );

  IF v_push_secret IS NOT NULL THEN
    v_headers := v_headers || jsonb_build_object(
      'x-push-dispatch-secret', v_push_secret
    );
  END IF;

  v_payload := jsonb_build_object(
    'notification',
    jsonb_build_object(
      'id', NEW.id,
      'user_id', NEW.user_id,
      'title', NEW.title,
      'message', NEW.message,
      'data', COALESCE(NEW.data, '{}'::jsonb)
    )
  );

  PERFORM net.http_post(
    url := v_push_url,
    headers := v_headers,
    body := v_payload
  );

  RETURN NEW;
EXCEPTION
  WHEN undefined_function THEN
    RAISE WARNING 'pg_net.http_post is unavailable; push dispatch enqueue skipped.';
    RETURN NEW;
  WHEN OTHERS THEN
    RAISE WARNING 'Failed to enqueue push dispatch for notification %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$;

