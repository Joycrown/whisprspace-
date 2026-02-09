-- ============================================
-- WhisprSpace Initial Database Schema
-- ============================================

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- Full-text search

-- Note: Using gen_random_uuid() instead of gen_random_uuid() (natively available in PostgreSQL 13+)

-- ============================================
-- USERS TABLE
-- ============================================
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  anonymous_id TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE,
  is_anonymous BOOLEAN DEFAULT TRUE,
  is_premium BOOLEAN DEFAULT FALSE,
  points INTEGER DEFAULT 0,
  level INTEGER DEFAULT 1,
  streak_count INTEGER DEFAULT 0,
  last_streak_date DATE,
  preferences JSONB DEFAULT '{
    "theme": "system",
    "notifications": {
      "email": false,
      "push": true,
      "inApp": true,
      "likes": true,
      "replies": true,
      "mentions": true,
      "groupInvites": true
    },
    "privacy": {
      "showOnlineStatus": false,
      "allowDirectMessages": false
    }
  }'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_active_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_users_anonymous_id ON users(anonymous_id);
CREATE INDEX idx_users_email ON users(email) WHERE email IS NOT NULL;
CREATE INDEX idx_users_is_premium ON users(is_premium) WHERE is_premium = TRUE;
CREATE INDEX idx_users_points ON users(points DESC);

-- ============================================
-- THREADS TABLE
-- ============================================
CREATE TYPE thread_type AS ENUM ('text', 'poll', 'premium');
CREATE TYPE thread_privacy AS ENUM ('public', 'private', 'invite_only');

CREATE TABLE threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL CHECK (char_length(title) <= 500),
  content TEXT NOT NULL,
  type thread_type DEFAULT 'text',
  category TEXT DEFAULT 'general',
  privacy thread_privacy DEFAULT 'public',
  is_premium BOOLEAN DEFAULT FALSE,
  price DECIMAL(10,2),
  likes_count INTEGER DEFAULT 0,
  message_count INTEGER DEFAULT 0,
  view_count INTEGER DEFAULT 0,
  participant_count INTEGER DEFAULT 1,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_threads_creator ON threads(creator_id);
