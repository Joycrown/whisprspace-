-- ============================================
-- Enhance Mention Notifications
-- ============================================
-- Ensures @mentions work for both:
-- 1) @username
-- 2) @ANON_12345678 (anonymous id)

CREATE OR REPLACE FUNCTION public.notify_mention()
RETURNS TRIGGER AS $$
DECLARE
  mention_token TEXT;
  mentioned_user_id UUID;
BEGIN
  FOR mention_token IN
    SELECT DISTINCT LOWER(rm.match_parts[1])
    FROM regexp_matches(
      COALESCE(NEW.content, ''),
      '@([a-zA-Z0-9_]+)',
      'g'
    ) AS rm(match_parts)
  LOOP
    SELECT u.id
    INTO mentioned_user_id
    FROM public.users u
    WHERE (
      u.username IS NOT NULL
      AND u.username <> ''
      AND LOWER(u.username) = mention_token
    )
    OR LOWER(u.anonymous_id) = mention_token
    LIMIT 1;

    IF mentioned_user_id IS NOT NULL
      AND mentioned_user_id <> NEW.sender_id
      AND NOT public.is_thread_banned(NEW.thread_id, mentioned_user_id)
    THEN
      INSERT INTO public.notifications (user_id, type, category, title, message, data)
      SELECT
        mentioned_user_id,
        'mention',
        'interactions',
        'You were mentioned',
        COALESCE(NULLIF(sender.username, ''), sender.anonymous_id, 'Someone')
          || ' mentioned you: '
          || LEFT(COALESCE(NEW.content, ''), 80),
        jsonb_build_object(
          'thread_id', NEW.thread_id,
          'message_id', NEW.id,
          'sender_id', NEW.sender_id
        )
      FROM public.users sender
      WHERE sender.id = NEW.sender_id
        AND NOT EXISTS (
          SELECT 1
          FROM public.notifications n
          WHERE n.user_id = mentioned_user_id
            AND n.type = 'mention'
            AND COALESCE(n.data->>'message_id', '') = NEW.id::text
        );
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
