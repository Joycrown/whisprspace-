-- EMERGENCY BYPASS: Temporarily disable RLS on messages table
-- This is a TEST ONLY to confirm RLS is the blocker
-- YOU MUST RE-ENABLE THIS AFTER TESTING

ALTER TABLE messages DISABLE ROW LEVEL SECURITY;

-- After testing, run:
-- ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
