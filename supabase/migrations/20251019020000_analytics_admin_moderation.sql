-- ============================================
-- ANALYTICS, ADMIN & MODERATION SYSTEM
-- Track users, visitors, activities, and content moderation
-- ============================================

-- ============================================
-- ADMIN ROLES & PERMISSIONS
-- ============================================

-- Admin roles enum
CREATE TYPE admin_role AS ENUM ('super_admin', 'admin', 'moderator');

-- Admin users table
CREATE TABLE admin_users (
  user_id UUID REFERENCES users(id) ON DELETE CASCADE PRIMARY KEY,
  role admin_role NOT NULL DEFAULT 'moderator',
  permissions JSONB DEFAULT '{}',
  assigned_by UUID REFERENCES users(id),
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_admin_users_role ON admin_users(role);

-- ============================================
-- ANALYTICS: PAGE VIEWS & SESSIONS
-- ============================================

CREATE TABLE page_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  session_id TEXT NOT NULL,
  page_path TEXT NOT NULL,
  page_title TEXT,
  referrer TEXT,
  user_agent TEXT,
  ip_address INET,
  country TEXT,
  city TEXT,
  device_type TEXT,
  browser TEXT,
  os TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_page_views_user ON page_views(user_id, created_at DESC);
CREATE INDEX idx_page_views_session ON page_views(session_id, created_at DESC);
CREATE INDEX idx_page_views_created ON page_views(created_at DESC);
CREATE INDEX idx_page_views_path ON page_views(page_path, created_at DESC);

-- ============================================
-- ANALYTICS: USER ACTIVITY EVENTS
-- ============================================

CREATE TYPE activity_type AS ENUM (
  'user_signup',
  'user_login',
  'thread_create',
  'thread_view',
  'thread_like',
  'message_send',
  'message_like',
  'poll_vote',
  'group_create',
  'group_join',
  'group_leave',
  'direct_message_send',
  'achievement_unlock',
  'level_up',
  'premium_purchase',
  'profile_update'
);

CREATE TABLE activity_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  event_type activity_type NOT NULL,
  event_data JSONB DEFAULT '{}',
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_activity_events_user ON activity_events(user_id, created_at DESC);
CREATE INDEX idx_activity_events_type ON activity_events(event_type, created_at DESC);
CREATE INDEX idx_activity_events_created ON activity_events(created_at DESC);

-- ============================================
-- ANALYTICS: DAILY METRICS
-- ============================================

CREATE TABLE daily_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_date DATE NOT NULL UNIQUE,
  
  -- User metrics
  total_users INTEGER DEFAULT 0,
  new_users INTEGER DEFAULT 0,
  active_users INTEGER DEFAULT 0,
  returning_users INTEGER DEFAULT 0,
  
  -- Engagement metrics
  total_threads INTEGER DEFAULT 0,
  total_messages INTEGER DEFAULT 0,
  total_likes INTEGER DEFAULT 0,
  total_groups INTEGER DEFAULT 0,
  total_direct_messages INTEGER DEFAULT 0,
  
  -- Revenue metrics
  total_revenue DECIMAL(10,2) DEFAULT 0,
  total_purchases INTEGER DEFAULT 0,
  
  -- Traffic metrics
  total_page_views INTEGER DEFAULT 0,
  unique_visitors INTEGER DEFAULT 0,
  avg_session_duration INTEGER DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_daily_metrics_date ON daily_metrics(metric_date DESC);

-- ============================================
-- CONTENT MODERATION
-- ============================================

CREATE TYPE report_type AS ENUM ('thread', 'message', 'user', 'group');
CREATE TYPE report_reason AS ENUM (
  'spam',
  'harassment',
  'hate_speech',
  'violence',
  'sexual_content',
  'misinformation',
  'copyright',
  'other'
);
CREATE TYPE report_status AS ENUM ('pending', 'reviewing', 'resolved', 'dismissed');

CREATE TABLE content_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID REFERENCES users(id) ON DELETE SET NULL,
  reported_user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  content_type report_type NOT NULL,
  content_id UUID NOT NULL,
  reason report_reason NOT NULL,
  description TEXT,
  status report_status DEFAULT 'pending',
  reviewed_by UUID REFERENCES admin_users(user_id),
  reviewed_at TIMESTAMPTZ,
  action_taken TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_content_reports_status ON content_reports(status, created_at DESC);
CREATE INDEX idx_content_reports_type ON content_reports(content_type, status);
CREATE INDEX idx_content_reports_reported_user ON content_reports(reported_user_id);

-- ============================================
-- MODERATION ACTIONS
-- ============================================

CREATE TYPE moderation_action AS ENUM (
  'warning',
  'content_delete',
  'user_suspend',
  'user_ban',
  'content_restore'
);

CREATE TABLE moderation_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  moderator_id UUID REFERENCES admin_users(user_id),
  target_user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  action moderation_action NOT NULL,
  reason TEXT NOT NULL,
  content_type report_type,
  content_id UUID,
  duration_days INTEGER,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_moderation_actions_target ON moderation_actions(target_user_id, created_at DESC);
CREATE INDEX idx_moderation_actions_moderator ON moderation_actions(moderator_id, created_at DESC);

-- ============================================
-- BANNED/SUSPENDED USERS
-- ============================================

CREATE TABLE banned_users (
  user_id UUID REFERENCES users(id) ON DELETE CASCADE PRIMARY KEY,
  banned_by UUID REFERENCES admin_users(user_id),
  reason TEXT NOT NULL,
  is_permanent BOOLEAN DEFAULT FALSE,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- BAD WORDS FILTER
-- ============================================

CREATE TABLE bad_words (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  word TEXT NOT NULL UNIQUE,
  severity TEXT DEFAULT 'medium',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_bad_words_active ON bad_words(is_active);

-- ============================================
-- ANALYTICS FUNCTIONS
-- ============================================

-- Function: Track page view
CREATE OR REPLACE FUNCTION track_page_view(
  p_user_id UUID,
  p_session_id TEXT,
  p_page_path TEXT,
  p_page_title TEXT DEFAULT NULL,
  p_referrer TEXT DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL,
  p_ip_address INET DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  view_id UUID;
BEGIN
  INSERT INTO page_views (
    user_id, session_id, page_path, page_title, 
    referrer, user_agent, ip_address
  )
  VALUES (
    p_user_id, p_session_id, p_page_path, p_page_title,
    p_referrer, p_user_agent, p_ip_address
  )
  RETURNING id INTO view_id;
  
  RETURN view_id;
END;
$$ LANGUAGE plpgsql;

-- Function: Track activity event
CREATE OR REPLACE FUNCTION track_activity(
  p_user_id UUID,
  p_event_type activity_type,
  p_event_data JSONB DEFAULT '{}'::JSONB,
  p_ip_address INET DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  event_id UUID;
BEGIN
  INSERT INTO activity_events (user_id, event_type, event_data, ip_address)
  VALUES (p_user_id, p_event_type, p_event_data, p_ip_address)
  RETURNING id INTO event_id;
  
  RETURN event_id;
END;
$$ LANGUAGE plpgsql;

-- Function: Update daily metrics
CREATE OR REPLACE FUNCTION update_daily_metrics(p_date DATE DEFAULT CURRENT_DATE)
RETURNS VOID AS $$
BEGIN
  INSERT INTO daily_metrics (
    metric_date,
    total_users,
    new_users,
    active_users,
    total_threads,
    total_messages,
    total_likes,
    total_groups,
    total_page_views,
    unique_visitors
  )
  VALUES (
    p_date,
    (SELECT COUNT(*) FROM users WHERE created_at::DATE <= p_date),
    (SELECT COUNT(*) FROM users WHERE created_at::DATE = p_date),
    (SELECT COUNT(DISTINCT user_id) FROM activity_events WHERE created_at::DATE = p_date),
    (SELECT COUNT(*) FROM threads WHERE created_at::DATE = p_date),
    (SELECT COUNT(*) FROM messages WHERE created_at::DATE = p_date),
    (SELECT COUNT(*) FROM thread_likes WHERE created_at::DATE = p_date),
    (SELECT COUNT(*) FROM groups WHERE created_at::DATE = p_date),
    (SELECT COUNT(*) FROM page_views WHERE created_at::DATE = p_date),
    (SELECT COUNT(DISTINCT session_id) FROM page_views WHERE created_at::DATE = p_date)
  )
  ON CONFLICT (metric_date) DO UPDATE SET
    total_users = EXCLUDED.total_users,
    new_users = EXCLUDED.new_users,
    active_users = EXCLUDED.active_users,
    total_threads = EXCLUDED.total_threads,
    total_messages = EXCLUDED.total_messages,
    total_likes = EXCLUDED.total_likes,
    total_groups = EXCLUDED.total_groups,
    total_page_views = EXCLUDED.total_page_views,
    unique_visitors = EXCLUDED.unique_visitors,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- Function: Get platform stats
CREATE OR REPLACE FUNCTION get_platform_stats()
RETURNS TABLE (
  total_users BIGINT,
  active_today BIGINT,
  total_threads BIGINT,
  total_messages BIGINT,
  total_groups BIGINT,
  total_page_views_today BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    (SELECT COUNT(*) FROM users)::BIGINT,
    (SELECT COUNT(DISTINCT user_id) FROM activity_events WHERE created_at >= CURRENT_DATE)::BIGINT,
    (SELECT COUNT(*) FROM threads)::BIGINT,
    (SELECT COUNT(*) FROM messages)::BIGINT,
    (SELECT COUNT(*) FROM groups)::BIGINT,
    (SELECT COUNT(*) FROM page_views WHERE created_at >= CURRENT_DATE)::BIGINT;
END;
$$ LANGUAGE plpgsql;

-- Function: Get user activity summary
CREATE OR REPLACE FUNCTION get_user_activity_summary(p_user_id UUID)
RETURNS TABLE (
  total_threads BIGINT,
  total_messages BIGINT,
  total_likes_given BIGINT,
  total_likes_received BIGINT,
  groups_joined BIGINT,
  achievements_unlocked BIGINT,
  last_active TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    (SELECT COUNT(*) FROM threads WHERE creator_id = p_user_id)::BIGINT,
    (SELECT COUNT(*) FROM messages WHERE sender_id = p_user_id)::BIGINT,
    (SELECT COUNT(*) FROM thread_likes WHERE user_id = p_user_id)::BIGINT,
    (SELECT COUNT(*) FROM thread_likes tl 
     JOIN threads t ON t.id = tl.thread_id 
     WHERE t.creator_id = p_user_id)::BIGINT,
    (SELECT COUNT(*) FROM group_members WHERE user_id = p_user_id)::BIGINT,
    (SELECT COUNT(*) FROM user_achievements WHERE user_id = p_user_id)::BIGINT,
    (SELECT MAX(created_at) FROM activity_events WHERE user_id = p_user_id);
END;
$$ LANGUAGE plpgsql;

-- Function: Check if user is banned
CREATE OR REPLACE FUNCTION is_user_banned(p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  is_banned BOOLEAN;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM banned_users
    WHERE user_id = p_user_id
    AND (is_permanent = TRUE OR expires_at > NOW())
  ) INTO is_banned;
  
  RETURN is_banned;
END;
$$ LANGUAGE plpgsql;

-- Function: Check content for bad words
CREATE OR REPLACE FUNCTION check_bad_words(p_content TEXT)
RETURNS TABLE (
  has_bad_words BOOLEAN,
  matched_words TEXT[]
) AS $$
DECLARE
  bad_word_list TEXT[];
  word RECORD;
BEGIN
  bad_word_list := ARRAY[]::TEXT[];
  
  FOR word IN 
    SELECT bw.word 
    FROM bad_words bw 
    WHERE bw.is_active = TRUE
    AND p_content ILIKE '%' || bw.word || '%'
  LOOP
    bad_word_list := array_append(bad_word_list, word.word);
  END LOOP;
  
  RETURN QUERY SELECT 
    (array_length(bad_word_list, 1) > 0),
    bad_word_list;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- AUTOMATIC ACTIVITY TRACKING TRIGGERS
-- ============================================

-- Trigger: Track thread creation
CREATE OR REPLACE FUNCTION trigger_track_thread_create()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM track_activity(
    NEW.creator_id,
    'thread_create',
    jsonb_build_object('thread_id', NEW.id, 'thread_type', NEW.type)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER track_thread_create
AFTER INSERT ON threads
FOR EACH ROW EXECUTE FUNCTION trigger_track_thread_create();

-- Trigger: Track message send
CREATE OR REPLACE FUNCTION trigger_track_message_send()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM track_activity(
    NEW.sender_id,
    'message_send',
    jsonb_build_object('message_id', NEW.id, 'thread_id', NEW.thread_id)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER track_message_send
AFTER INSERT ON messages
FOR EACH ROW EXECUTE FUNCTION trigger_track_message_send();

-- Trigger: Track group join
CREATE OR REPLACE FUNCTION trigger_track_group_join()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM track_activity(
    NEW.user_id,
    'group_join',
    jsonb_build_object('group_id', NEW.group_id)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER track_group_join
AFTER INSERT ON group_members
FOR EACH ROW EXECUTE FUNCTION trigger_track_group_join();

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE page_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE moderation_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE banned_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE bad_words ENABLE ROW LEVEL SECURITY;

-- Admin users: Only admins can view
CREATE POLICY "Admins can view admin users"
ON admin_users FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM admin_users
    WHERE user_id = auth.uid()
  )
);

-- Page views: Admins and own user
CREATE POLICY "Users can view own page views"
ON page_views FOR SELECT
USING (
  user_id = auth.uid()
  OR EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid())
);

-- Activity events: Admins and own user
CREATE POLICY "Users can view own activity"
ON activity_events FOR SELECT
USING (
  user_id = auth.uid()
  OR EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid())
);

-- Daily metrics: Admins only
CREATE POLICY "Admins can view metrics"
ON daily_metrics FOR SELECT
USING (
  EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid())
);

-- Content reports: Reporter, reported user, and admins
CREATE POLICY "Users can view own reports"
ON content_reports FOR SELECT
USING (
  reporter_id = auth.uid()
  OR reported_user_id = auth.uid()
  OR EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid())
);

-- Users can create reports
CREATE POLICY "Users can create reports"
ON content_reports FOR INSERT
WITH CHECK (reporter_id = auth.uid());

-- Admins can update reports
CREATE POLICY "Admins can update reports"
ON content_reports FOR UPDATE
USING (
  EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid())
);

-- Moderation actions: Admins only
CREATE POLICY "Admins can view moderation actions"
ON moderation_actions FOR SELECT
USING (
  EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid())
);

CREATE POLICY "Admins can create moderation actions"
ON moderation_actions FOR INSERT
WITH CHECK (
  EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid())
);

-- Banned users: Admins only
CREATE POLICY "Admins can manage banned users"
ON banned_users FOR ALL
USING (
  EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid())
);

-- Bad words: Admins only
CREATE POLICY "Admins can manage bad words"
ON bad_words FOR ALL
USING (
  EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid())
);

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON TABLE admin_users IS 'Admin and moderator users with roles and permissions';
COMMENT ON TABLE page_views IS 'Track all page views for analytics';
COMMENT ON TABLE activity_events IS 'Track user activity events';
COMMENT ON TABLE daily_metrics IS 'Aggregated daily platform metrics';
COMMENT ON TABLE content_reports IS 'User-reported content for moderation';
COMMENT ON TABLE moderation_actions IS 'Actions taken by moderators';
COMMENT ON TABLE banned_users IS 'Banned or suspended users';
COMMENT ON TABLE bad_words IS 'Bad words filter list';
