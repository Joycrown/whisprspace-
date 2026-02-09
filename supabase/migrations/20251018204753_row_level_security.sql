-- ============================================
-- WhisprSpace Row Level Security (RLS) Policies
-- ============================================
-- This migration enables RLS on all tables and creates policies
-- to ensure users can only access data they're authorized to see.

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Get current authenticated user ID
-- Note: Using auth.uid() which is built-in to Supabase
-- This is just a wrapper for consistency
CREATE OR REPLACE FUNCTION current_user_id()
RETURNS UUID AS $$
  SELECT auth.uid();
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- Check if user has purchased a thread
CREATE OR REPLACE FUNCTION has_thread_access(thread_uuid UUID, user_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM threads
    WHERE id = thread_uuid
    AND (
      -- Public threads
      privacy = 'public'
      -- Thread creator
      OR creator_id = user_uuid
      -- Purchased access
      OR EXISTS (
        SELECT 1 FROM thread_purchases
        WHERE thread_id = thread_uuid AND user_id = user_uuid
      )
      -- Has valid invite
      OR (privacy = 'invite_only' AND EXISTS (
        SELECT 1 FROM thread_invites ti
        WHERE ti.thread_id = thread_uuid
        AND (ti.expires_at IS NULL OR ti.expires_at > NOW())
        AND ti.current_uses < ti.max_uses
      ))
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check if user is a group member
CREATE OR REPLACE FUNCTION is_group_member(group_uuid UUID, user_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM group_members
    WHERE group_id = group_uuid AND user_id = user_uuid
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- ENABLE RLS ON ALL TABLES
-- ============================================

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE thread_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE polls ENABLE ROW LEVEL SECURITY;
ALTER TABLE poll_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE poll_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE thread_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE thread_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE point_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE creator_earnings ENABLE ROW LEVEL SECURITY;

-- ============================================
-- USERS TABLE POLICIES
-- ============================================

-- Users can read all user profiles (anonymous IDs only)
CREATE POLICY "Users can view all profiles"
ON users FOR SELECT
USING (true);

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
ON users FOR UPDATE
USING (auth.uid() = id);

-- Users can insert their own profile (during signup)
CREATE POLICY "Users can insert own profile"
ON users FOR INSERT
WITH CHECK (auth.uid() = id);

-- ============================================
-- THREADS TABLE POLICIES
-- ============================================

-- Anyone can view public threads
CREATE POLICY "Anyone can view public threads"
ON threads FOR SELECT
USING (
  privacy = 'public'
  OR creator_id = auth.uid()
  OR has_thread_access(id, auth.uid())
);

-- Authenticated (non-anonymous) users can create threads
CREATE POLICY "Authenticated users can create threads"
ON threads FOR INSERT
WITH CHECK (
  auth.uid() = creator_id
  AND EXISTS (
    SELECT 1 FROM users
    WHERE id = auth.uid()
    AND is_anonymous = false
  )
);

-- Creators can update their own threads
CREATE POLICY "Creators can update own threads"
ON threads FOR UPDATE
USING (creator_id = auth.uid());

-- Creators can soft-delete their own threads
CREATE POLICY "Creators can delete own threads"
ON threads FOR DELETE
USING (creator_id = auth.uid());

-- ============================================
-- THREAD LIKES POLICIES
-- ============================================

-- Users can view likes on threads they can access
CREATE POLICY "Users can view thread likes"
ON thread_likes FOR SELECT
USING (has_thread_access(thread_id, auth.uid()));

-- Authenticated users can like threads
CREATE POLICY "Authenticated users can like threads"
ON thread_likes FOR INSERT
WITH CHECK (
  auth.uid() = user_id
  AND has_thread_access(thread_id, auth.uid())
);

-- Users can remove their own likes
CREATE POLICY "Users can remove own likes"
ON thread_likes FOR DELETE
USING (auth.uid() = user_id);

-- ============================================
-- MESSAGES TABLE POLICIES
-- ============================================

-- Users can view messages in threads they can access
CREATE POLICY "Users can view messages in accessible threads"
ON messages FOR SELECT
USING (has_thread_access(thread_id, auth.uid()));

-- Authenticated users can post messages in accessible threads
CREATE POLICY "Authenticated users can post messages"
ON messages FOR INSERT
WITH CHECK (
  auth.uid() = sender_id
  AND has_thread_access(thread_id, auth.uid())
);

-- Users can update their own messages
CREATE POLICY "Users can update own messages"
ON messages FOR UPDATE
USING (auth.uid() = sender_id);

-- Users can delete their own messages
CREATE POLICY "Users can delete own messages"
ON messages FOR DELETE
USING (auth.uid() = sender_id);

-- ============================================
-- MESSAGE LIKES POLICIES
-- ============================================

-- Users can view message likes in accessible threads
CREATE POLICY "Users can view message likes"
ON message_likes FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM messages
    WHERE messages.id = message_likes.message_id
    AND has_thread_access(messages.thread_id, auth.uid())
  )
);

-- Users can like messages in accessible threads
CREATE POLICY "Users can like messages"
ON message_likes FOR INSERT
WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1 FROM messages
    WHERE messages.id = message_likes.message_id
    AND has_thread_access(messages.thread_id, auth.uid())
  )
);

