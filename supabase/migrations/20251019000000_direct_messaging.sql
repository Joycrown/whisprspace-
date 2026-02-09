-- ============================================
-- DIRECT MESSAGING SYSTEM
-- Anonymous 1-on-1 messaging between users
-- ============================================

-- ============================================
-- CONVERSATIONS TABLE
-- ============================================
CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_message_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- CONVERSATION PARTICIPANTS
-- ============================================
CREATE TABLE conversation_participants (
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  last_read_at TIMESTAMPTZ DEFAULT NOW(),
  is_muted BOOLEAN DEFAULT FALSE,
  PRIMARY KEY (conversation_id, user_id)
);

CREATE INDEX idx_conversation_participants_user ON conversation_participants(user_id);
CREATE INDEX idx_conversation_participants_conversation ON conversation_participants(conversation_id);

-- ============================================
-- DIRECT MESSAGES
-- ============================================
CREATE TYPE dm_message_type AS ENUM ('text', 'image', 'file', 'system');

CREATE TABLE direct_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES users(id) ON DELETE SET NULL,
  content TEXT NOT NULL,
  message_type dm_message_type DEFAULT 'text',
  attachment_url TEXT,
  is_edited BOOLEAN DEFAULT FALSE,
  is_deleted BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_direct_messages_conversation ON direct_messages(conversation_id, created_at DESC);
CREATE INDEX idx_direct_messages_sender ON direct_messages(sender_id);

-- ============================================
-- MESSAGE READ RECEIPTS
-- ============================================
CREATE TABLE message_read_receipts (
  message_id UUID REFERENCES direct_messages(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  read_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (message_id, user_id)
);

CREATE INDEX idx_message_read_receipts_message ON message_read_receipts(message_id);
CREATE INDEX idx_message_read_receipts_user ON message_read_receipts(user_id);

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Function: Get or create conversation between two users
CREATE OR REPLACE FUNCTION get_or_create_conversation(
  user1_id UUID,
  user2_id UUID
)
RETURNS UUID AS $$
DECLARE
  existing_conversation_id UUID;
  new_conversation_id UUID;
BEGIN
  -- Check if conversation already exists between these two users
  SELECT c.id INTO existing_conversation_id
  FROM conversations c
  WHERE EXISTS (
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

  -- Otherwise, create new conversation
  INSERT INTO conversations DEFAULT VALUES
  RETURNING id INTO new_conversation_id;

  -- Add both participants
  INSERT INTO conversation_participants (conversation_id, user_id)
  VALUES 
    (new_conversation_id, user1_id),
    (new_conversation_id, user2_id);

  RETURN new_conversation_id;
END;
$$ LANGUAGE plpgsql;

-- Function: Update conversation's last_message_at
CREATE OR REPLACE FUNCTION update_conversation_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE conversations
  SET 
    last_message_at = NEW.created_at,
    updated_at = NEW.created_at
  WHERE id = NEW.conversation_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_conversation_timestamp
AFTER INSERT ON direct_messages
FOR EACH ROW EXECUTE FUNCTION update_conversation_timestamp();

-- Function: Get unread message count for user
CREATE OR REPLACE FUNCTION get_unread_dm_count(p_user_id UUID)
RETURNS INTEGER AS $$
DECLARE
  unread_count INTEGER;
BEGIN
  SELECT COUNT(DISTINCT dm.id) INTO unread_count
  FROM direct_messages dm
  JOIN conversation_participants cp ON cp.conversation_id = dm.conversation_id
  WHERE cp.user_id = p_user_id
  AND dm.sender_id != p_user_id
  AND dm.created_at > cp.last_read_at
  AND dm.is_deleted = FALSE;
  
  RETURN COALESCE(unread_count, 0);
END;
$$ LANGUAGE plpgsql;

-- Function: Mark conversation as read
CREATE OR REPLACE FUNCTION mark_conversation_read(
  p_conversation_id UUID,
  p_user_id UUID
)
RETURNS VOID AS $$
BEGIN
  UPDATE conversation_participants
  SET last_read_at = NOW()
  WHERE conversation_id = p_conversation_id
  AND user_id = p_user_id;
END;
$$ LANGUAGE plpgsql;

-- Function: Auto-create read receipts
CREATE OR REPLACE FUNCTION auto_create_read_receipt()
RETURNS TRIGGER AS $$
BEGIN
  -- Create read receipt for sender automatically
  INSERT INTO message_read_receipts (message_id, user_id)
  VALUES (NEW.id, NEW.sender_id);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_auto_create_read_receipt
AFTER INSERT ON direct_messages
FOR EACH ROW EXECUTE FUNCTION auto_create_read_receipt();

-- Function: Delete old messages (cleanup)
CREATE OR REPLACE FUNCTION clean_old_messages()
RETURNS VOID AS $$
BEGIN
  -- Soft delete messages older than 90 days
  UPDATE direct_messages
  SET is_deleted = TRUE
  WHERE created_at < NOW() - INTERVAL '90 days'
  AND is_deleted = FALSE;
  
  -- Hard delete messages marked as deleted for 30+ days
  DELETE FROM direct_messages
  WHERE is_deleted = TRUE
  AND updated_at < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE direct_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_read_receipts ENABLE ROW LEVEL SECURITY;

-- Conversations: Users can view conversations they're part of
CREATE POLICY "Users can view their conversations"
ON conversations FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM conversation_participants
    WHERE conversation_id = conversations.id
    AND user_id = auth.uid()
  )
);

