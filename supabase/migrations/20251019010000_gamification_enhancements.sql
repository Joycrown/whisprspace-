-- ============================================
-- GAMIFICATION ENHANCEMENTS
-- Points, Levels, Achievements, Leaderboards
-- ============================================

-- ============================================
-- LEVEL DEFINITIONS
-- ============================================
CREATE TABLE IF NOT EXISTS level_definitions (
  level INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  points_required INTEGER NOT NULL,
  icon TEXT,
  color TEXT,
  benefits JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default levels (Mature tier names for professional discourse)
INSERT INTO level_definitions (level, name, points_required, icon, color, benefits) VALUES
  (1, 'Initiate', 0, '◇', '#94a3b8', '{"badge": "Initiate"}'),
  (2, 'Contributor', 100, '◆', '#60a5fa', '{"badge": "Contributor"}'),
  (3, 'Advocate', 250, '●', '#34d399', '{"badge": "Advocate", "custom_avatar": true}'),
  (4, 'Authority', 500, '◉', '#a78bfa', '{"badge": "Authority", "custom_avatar": true, "featured_threads": true}'),
  (5, 'Distinguished', 1000, '◈', '#f59e0b', '{"badge": "Distinguished", "custom_avatar": true, "featured_threads": true, "priority_support": true}'),
  (6, 'Eminence', 2500, '◊', '#ef4444', '{"badge": "Eminence", "custom_avatar": true, "featured_threads": true, "priority_support": true, "custom_badge": true}'),
  (7, 'Vanguard', 5000, '◙', '#ec4899', '{"badge": "Vanguard", "all_benefits": true}'),
  (8, 'Visionary', 10000, '◘', '#8b5cf6', '{"badge": "Visionary", "all_benefits": true}'),
  (9, 'Exemplar', 25000, '◐', '#f97316', '{"badge": "Exemplar", "all_benefits": true}'),
  (10, 'Apex', 50000, '◎', '#dc2626', '{"badge": "Apex", "all_benefits": true}')
ON CONFLICT (level) DO NOTHING;

-- ============================================
-- POINT REWARDS CONFIGURATION
-- ============================================
CREATE TABLE IF NOT EXISTS point_rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action TEXT UNIQUE NOT NULL,
  points INTEGER NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  max_per_day INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default point rewards
INSERT INTO point_rewards (action, points, description, max_per_day) VALUES
  ('thread_create', 10, 'Create a new thread', 5),
  ('thread_premium_create', 25, 'Create a premium thread', 3),
  ('message_send', 2, 'Send a message in thread', 50),
  ('thread_like', 1, 'Like a thread', 100),
  ('message_like', 1, 'Like a message', 100),
  ('reply_message', 5, 'Reply to a message', 20),
  ('poll_create', 15, 'Create a poll', 3),
  ('poll_vote', 3, 'Vote in a poll', 20),
  ('group_create', 20, 'Create a group', 2),
  ('group_join', 5, 'Join a group', 10),
  ('achievement_unlock', 50, 'Unlock an achievement', NULL),
  ('daily_login', 10, 'Daily login bonus', 1),
  ('streak_7days', 50, 'Login 7 days in a row', NULL),
  ('streak_30days', 200, 'Login 30 days in a row', NULL),
  ('profile_complete', 25, 'Complete profile', 1),
  ('first_premium_purchase', 100, 'First premium thread purchase', 1),
  ('referral', 50, 'Refer a new user', NULL)
ON CONFLICT (action) DO NOTHING;

-- ============================================
-- DAILY STREAKS
-- ============================================
CREATE TABLE IF NOT EXISTS user_streaks (
  user_id UUID REFERENCES users(id) ON DELETE CASCADE PRIMARY KEY,
  current_streak INTEGER DEFAULT 0,
  longest_streak INTEGER DEFAULT 0,
  last_login_date DATE,
  total_logins INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- LEADERBOARDS
-- ============================================
CREATE TABLE IF NOT EXISTS leaderboard_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  leaderboard_type TEXT NOT NULL,
  score INTEGER NOT NULL,
  rank INTEGER,
  period TEXT NOT NULL, -- 'daily', 'weekly', 'monthly', 'all_time'
  period_start DATE,
  period_end DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, leaderboard_type, period, period_start)
);

CREATE INDEX idx_leaderboard_entries_type_period ON leaderboard_entries(leaderboard_type, period, score DESC);
CREATE INDEX idx_leaderboard_entries_user ON leaderboard_entries(user_id);