CREATE INDEX idx_threads_created ON threads(created_at DESC);
CREATE INDEX idx_threads_category ON threads(category);
CREATE INDEX idx_threads_type ON threads(type);
CREATE INDEX idx_threads_privacy ON threads(privacy);
CREATE INDEX idx_threads_is_premium ON threads(is_premium);
CREATE INDEX idx_threads_expires_at ON threads(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX idx_threads_deleted_at ON threads(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX idx_threads_search ON threads USING gin(to_tsvector('english', title || ' ' || content));

-- ============================================
-- THREAD LIKES
-- ============================================
CREATE TABLE thread_likes (
  thread_id UUID REFERENCES threads(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (thread_id, user_id)
);

CREATE INDEX idx_thread_likes_thread ON thread_likes(thread_id);
CREATE INDEX idx_thread_likes_user ON thread_likes(user_id);

-- ============================================
-- MESSAGES (Thread Replies)
-- ============================================
CREATE TYPE message_type AS ENUM ('text', 'voice', 'image', 'file', 'link');

CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID REFERENCES threads(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES users(id) ON DELETE CASCADE,
  parent_message_id UUID REFERENCES messages(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  type message_type DEFAULT 'text',
  attachments JSONB DEFAULT '[]'::jsonb,
  likes_count INTEGER DEFAULT 0,
  is_edited BOOLEAN DEFAULT FALSE,
  is_reported BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  edited_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_messages_thread ON messages(thread_id, created_at DESC);
CREATE INDEX idx_messages_sender ON messages(sender_id);
CREATE INDEX idx_messages_parent ON messages(parent_message_id);

-- ============================================
-- MESSAGE LIKES
-- ============================================
CREATE TABLE message_likes (
  message_id UUID REFERENCES messages(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (message_id, user_id)
);

CREATE INDEX idx_message_likes_message ON message_likes(message_id);
CREATE INDEX idx_message_likes_user ON message_likes(user_id);

-- ============================================
-- POLLS
-- ============================================
CREATE TABLE polls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID REFERENCES threads(id) ON DELETE CASCADE UNIQUE,
  question TEXT,
  duration_hours INTEGER DEFAULT 24,
  allow_multiple_votes BOOLEAN DEFAULT FALSE,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE poll_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id UUID REFERENCES polls(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  vote_count INTEGER DEFAULT 0,
  order_index INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_poll_options_poll ON poll_options(poll_id, order_index);

CREATE TABLE poll_votes (
  poll_id UUID REFERENCES polls(id) ON DELETE CASCADE,
  option_id UUID REFERENCES poll_options(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  voted_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (poll_id, user_id)
);

CREATE INDEX idx_poll_votes_poll ON poll_votes(poll_id);
CREATE INDEX idx_poll_votes_user ON poll_votes(user_id);

-- ============================================
-- GROUPS
-- ============================================
CREATE TYPE group_privacy AS ENUM ('public', 'private', 'invite_only');

CREATE TABLE groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL CHECK (char_length(name) <= 100),
  description TEXT,
  privacy group_privacy DEFAULT 'public',
  max_members INTEGER DEFAULT 100,
  current_members INTEGER DEFAULT 1,
  avatar TEXT,
  banner_url TEXT,
  rules TEXT,
  creator_id UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_groups_privacy ON groups(privacy);
CREATE INDEX idx_groups_creator ON groups(creator_id);

CREATE TYPE group_role AS ENUM ('admin', 'moderator', 'member');

CREATE TABLE group_members (
  group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  role group_role DEFAULT 'member',
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (group_id, user_id)
);

CREATE INDEX idx_group_members_group ON group_members(group_id);
CREATE INDEX idx_group_members_user ON group_members(user_id);

CREATE TABLE group_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
  code TEXT UNIQUE NOT NULL,
  created_by UUID REFERENCES users(id),
  max_uses INTEGER,
  current_uses INTEGER DEFAULT 0,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_group_invites_code ON group_invites(code);

-- ============================================
-- PREMIUM THREAD ACCESS
-- ============================================
CREATE TABLE thread_purchases (
  thread_id UUID REFERENCES threads(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  amount DECIMAL(10,2) NOT NULL,
  stripe_payment_intent_id TEXT,
  purchased_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (thread_id, user_id)
);

CREATE INDEX idx_thread_purchases_thread ON thread_purchases(thread_id);
CREATE INDEX idx_thread_purchases_user ON thread_purchases(user_id);

CREATE TABLE thread_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID REFERENCES threads(id) ON DELETE CASCADE,
  code TEXT UNIQUE NOT NULL,
  created_by UUID REFERENCES users(id),
  max_uses INTEGER DEFAULT 1,
  current_uses INTEGER DEFAULT 0,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_thread_invites_code ON thread_invites(code);
CREATE INDEX idx_thread_invites_thread ON thread_invites(thread_id);

-- ============================================
-- NOTIFICATIONS
-- ============================================
CREATE TYPE notification_type AS ENUM (
  'thread_like',
  'message_reply',
  'mention',
  'group_invite',
  'achievement_unlocked',
  'poll_ending_soon',
  'thread_expiring_soon'
);

CREATE TYPE notification_category AS ENUM ('all', 'interactions', 'system', 'social');

CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  type notification_type NOT NULL,
  category notification_category DEFAULT 'interactions',
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  data JSONB DEFAULT '{}'::jsonb,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_notifications_user ON notifications(user_id, created_at DESC);
CREATE INDEX idx_notifications_unread ON notifications(user_id, is_read) WHERE is_read = FALSE;

-- ============================================
-- GAMIFICATION
-- ============================================
CREATE TABLE achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  icon_url TEXT,
  points_reward INTEGER DEFAULT 0,
  criteria JSONB NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE user_achievements (
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  achievement_id UUID REFERENCES achievements(id) ON DELETE CASCADE,
  earned_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, achievement_id)
);

CREATE INDEX idx_user_achievements_user ON user_achievements(user_id);

CREATE TYPE transaction_type AS ENUM ('earned', 'spent', 'bonus', 'penalty');

CREATE TABLE point_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  points INTEGER NOT NULL,
  type transaction_type DEFAULT 'earned',
  description TEXT,
  reference_id UUID,
  reference_type TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_point_transactions_user ON point_transactions(user_id, created_at DESC);

-- ============================================
-- PAYMENTS & EARNINGS
-- ============================================
CREATE TYPE payment_status AS ENUM ('pending', 'completed', 'failed', 'refunded');

CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  thread_id UUID REFERENCES threads(id),
  amount DECIMAL(10,2) NOT NULL,
  currency TEXT DEFAULT 'USD',
  stripe_payment_intent_id TEXT UNIQUE,
  status payment_status DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX idx_payments_user ON payments(user_id);
CREATE INDEX idx_payments_stripe ON payments(stripe_payment_intent_id);

CREATE TABLE creator_earnings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID REFERENCES users(id),
  thread_id UUID REFERENCES threads(id),
  amount DECIMAL(10,2) NOT NULL,
  platform_fee DECIMAL(10,2) NOT NULL,
  net_amount DECIMAL(10,2) NOT NULL,
  status TEXT DEFAULT 'pending',
  payment_id UUID REFERENCES payments(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  paid_at TIMESTAMPTZ
);

CREATE INDEX idx_creator_earnings_creator ON creator_earnings(creator_id);

-- ============================================
-- TRIGGERS & FUNCTIONS
-- ============================================

-- Update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_threads_updated_at BEFORE UPDATE ON threads
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_groups_updated_at BEFORE UPDATE ON groups
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Increment/decrement thread likes
CREATE OR REPLACE FUNCTION increment_thread_likes()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE threads SET likes_count = likes_count + 1 WHERE id = NEW.thread_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER thread_like_added AFTER INSERT ON thread_likes
  FOR EACH ROW EXECUTE FUNCTION increment_thread_likes();

CREATE OR REPLACE FUNCTION decrement_thread_likes()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE threads SET likes_count = GREATEST(0, likes_count - 1) WHERE id = OLD.thread_id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER thread_like_removed AFTER DELETE ON thread_likes
  FOR EACH ROW EXECUTE FUNCTION decrement_thread_likes();

-- Increment message count
CREATE OR REPLACE FUNCTION increment_message_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE threads SET message_count = message_count + 1 WHERE id = NEW.thread_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER message_added AFTER INSERT ON messages
  FOR EACH ROW EXECUTE FUNCTION increment_message_count();

-- Update poll vote counts
CREATE OR REPLACE FUNCTION update_poll_vote_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE poll_options SET vote_count = vote_count + 1 WHERE id = NEW.option_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER poll_vote_added AFTER INSERT ON poll_votes
  FOR EACH ROW EXECUTE FUNCTION update_poll_vote_count();

-- Award points function
CREATE OR REPLACE FUNCTION award_points(
  user_uuid UUID,
  point_amount INT,
  trans_type TEXT,
  description TEXT,
  ref_id UUID,
  ref_type TEXT
)
RETURNS VOID AS $$
BEGIN
  -- Add transaction
  INSERT INTO point_transactions (user_id, points, type, description, reference_id, reference_type)
  VALUES (user_uuid, point_amount, trans_type::transaction_type, description, ref_id, ref_type);
  
  -- Update user points and level
  UPDATE users 
  SET points = points + point_amount,
      level = FLOOR((points + point_amount) / 100) + 1
  WHERE id = user_uuid;
END;
$$ LANGUAGE plpgsql;