-- Conversation Participants: Users can view participants of their conversations
CREATE POLICY "Users can view conversation participants"
ON conversation_participants FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM conversation_participants cp
    WHERE cp.conversation_id = conversation_participants.conversation_id
    AND cp.user_id = auth.uid()
  )
);

-- Conversation Participants: Users can update their own participant record
CREATE POLICY "Users can update their participant record"
ON conversation_participants FOR UPDATE
USING (user_id = auth.uid());

-- Direct Messages: Users can view messages in their conversations
CREATE POLICY "Users can view conversation messages"
ON direct_messages FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM conversation_participants
    WHERE conversation_id = direct_messages.conversation_id
    AND user_id = auth.uid()
  )
  AND is_deleted = FALSE
);

-- Direct Messages: Users can send messages to their conversations
CREATE POLICY "Users can send messages"
ON direct_messages FOR INSERT
WITH CHECK (
  sender_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM conversation_participants
    WHERE conversation_id = direct_messages.conversation_id
    AND user_id = auth.uid()
  )
);

-- Direct Messages: Users can update their own messages
CREATE POLICY "Users can edit own messages"
ON direct_messages FOR UPDATE
USING (sender_id = auth.uid());

-- Direct Messages: Users can soft delete their own messages
CREATE POLICY "Users can delete own messages"
ON direct_messages FOR DELETE
USING (sender_id = auth.uid());

-- Read Receipts: Users can view read receipts in their conversations
CREATE POLICY "Users can view read receipts"
ON message_read_receipts FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM direct_messages dm
    JOIN conversation_participants cp ON cp.conversation_id = dm.conversation_id
    WHERE dm.id = message_read_receipts.message_id
    AND cp.user_id = auth.uid()
  )
);

-- Read Receipts: Users can create read receipts for messages they received
CREATE POLICY "Users can create read receipts"
ON message_read_receipts FOR INSERT
WITH CHECK (user_id = auth.uid());

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================

CREATE INDEX idx_conversations_last_message ON conversations(last_message_at DESC);
CREATE INDEX idx_direct_messages_created ON direct_messages(created_at DESC);
CREATE INDEX idx_direct_messages_deleted ON direct_messages(is_deleted) WHERE is_deleted = FALSE;

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON TABLE conversations IS 'Stores conversation metadata between users';
COMMENT ON TABLE conversation_participants IS 'Links users to conversations';
COMMENT ON TABLE direct_messages IS 'Stores direct messages between users';
COMMENT ON TABLE message_read_receipts IS 'Tracks when messages are read by recipients';
COMMENT ON FUNCTION get_or_create_conversation IS 'Gets existing conversation or creates new one between two users';
COMMENT ON FUNCTION get_unread_dm_count IS 'Returns count of unread direct messages for a user';
COMMENT ON FUNCTION mark_conversation_read IS 'Marks all messages in a conversation as read';
