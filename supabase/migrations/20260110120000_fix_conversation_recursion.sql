-- ============================================
-- FIX INFINITE RECURSION IN CONVERSATION_PARTICIPANTS RLS POLICY (v2)
-- ============================================

-- 1. Create a security definer function to get a user's conversations
-- This bypasses RLS to avoid the infinite loop of checking the table to see if you can check the table
-- STABLE means it returns the same result for the same arguments within a transaction
CREATE OR REPLACE FUNCTION get_auth_user_conversations()
RETURNS SETOF uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT conversation_id 
  FROM conversation_participants 
  WHERE user_id = auth.uid();
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_auth_user_conversations TO authenticated;

-- 2. Drop the problematic policy
DROP POLICY IF EXISTS "Users can view conversation participants" ON conversation_participants;

-- 3. Create the new policy using the security definer function
CREATE POLICY "Users can view conversation participants"
ON conversation_participants FOR SELECT
USING (
  conversation_id IN ( SELECT get_auth_user_conversations() )
);
