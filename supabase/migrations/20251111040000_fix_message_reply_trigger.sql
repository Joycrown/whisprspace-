-- Fix message reply notification trigger to use parent_message_id instead of replied_to_id
-- The messages table uses parent_message_id, not replied_to_id

CREATE OR REPLACE FUNCTION notify_message_reply()
RETURNS TRIGGER AS $$
BEGIN
  -- Notify the original message sender
  IF NEW.parent_message_id IS NOT NULL THEN
    -- Don't notify if replying to yourself
    IF EXISTS (
      SELECT 1 FROM messages
      WHERE id = NEW.parent_message_id
      AND sender_id = NEW.sender_id
    ) THEN
      RETURN NEW;
    END IF;

    INSERT INTO notifications (user_id, type, category, title, message, data)
    SELECT 
      m.sender_id,
      'message_reply',
      'interactions',
      'New reply to your message',
      u.anonymous_id || ' replied: ' || LEFT(NEW.content, 50),
      jsonb_build_object(
        'thread_id', NEW.thread_id,
        'message_id', NEW.id,
        'replied_to_id', NEW.parent_message_id,
        'sender_id', NEW.sender_id
      )
    FROM messages m
    JOIN users u ON u.id = NEW.sender_id
    WHERE m.id = NEW.parent_message_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
