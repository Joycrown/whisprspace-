-- ============================================
-- Native Web Push Notifications
-- ============================================
-- Stores browser push subscriptions and tracks dispatch
-- status for notifications.

-- 1) Browser push subscriptions
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  user_agent TEXT,
  device_type TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  failure_reason TEXT,
  last_success_at TIMESTAMPTZ,
  last_failure_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_active
  ON public.push_subscriptions (user_id, is_active);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_last_success
  ON public.push_subscriptions (last_success_at DESC);

-- 2) Track whether a notification already had push dispatch attempted
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS push_sent_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_notifications_push_unsent
  ON public.notifications (created_at ASC)
  WHERE push_sent_at IS NULL;

-- Avoid sending stale historic notifications when push dispatch starts.
UPDATE public.notifications
SET push_sent_at = created_at
WHERE push_sent_at IS NULL
  AND created_at < NOW() - INTERVAL '3 days';

-- 3) Keep updated_at in sync on subscription changes
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'update_push_subscriptions_updated_at'
  ) THEN
    CREATE TRIGGER update_push_subscriptions_updated_at
    BEFORE UPDATE ON public.push_subscriptions
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END;
$$;

-- 4) RLS
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own push subscriptions" ON public.push_subscriptions;
CREATE POLICY "Users can view own push subscriptions"
ON public.push_subscriptions
FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own push subscriptions" ON public.push_subscriptions;
CREATE POLICY "Users can insert own push subscriptions"
ON public.push_subscriptions
FOR INSERT
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own push subscriptions" ON public.push_subscriptions;
CREATE POLICY "Users can update own push subscriptions"
ON public.push_subscriptions
FOR UPDATE
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own push subscriptions" ON public.push_subscriptions;
CREATE POLICY "Users can delete own push subscriptions"
ON public.push_subscriptions
FOR DELETE
USING (auth.uid() = user_id);

-- 5) Grants for authenticated users
GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_subscriptions TO authenticated;
