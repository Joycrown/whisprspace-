-- ============================================
-- NOTIFICATION TRIGGERS
-- Automatically create notifications for various events
-- ============================================

-- ============================================
-- THREAD LIKE NOTIFICATION
-- ============================================
CREATE OR REPLACE FUNCTION notify_thread_like()
RETURNS TRIGGER AS $$
BEGIN
  -- Don't notify if user likes their own thread
  IF EXISTS (
    SELECT 1 FROM threads 
    WHERE id = NEW.thread_id 
    AND creator_id = NEW.user_id
  ) THEN
    RETURN NEW;
  END IF;

  INSERT INTO notifications (user_id, type, category, title, message, data)
  SELECT 
    t.creator_id,
    'thread_like',
    'interactions',
    'New like on your thread',
    u.anonymous_id || ' liked your thread: ' || LEFT(t.title, 50),
    jsonb_build_object(
      'thread_id', NEW.thread_id,
      'liker_id', NEW.user_id,
      'thread_title', t.title
    )
  FROM threads t
  JOIN users u ON u.id = NEW.user_id
  WHERE t.id = NEW.thread_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_notify_thread_like
AFTER INSERT ON thread_likes
FOR EACH ROW EXECUTE FUNCTION notify_thread_like();

-- ============================================
-- MESSAGE REPLY NOTIFICATION
-- ============================================
CREATE OR REPLACE FUNCTION notify_message_reply()
RETURNS TRIGGER AS $$
BEGIN
  -- Notify the original message sender
  IF NEW.replied_to_id IS NOT NULL THEN
    -- Don't notify if replying to yourself
    IF EXISTS (
      SELECT 1 FROM messages
      WHERE id = NEW.replied_to_id
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
        'replied_to_id', NEW.replied_to_id,
        'sender_id', NEW.sender_id
      )
    FROM messages m
    JOIN users u ON u.id = NEW.sender_id
    WHERE m.id = NEW.replied_to_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_notify_message_reply
AFTER INSERT ON messages
FOR EACH ROW EXECUTE FUNCTION notify_message_reply();

-- ============================================
-- MENTION NOTIFICATION
-- ============================================
CREATE OR REPLACE FUNCTION notify_mention()
RETURNS TRIGGER AS $$
DECLARE
  mentioned_user_id UUID;
  mention_pattern TEXT;
BEGIN
  -- Extract @mentions from message content
  -- This is a simple implementation; you might want to enhance it
  FOR mention_pattern IN 
    SELECT unnest(regexp_matches(NEW.content, '@([a-zA-Z0-9_]+)', 'g'))
  LOOP
    -- Find user by anonymous_id
    SELECT id INTO mentioned_user_id
    FROM users
    WHERE anonymous_id = mention_pattern
    LIMIT 1;

    IF mentioned_user_id IS NOT NULL AND mentioned_user_id != NEW.sender_id THEN
      INSERT INTO notifications (user_id, type, category, title, message, data)
      SELECT 
        mentioned_user_id,
        'mention',
        'interactions',
        'You were mentioned',
        u.anonymous_id || ' mentioned you: ' || LEFT(NEW.content, 50),
        jsonb_build_object(
          'thread_id', NEW.thread_id,
          'message_id', NEW.id,
          'sender_id', NEW.sender_id
        )
      FROM users u
      WHERE u.id = NEW.sender_id;
    END IF;
  END LOOP;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_notify_mention
AFTER INSERT ON messages
FOR EACH ROW EXECUTE FUNCTION notify_mention();

-- ============================================
-- GROUP INVITE NOTIFICATION
-- ============================================
CREATE OR REPLACE FUNCTION notify_group_member_joined()
RETURNS TRIGGER AS $$
BEGIN
  -- Notify group creator when someone joins
  INSERT INTO notifications (user_id, type, category, title, message, data)
  SELECT 
    g.creator_id,
    'group_invite',
    'social',
    'New member joined',
    u.anonymous_id || ' joined ' || g.name,
    jsonb_build_object(
      'group_id', NEW.group_id,
      'member_id', NEW.user_id,
      'group_name', g.name
    )
  FROM groups g
  JOIN users u ON u.id = NEW.user_id
  WHERE g.id = NEW.group_id
  AND g.creator_id != NEW.user_id; -- Don't notify creator when they create group
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_notify_group_member_joined
AFTER INSERT ON group_members
FOR EACH ROW EXECUTE FUNCTION notify_group_member_joined();

