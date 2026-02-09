-- ============================================
-- FIX INFINITE RECURSION IN CONVERSATION_PARTICIPANTS RLS POLICY
-- ============================================

DROP POLICY IF EXISTS "Users can view conversation participants" ON conversation_participants;

CREATE POLICY "Users can view conversation participants"
ON conversation_participants FOR SELECT
USING (
  user_id = auth.uid() 
  OR 
  conversation_id IN (
    SELECT cp.conversation_id 
    FROM conversation_participants cp
    WHERE cp.user_id = auth.uid()
  )
);


CREATE OR REPLACE FUNCTION get_unread_dm_count(p_user_id UUID)
RETURNS INTEGER 
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  unread_count INTEGER;
BEGIN
  SELECT COUNT(DISTINCT dm.id) INTO unread_count
  FROM direct_messages dm
  WHERE dm.conversation_id IN (
    SELECT conversation_id 
    FROM conversation_participants 
    WHERE user_id = p_user_id
  )
  AND dm.sender_id != p_user_id
  AND dm.created_at > (
    SELECT last_read_at 
    FROM conversation_participants 
    WHERE user_id = p_user_id 
    AND conversation_id = dm.conversation_id
  )
  AND dm.is_deleted = FALSE;
  
  RETURN COALESCE(unread_count, 0);
END;
$$ LANGUAGE plpgsql;
