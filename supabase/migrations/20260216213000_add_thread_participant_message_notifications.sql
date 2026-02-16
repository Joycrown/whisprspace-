-- ============================================
-- Participant Message Notifications
-- ============================================
-- Notify thread participants (except sender) when a new message is posted.
-- These notification rows flow into push automatically via the existing
-- notification -> push dispatch pipeline.

DO $$
BEGIN
  ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'thread_message';
EXCEPTION
  WHEN undefined_object THEN
    -- Enum may not exist in some non-standard environments.
    NULL;
END
$$;

CREATE OR REPLACE FUNCTION public.notify_thread_participant_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sender_label TEXT;
  v_thread_title TEXT;
  v_preview TEXT;
BEGIN
  SELECT COALESCE(NULLIF(u.username, ''), u.anonymous_id, 'Someone')
  INTO v_sender_label
  FROM public.users u
  WHERE u.id = NEW.sender_id;

  SELECT COALESCE(t.title, 'a thread')
  INTO v_thread_title
  FROM public.threads t
  WHERE t.id = NEW.thread_id;

  v_preview := LEFT(COALESCE(NEW.content, ''), 80);

  INSERT INTO public.notifications (user_id, type, category, title, message, data)
  SELECT
    tp.user_id,
    'thread_message',
    'interactions',
    'New message in a thread you joined',
    CASE
      WHEN v_preview <> '' THEN format('%s: %s', COALESCE(v_sender_label, 'Someone'), v_preview)
      ELSE format('%s posted in "%s"', COALESCE(v_sender_label, 'Someone'), COALESCE(v_thread_title, 'a thread'))
    END,
    jsonb_build_object(
      'thread_id', NEW.thread_id,
      'message_id', NEW.id,
      'sender_id', NEW.sender_id,
      'thread_title', COALESCE(v_thread_title, 'a thread')
    )
  FROM public.thread_participants tp
  WHERE tp.thread_id = NEW.thread_id
    AND tp.user_id <> NEW.sender_id
    AND NOT public.is_thread_banned(NEW.thread_id, tp.user_id)
    -- Avoid double notification for the replied user; they already get message_reply.
    AND (
      NEW.parent_message_id IS NULL
      OR NOT EXISTS (
        SELECT 1
        FROM public.messages pm
        WHERE pm.id = NEW.parent_message_id
          AND pm.sender_id = tp.user_id
      )
    );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_notify_thread_participant_message ON public.messages;

CREATE TRIGGER trigger_notify_thread_participant_message
AFTER INSERT ON public.messages
FOR EACH ROW
EXECUTE FUNCTION public.notify_thread_participant_message();