-- Users can remove their own message likes
CREATE POLICY "Users can remove own message likes"
ON message_likes FOR DELETE
USING (auth.uid() = user_id);

-- ============================================
-- POLLS TABLE POLICIES
-- ============================================

-- Users can view polls in accessible threads
CREATE POLICY "Users can view polls"
ON polls FOR SELECT
USING (has_thread_access(thread_id, auth.uid()));

-- Thread creators can create polls
CREATE POLICY "Thread creators can create polls"
ON polls FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM threads
    WHERE threads.id = thread_id
    AND threads.creator_id = auth.uid()
  )
);

-- ============================================
-- POLL OPTIONS POLICIES
-- ============================================

-- Users can view poll options in accessible threads
CREATE POLICY "Users can view poll options"
ON poll_options FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM polls
    WHERE polls.id = poll_options.poll_id
    AND has_thread_access(polls.thread_id, auth.uid())
  )
);

-- Poll creators can add options
CREATE POLICY "Poll creators can add options"
ON poll_options FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM polls
    JOIN threads ON threads.id = polls.thread_id
    WHERE polls.id = poll_options.poll_id
    AND threads.creator_id = auth.uid()
  )
);

-- ============================================
-- POLL VOTES POLICIES
-- ============================================

-- Users can view votes in accessible polls
CREATE POLICY "Users can view poll votes"
ON poll_votes FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM polls
    WHERE polls.id = poll_votes.poll_id
    AND has_thread_access(polls.thread_id, auth.uid())
  )
);

-- Users can vote in accessible polls
CREATE POLICY "Users can vote in polls"
ON poll_votes FOR INSERT
WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1 FROM polls
    WHERE polls.id = poll_votes.poll_id
    AND has_thread_access(polls.thread_id, auth.uid())
    AND (polls.expires_at IS NULL OR polls.expires_at > NOW())
  )
);

-- ============================================
-- GROUPS TABLE POLICIES
-- ============================================

-- Anyone can view public groups
CREATE POLICY "Anyone can view public groups"
ON groups FOR SELECT
USING (
  privacy = 'public'
  OR creator_id = auth.uid()
  OR is_group_member(id, auth.uid())
);

-- Authenticated users can create groups
CREATE POLICY "Authenticated users can create groups"
ON groups FOR INSERT
WITH CHECK (
  auth.uid() = creator_id
  AND EXISTS (
    SELECT 1 FROM users
    WHERE id = auth.uid()
    AND is_anonymous = false
  )
);

-- Group creators and admins can update groups
CREATE POLICY "Group admins can update groups"
ON groups FOR UPDATE
USING (
  creator_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM group_members
    WHERE group_id = groups.id
    AND user_id = auth.uid()
    AND role IN ('admin', 'moderator')
  )
);

-- ============================================
-- GROUP MEMBERS POLICIES
-- ============================================

-- Members can view other members in their groups
CREATE POLICY "Group members can view members"
ON group_members FOR SELECT
USING (is_group_member(group_id, auth.uid()));

-- Users can join groups (will be restricted by group privacy separately)
CREATE POLICY "Users can join groups"
ON group_members FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can leave groups
CREATE POLICY "Users can leave groups"
ON group_members FOR DELETE
USING (auth.uid() = user_id);

-- Admins can remove members
CREATE POLICY "Admins can remove members"
ON group_members FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM group_members gm
    WHERE gm.group_id = group_members.group_id
    AND gm.user_id = auth.uid()
    AND gm.role = 'admin'
  )
);

-- ============================================
-- GROUP INVITES POLICIES
-- ============================================

