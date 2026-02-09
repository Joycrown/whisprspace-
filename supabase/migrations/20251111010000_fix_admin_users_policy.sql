-- ============================================
-- FIX INFINITE RECURSION IN ADMIN_USERS RLS POLICY
-- ============================================

-- Drop the problematic policy
DROP POLICY IF EXISTS "Admins can view admin users" ON admin_users;
DROP POLICY IF EXISTS "Users can view own admin record" ON admin_users;

-- Create a simple policy that allows users to view their own admin record
-- This prevents infinite recursion by not checking admin_users within the policy
CREATE POLICY "Users can view own admin record"
ON admin_users FOR SELECT
USING (user_id = auth.uid());

-- Create a helper function to check if user is admin (SECURITY DEFINER bypasses RLS)
CREATE OR REPLACE FUNCTION is_admin(check_user_id UUID DEFAULT NULL)
RETURNS BOOLEAN
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_user_id UUID;
BEGIN
  -- Use provided user_id or current authenticated user
  target_user_id := COALESCE(check_user_id, auth.uid());
  
  -- Check if user exists in admin_users table
  RETURN EXISTS (
    SELECT 1 FROM admin_users
    WHERE user_id = target_user_id
  );
END;
$$ LANGUAGE plpgsql;

-- Update other policies to use the helper function instead of subquery
-- This prevents the recursion issue

-- Page views
DROP POLICY IF EXISTS "Users can view own page views" ON page_views;
CREATE POLICY "Users can view own page views"
ON page_views FOR SELECT
USING (
  user_id = auth.uid()
  OR is_admin()
);

-- Allow users to create their own page views
DROP POLICY IF EXISTS "Users can create own page views" ON page_views;
CREATE POLICY "Users can create own page views"
ON page_views FOR INSERT
WITH CHECK (user_id = auth.uid());

-- Activity events
DROP POLICY IF EXISTS "Users can view own activity" ON activity_events;
CREATE POLICY "Users can view own activity"
ON activity_events FOR SELECT
USING (
  user_id = auth.uid()
  OR is_admin()
);

-- Allow users to create their own activity events
DROP POLICY IF EXISTS "Users can create own activity events" ON activity_events;
CREATE POLICY "Users can create own activity events"
ON activity_events FOR INSERT
WITH CHECK (user_id = auth.uid());

-- Daily metrics
DROP POLICY IF EXISTS "Admins can view metrics" ON daily_metrics;
CREATE POLICY "Admins can view metrics"
ON daily_metrics FOR SELECT
USING (is_admin());

-- Content reports
DROP POLICY IF EXISTS "Users can view related reports" ON content_reports;
CREATE POLICY "Users can view related reports"
ON content_reports FOR SELECT
USING (
  reporter_id = auth.uid()
  OR reported_user_id = auth.uid()
  OR is_admin()
);

DROP POLICY IF EXISTS "Admins can update reports" ON content_reports;
CREATE POLICY "Admins can update reports"
ON content_reports FOR UPDATE
USING (is_admin());

-- Moderation actions
DROP POLICY IF EXISTS "Admins can view moderation actions" ON moderation_actions;
CREATE POLICY "Admins can view moderation actions"
ON moderation_actions FOR SELECT
USING (is_admin());

DROP POLICY IF EXISTS "Admins can create moderation actions" ON moderation_actions;
CREATE POLICY "Admins can create moderation actions"
ON moderation_actions FOR INSERT
WITH CHECK (is_admin());

-- Banned users
DROP POLICY IF EXISTS "Admins can manage banned users" ON banned_users;
CREATE POLICY "Admins can manage banned users"
ON banned_users FOR ALL
USING (is_admin());

-- Bad words
DROP POLICY IF EXISTS "Admins can manage bad words" ON bad_words;
CREATE POLICY "Admins can manage bad words"
ON bad_words FOR ALL
USING (is_admin());

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION is_admin TO authenticated;
GRANT EXECUTE ON FUNCTION is_admin TO anon;
