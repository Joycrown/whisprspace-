-- ============================================
-- Auto Dispatch Push Webhook (SQL-side)
-- ============================================
-- This migration creates a DB trigger that enqueues an HTTP request
-- to the app push-dispatch endpoint whenever a notification row is inserted.
--
-- Required DB settings (set once per environment):
--   ALTER DATABASE postgres SET app.settings.push_dispatch_url = 'https://your-domain.com/api/push/dispatch';
--   ALTER DATABASE postgres SET app.settings.push_dispatch_secret = 'your-shared-secret';
--
-- Route security should match PUSH_DISPATCH_SECRET in the app.

CREATE EXTENSION IF NOT EXISTS pg_net;

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
  -- URL is environment-specific and stored as a DB setting.
  v_push_url := NULLIF(current_setting('app.settings.push_dispatch_url', true), '');
  IF v_push_url IS NULL THEN
    RETURN NEW;
  END IF;

  v_push_secret := NULLIF(current_setting('app.settings.push_dispatch_secret', true), '');

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
    -- pg_net may not be available in some local setups.
    RAISE WARNING 'pg_net.http_post is unavailable; push dispatch enqueue skipped.';
    RETURN NEW;
  WHEN OTHERS THEN
    -- Never block notification creation because of webhook enqueue issues.
    RAISE WARNING 'Failed to enqueue push dispatch for notification %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_enqueue_push_dispatch_webhook ON public.notifications;

CREATE TRIGGER trigger_enqueue_push_dispatch_webhook
AFTER INSERT ON public.notifications
FOR EACH ROW
EXECUTE FUNCTION public.enqueue_push_dispatch_webhook();