-- ============================================
-- POLL ENDING SOON NOTIFICATION
-- ============================================
CREATE OR REPLACE FUNCTION notify_poll_ending_soon()
RETURNS VOID AS $$
BEGIN
  -- Notify users who voted on polls ending in 1 hour
  INSERT INTO notifications (user_id, type, category, title, message, data)
  SELECT DISTINCT
    pv.user_id,
    'poll_ending_soon',
    'system',
    'Poll ending soon',
    'A poll you voted on ends in 1 hour: ' || LEFT(t.title, 50),
    jsonb_build_object(
      'poll_id', p.id,
      'thread_id', p.thread_id,
      'expires_at', p.expires_at
    )
  FROM polls p
  JOIN threads t ON t.id = p.thread_id
  JOIN poll_votes pv ON pv.poll_id = p.id
  WHERE p.expires_at BETWEEN NOW() AND NOW() + INTERVAL '1 hour'
  AND NOT EXISTS (
    SELECT 1 FROM notifications n
    WHERE n.user_id = pv.user_id
    AND n.type = 'poll_ending_soon'
    AND (n.data->>'poll_id')::uuid = p.id
    AND n.created_at > NOW() - INTERVAL '2 hours'
  );
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- THREAD EXPIRING SOON NOTIFICATION
-- ============================================
CREATE OR REPLACE FUNCTION notify_thread_expiring_soon()
RETURNS VOID AS $$
BEGIN
  -- Notify thread creators when their thread expires in 1 hour
  INSERT INTO notifications (user_id, type, category, title, message, data)
  SELECT 
    t.creator_id,
    'thread_expiring_soon',
    'system',
    'Thread expiring soon',
    'Your thread expires in 1 hour: ' || LEFT(t.title, 50),
    jsonb_build_object(
      'thread_id', t.id,
      'expires_at', t.expires_at
    )
  FROM threads t
  WHERE t.expires_at BETWEEN NOW() AND NOW() + INTERVAL '1 hour'
  AND NOT EXISTS (
    SELECT 1 FROM notifications n
    WHERE n.user_id = t.creator_id
    AND n.type = 'thread_expiring_soon'
    AND (n.data->>'thread_id')::uuid = t.id
    AND n.created_at > NOW() - INTERVAL '2 hours'
  );
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- ACHIEVEMENT UNLOCKED NOTIFICATION
-- ============================================
CREATE OR REPLACE FUNCTION notify_achievement_unlocked()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO notifications (user_id, type, category, title, message, data)
  SELECT 
    NEW.user_id,
    'achievement_unlocked',
    'system',
    'Achievement Unlocked! 🏆',
    'You unlocked: ' || a.name,
    jsonb_build_object(
      'achievement_id', NEW.achievement_id,
      'achievement_name', a.name,
      'points_reward', a.points_reward
    )
  FROM achievements a
  WHERE a.id = NEW.achievement_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_notify_achievement_unlocked
AFTER INSERT ON user_achievements
FOR EACH ROW EXECUTE FUNCTION notify_achievement_unlocked();

-- ============================================
-- PREMIUM THREAD PURCHASE NOTIFICATION
-- ============================================
CREATE OR REPLACE FUNCTION notify_premium_purchase()
RETURNS TRIGGER AS $$
BEGIN
  -- Notify thread creator when someone purchases access
  INSERT INTO notifications (user_id, type, category, title, message, data)
  SELECT 
    t.creator_id,
    'thread_like', -- Using thread_like type for now
    'interactions',
    'New Premium Purchase! 💰',
    'Someone purchased access to your thread: ' || LEFT(t.title, 50),
    jsonb_build_object(
      'thread_id', NEW.thread_id,
      'buyer_id', NEW.user_id,
      'amount', NEW.amount
    )
  FROM threads t
  WHERE t.id = NEW.thread_id;
  
  -- Notify buyer that purchase was successful
  INSERT INTO notifications (user_id, type, category, title, message, data)
  SELECT 
    NEW.user_id,
    'thread_like',
    'system',
    'Purchase Successful! ✅',
    'You now have access to: ' || LEFT(t.title, 50),
    jsonb_build_object(
      'thread_id', NEW.thread_id,
      'amount', NEW.amount
    )
  FROM threads t
  WHERE t.id = NEW.thread_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_notify_premium_purchase
AFTER INSERT ON thread_purchases
FOR EACH ROW EXECUTE FUNCTION notify_premium_purchase();

-- ============================================
-- HELPER FUNCTION: Clean Old Notifications
-- ============================================
CREATE OR REPLACE FUNCTION clean_old_notifications()
RETURNS VOID AS $$
BEGIN
  -- Delete read notifications older than 30 days
  DELETE FROM notifications
  WHERE is_read = TRUE
  AND created_at < NOW() - INTERVAL '30 days';
  
  -- Delete unread notifications older than 90 days
  DELETE FROM notifications
  WHERE is_read = FALSE
  AND created_at < NOW() - INTERVAL '90 days';
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- COMMENTS
-- ============================================
-- To manually trigger poll/thread expiration notifications, you can call:
-- SELECT notify_poll_ending_soon();
-- SELECT notify_thread_expiring_soon();
-- 
-- These should be called by a cron job or scheduled task
-- For example, using pg_cron or a server-side cron
