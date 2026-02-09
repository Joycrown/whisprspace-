-- ============================================
-- ADD INSERT POLICIES FOR ANALYTICS TABLES
-- ============================================
-- This adds the missing INSERT policies that allow
-- users to create their own page views and activity events

-- Page views: Allow users to track their own page visits
DROP POLICY IF EXISTS "Users can create own page views" ON page_views;
CREATE POLICY "Users can create own page views"
ON page_views FOR INSERT
WITH CHECK (user_id = auth.uid());

-- Activity events: Allow users to track their own activity
DROP POLICY IF EXISTS "Users can create own activity events" ON activity_events;
CREATE POLICY "Users can create own activity events"
ON activity_events FOR INSERT
WITH CHECK (user_id = auth.uid());