-- ============================================
-- ENHANCED FUNCTIONS
-- ============================================

-- Function: Get user's current level info
CREATE OR REPLACE FUNCTION get_user_level_info(p_user_id UUID)
RETURNS TABLE (
  current_level INTEGER,
  level_name TEXT,
  current_points INTEGER,
  points_for_current_level INTEGER,
  points_for_next_level INTEGER,
  progress_percentage NUMERIC
) AS $$
DECLARE
  user_points INTEGER;
  user_level INTEGER;
BEGIN
  -- Get user's current points and level
  SELECT points, level INTO user_points, user_level
  FROM users
  WHERE id = p_user_id;

  -- Return level info
  RETURN QUERY
  SELECT 
    user_level,
    ld_current.name,
    user_points,
    ld_current.points_required,
    COALESCE(ld_next.points_required, ld_current.points_required),
    CASE 
      WHEN ld_next.points_required IS NULL THEN 100.0
      ELSE ROUND(
        ((user_points - ld_current.points_required)::NUMERIC / 
        (ld_next.points_required - ld_current.points_required)::NUMERIC) * 100,
        2
      )
    END
  FROM level_definitions ld_current
  LEFT JOIN level_definitions ld_next ON ld_next.level = user_level + 1
  WHERE ld_current.level = user_level;
END;
$$ LANGUAGE plpgsql;

