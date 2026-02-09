-- Add type column to conversations
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT 'direct';

-- Create index on type
CREATE INDEX IF NOT EXISTS idx_conversations_type ON conversations(type);

-- Update get_or_create_conversation to only look for 'direct' conversations
CREATE OR REPLACE FUNCTION get_or_create_conversation(
  user1_id UUID,
  user2_id UUID
)
RETURNS UUID
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  existing_conversation_id UUID;
  new_conversation_id UUID;
BEGIN
  -- Check if DIRECT conversation already exists between these two users
  SELECT c.id INTO existing_conversation_id
  FROM conversations c
  WHERE c.type = 'direct' -- Only look for direct conversations
  AND EXISTS (
    SELECT 1 FROM conversation_participants cp1
    WHERE cp1.conversation_id = c.id AND cp1.user_id = user1_id
  )
  AND EXISTS (
    SELECT 1 FROM conversation_participants cp2
    WHERE cp2.conversation_id = c.id AND cp2.user_id = user2_id
  )
  AND (
    SELECT COUNT(*) FROM conversation_participants cp
    WHERE cp.conversation_id = c.id
  ) = 2;

  -- If conversation exists, return it
  IF existing_conversation_id IS NOT NULL THEN
    RETURN existing_conversation_id;
  END IF;

  -- Otherwise, create new DIRECT conversation
  INSERT INTO conversations (type) VALUES ('direct')
  RETURNING id INTO new_conversation_id;

  -- Add both participants
  INSERT INTO conversation_participants (conversation_id, user_id)
  VALUES 
    (new_conversation_id, user1_id),
    (new_conversation_id, user2_id);

  RETURN new_conversation_id;
END;
$$ LANGUAGE plpgsql;

-- Function to explicitly create a ONE-TIME conversation
CREATE OR REPLACE FUNCTION create_one_time_conversation(
  sender_id UUID,
  recipient_id UUID
)
RETURNS UUID
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_conversation_id UUID;
BEGIN
  -- Always create a new conversation for one-time messages
  INSERT INTO conversations (type) VALUES ('one_time')
  RETURNING id INTO new_conversation_id;

  -- Add both participants
  INSERT INTO conversation_participants (conversation_id, user_id)
  VALUES 
    (new_conversation_id, sender_id),
    (new_conversation_id, recipient_id);

  RETURN new_conversation_id;
END;
$$ LANGUAGE plpgsql;