-- Members can view group invites
CREATE POLICY "Group members can view invites"
ON group_invites FOR SELECT
USING (is_group_member(group_id, auth.uid()));

-- Admins can create invites
CREATE POLICY "Admins can create invites"
ON group_invites FOR INSERT
WITH CHECK (
  auth.uid() = created_by
  AND EXISTS (
    SELECT 1 FROM group_members
    WHERE group_id = group_invites.group_id
    AND user_id = auth.uid()
    AND role IN ('admin', 'moderator')
  )
);

-- ============================================
-- THREAD PURCHASES POLICIES
-- ============================================

-- Users can view their own purchases
CREATE POLICY "Users can view own purchases"
ON thread_purchases FOR SELECT
USING (auth.uid() = user_id);

-- Users can purchase threads (will be validated by app logic)
CREATE POLICY "Users can purchase threads"
ON thread_purchases FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- ============================================
-- THREAD INVITES POLICIES
-- ============================================

-- Thread creators can view invites
CREATE POLICY "Thread creators can view invites"
ON thread_invites FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM threads
    WHERE threads.id = thread_invites.thread_id
    AND threads.creator_id = auth.uid()
  )
);

-- Thread creators can create invites
CREATE POLICY "Thread creators can create invites"
ON thread_invites FOR INSERT
WITH CHECK (
  auth.uid() = created_by
  AND EXISTS (
    SELECT 1 FROM threads
    WHERE threads.id = thread_invites.thread_id
    AND threads.creator_id = auth.uid()
  )
);

-- ============================================
-- NOTIFICATIONS POLICIES
-- ============================================

-- Users can only view their own notifications
CREATE POLICY "Users can view own notifications"
ON notifications FOR SELECT
USING (auth.uid() = user_id);

-- System can create notifications (app logic)
CREATE POLICY "System can create notifications"
ON notifications FOR INSERT
WITH CHECK (true);

-- Users can update their own notifications (mark as read)
CREATE POLICY "Users can update own notifications"
ON notifications FOR UPDATE
USING (auth.uid() = user_id);

-- Users can delete their own notifications
CREATE POLICY "Users can delete own notifications"
ON notifications FOR DELETE
USING (auth.uid() = user_id);

-- ============================================
-- ACHIEVEMENTS POLICIES
-- ============================================

-- Anyone can view available achievements
CREATE POLICY "Anyone can view achievements"
ON achievements FOR SELECT
USING (is_active = true);

-- ============================================
-- USER ACHIEVEMENTS POLICIES
-- ============================================

-- Users can view their own achievements
CREATE POLICY "Users can view own achievements"
ON user_achievements FOR SELECT
USING (auth.uid() = user_id);

-- System can award achievements (via function)
CREATE POLICY "System can award achievements"
ON user_achievements FOR INSERT
WITH CHECK (true);

-- ============================================
-- POINT TRANSACTIONS POLICIES
-- ============================================

-- Users can view their own point history
CREATE POLICY "Users can view own points"
ON point_transactions FOR SELECT
USING (auth.uid() = user_id);

-- System can create point transactions (via function)
CREATE POLICY "System can create point transactions"
ON point_transactions FOR INSERT
WITH CHECK (true);

-- ============================================
-- PAYMENTS POLICIES
-- ============================================

-- Users can view their own payments
CREATE POLICY "Users can view own payments"
ON payments FOR SELECT
USING (auth.uid() = user_id);

-- System can create payments (via Stripe webhook)
CREATE POLICY "System can create payments"
ON payments FOR INSERT
WITH CHECK (true);

-- System can update payment status
CREATE POLICY "System can update payments"
ON payments FOR UPDATE
USING (true);

-- ============================================
-- CREATOR EARNINGS POLICIES
-- ============================================

-- Creators can view their own earnings
CREATE POLICY "Creators can view own earnings"
ON creator_earnings FOR SELECT
USING (auth.uid() = creator_id);

-- System can create earnings records
CREATE POLICY "System can create earnings"
ON creator_earnings FOR INSERT
WITH CHECK (true);

-- System can update earnings status
CREATE POLICY "System can update earnings"
ON creator_earnings FOR UPDATE
USING (true);

-- ============================================
-- GRANT PERMISSIONS
-- ============================================

-- Grant authenticated users access to tables
GRANT USAGE ON SCHEMA public TO authenticated, anon;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated, anon;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated, anon;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated, anon;

-- ============================================
-- END OF RLS POLICIES
-- ============================================