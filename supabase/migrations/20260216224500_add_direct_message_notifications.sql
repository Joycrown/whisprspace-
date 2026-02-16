-- ============================================
-- Direct Message Notifications
-- ============================================
-- Notify conversation participants (except sender) when a new
-- direct message is posted.

DO $$
BEGIN
  ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'direct_message';
EXCEPTION
  WHEN undefined_object THEN
    -- Enum may not exist in some non-standard environments.
    NULL;
END
$$;

CREATE OR REPLACE FUNCTION public.notify_direct_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sender_label TEXT;
  v_preview TEXT;
BEGIN
  IF NEW.sender_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Skip internal/system messages.
  IF NEW.message_type = 'system' THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(NULLIF(u.username, ''), u.anonymous_id, 'Someone')
  INTO v_sender_label
  FROM public.users u
  WHERE u.id = NEW.sender_id;

  v_preview := LEFT(COALESCE(NEW.content, ''), 80);

  INSERT INTO public.notifications (user_id, type, category, title, message, data)
  SELECT
    cp.user_id,
    'direct_message',
    'interactions',
    'New direct message',
    CASE
      WHEN v_preview <> '' THEN format('%s: %s', COALESCE(v_sender_label, 'Someone'), v_preview)
      ELSE format('%s sent you a message', COALESCE(v_sender_label, 'Someone'))
    END,
    jsonb_build_object(
      'conversation_id', NEW.conversation_id,
      'dm_message_id', NEW.id,
      'sender_id', NEW.sender_id
    )
  FROM public.conversation_participants cp
  WHERE cp.conversation_id = NEW.conversation_id
    AND cp.user_id <> NEW.sender_id
    AND COALESCE(cp.is_muted, FALSE) = FALSE
    AND NOT EXISTS (
      SELECT 1
      FROM public.notifications n
      WHERE n.user_id = cp.user_id
        AND n.type = 'direct_message'
        AND COALESCE(n.data->>'dm_message_id', '') = NEW.id::text
    );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_notify_direct_message ON public.direct_messages;

CREATE TRIGGER trigger_notify_direct_message
AFTER INSERT ON public.direct_messages
FOR EACH ROW
EXECUTE FUNCTION public.notify_direct_message();