-- Function: Award points with daily limits
CREATE OR REPLACE FUNCTION award_points_with_limit(
  p_user_id UUID,
  p_action TEXT,
  p_reference_id UUID DEFAULT NULL,
  p_reference_type TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  v_points INTEGER;
  v_max_per_day INTEGER;
  v_today_count INTEGER;
  v_description TEXT;
  v_new_level INTEGER;
  v_old_level INTEGER;
BEGIN
  -- Get reward configuration
  SELECT points, max_per_day, description 
  INTO v_points, v_max_per_day, v_description
  FROM point_rewards
  WHERE action = p_action AND is_active = TRUE;

  IF v_points IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Check daily limit
  IF v_max_per_day IS NOT NULL THEN
    SELECT COUNT(*)
    INTO v_today_count
    FROM point_transactions
    WHERE user_id = p_user_id
    AND description = v_description
    AND created_at >= CURRENT_DATE;

    IF v_today_count >= v_max_per_day THEN
      RETURN FALSE;
    END IF;
  END IF;

  -- Get current level
  SELECT level INTO v_old_level FROM users WHERE id = p_user_id;

  -- Award points
  INSERT INTO point_transactions (user_id, points, type, description, reference_id, reference_type)
  VALUES (p_user_id, v_points, 'earned', v_description, p_reference_id, p_reference_type);

  -- Update user points and calculate new level
  UPDATE users 
  SET 
    points = points + v_points,
    level = (
      SELECT level 
      FROM level_definitions 
      WHERE points_required <= (points + v_points)
      ORDER BY level DESC 
      LIMIT 1
    )
  WHERE id = p_user_id
  RETURNING level INTO v_new_level;

  -- If level up, send notification
  IF v_new_level > v_old_level THEN
    INSERT INTO notifications (user_id, type, category, title, message, data)
    VALUES (
      p_user_id,
      'achievement_unlocked',
      'system',
      'Level Up!',
      'You reached level ' || v_new_level || '!',
      jsonb_build_object('level', v_new_level, 'old_level', v_old_level)
    );
  END IF;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Function: Update user streak
CREATE OR REPLACE FUNCTION update_user_streak(p_user_id UUID)
RETURNS VOID AS $$
DECLARE
  v_last_login DATE;
  v_current_streak INTEGER;
  v_longest_streak INTEGER;
BEGIN
  -- Get or create streak record
  INSERT INTO user_streaks (user_id, last_login_date, total_logins)
  VALUES (p_user_id, CURRENT_DATE, 1)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT last_login_date, current_streak, longest_streak
  INTO v_last_login, v_current_streak, v_longest_streak
  FROM user_streaks
  WHERE user_id = p_user_id;

  -- Check if already logged in today
  IF v_last_login = CURRENT_DATE THEN
    RETURN;
  END IF;

  -- Update streak
  IF v_last_login = CURRENT_DATE - INTERVAL '1 day' THEN
    -- Consecutive day
    v_current_streak := v_current_streak + 1;
  ELSIF v_last_login < CURRENT_DATE - INTERVAL '1 day' THEN
    -- Streak broken
    v_current_streak := 1;
  END IF;

  -- Update longest streak
  IF v_current_streak > v_longest_streak THEN
    v_longest_streak := v_current_streak;
  END IF;

  -- Update record
  UPDATE user_streaks
  SET 
    current_streak = v_current_streak,
    longest_streak = v_longest_streak,
    last_login_date = CURRENT_DATE,
    total_logins = total_logins + 1,
    updated_at = NOW()
  WHERE user_id = p_user_id;

  -- Award streak bonuses
  IF v_current_streak = 7 THEN
    PERFORM award_points_with_limit(p_user_id, 'streak_7days');
  ELSIF v_current_streak = 30 THEN
    PERFORM award_points_with_limit(p_user_id, 'streak_30days');
  END IF;

  -- Award daily login bonus
  PERFORM award_points_with_limit(p_user_id, 'daily_login');
END;
$$ LANGUAGE plpgsql;

-- Function: Get leaderboard
CREATE OR REPLACE FUNCTION get_leaderboard(
  p_type TEXT DEFAULT 'points',
  p_period TEXT DEFAULT 'all_time',
  p_limit INTEGER DEFAULT 100
)
RETURNS TABLE (
  rank BIGINT,
  user_id UUID,
  anonymous_id TEXT,
  avatar_url TEXT,
  level INTEGER,
  score INTEGER
) AS $$
BEGIN
  IF p_period = 'all_time' THEN
    RETURN QUERY
    SELECT 
      ROW_NUMBER() OVER (ORDER BY u.points DESC) as rank,
      u.id,
      u.anonymous_id,
      u.avatar_url,
      u.level,
      u.points as score
    FROM users u
    WHERE u.points > 0
    ORDER BY u.points DESC
    LIMIT p_limit;
  ELSE
    RETURN QUERY
    SELECT 
      ROW_NUMBER() OVER (ORDER BY le.score DESC) as rank,
      u.id,
      u.anonymous_id,
      u.avatar_url,
      u.level,
      le.score
    FROM leaderboard_entries le
    JOIN users u ON u.id = le.user_id
    WHERE le.leaderboard_type = p_type
    AND le.period = p_period
    AND le.period_start = (
      SELECT MAX(period_start) 
      FROM leaderboard_entries 
      WHERE leaderboard_type = p_type AND period = p_period
    )
    ORDER BY le.score DESC
    LIMIT p_limit;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Function: Get user's rank
CREATE OR REPLACE FUNCTION get_user_rank(p_user_id UUID)
RETURNS INTEGER AS $$
DECLARE
  user_rank INTEGER;
BEGIN
  SELECT COUNT(*) + 1 INTO user_rank
  FROM users
  WHERE points > (SELECT points FROM users WHERE id = p_user_id);
  
  RETURN user_rank;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE level_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE point_rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_streaks ENABLE ROW LEVEL SECURITY;
ALTER TABLE leaderboard_entries ENABLE ROW LEVEL SECURITY;

-- Level definitions: Public read
CREATE POLICY "Level definitions are public"
ON level_definitions FOR SELECT
TO public
USING (true);

-- Point rewards: Public read
CREATE POLICY "Point rewards are public"
ON point_rewards FOR SELECT
TO public
USING (true);

-- User streaks: Users can view their own
CREATE POLICY "Users can view own streak"
ON user_streaks FOR SELECT
USING (user_id = auth.uid());

-- Leaderboard: Public read
CREATE POLICY "Leaderboard is public"
ON leaderboard_entries FOR SELECT
TO public
USING (true);

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON TABLE level_definitions IS 'Defines level names, requirements, and benefits';
COMMENT ON TABLE point_rewards IS 'Configuration for point rewards per action';
COMMENT ON TABLE user_streaks IS 'Tracks user login streaks';
COMMENT ON TABLE leaderboard_entries IS 'Stores leaderboard rankings for different periods';
COMMENT ON FUNCTION get_user_level_info IS 'Returns detailed level information for a user';
COMMENT ON FUNCTION award_points_with_limit IS 'Awards points with daily limit checks';
COMMENT ON FUNCTION update_user_streak IS 'Updates user login streak and awards bonuses';
COMMENT ON FUNCTION get_leaderboard IS 'Returns leaderboard for specified type and period';
