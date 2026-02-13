-- ============================================
-- MESSAGE DELIVERY RECEIPTS (WhatsApp-style)
-- Persist delivered_at semantics for direct messages
-- ============================================

CREATE TABLE IF NOT EXISTS message_delivery_receipts (
  message_id UUID REFERENCES direct_messages(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  delivered_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (message_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_message_delivery_receipts_message
  ON message_delivery_receipts(message_id);

CREATE INDEX IF NOT EXISTS idx_message_delivery_receipts_user
  ON message_delivery_receipts(user_id);

-- Backfill sender delivery receipts for existing messages.
INSERT INTO message_delivery_receipts (message_id, user_id, delivered_at)
SELECT dm.id, dm.sender_id, dm.created_at
FROM direct_messages dm
WHERE dm.sender_id IS NOT NULL
ON CONFLICT (message_id, user_id) DO NOTHING;

ALTER TABLE message_delivery_receipts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view delivery receipts" ON message_delivery_receipts;
CREATE POLICY "Users can view delivery receipts"
ON message_delivery_receipts FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM direct_messages dm
    JOIN conversation_participants cp ON cp.conversation_id = dm.conversation_id
    WHERE dm.id = message_delivery_receipts.message_id
      AND cp.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Users can create delivery receipts" ON message_delivery_receipts;
CREATE POLICY "Users can create delivery receipts"
ON message_delivery_receipts FOR INSERT
WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM direct_messages dm
    JOIN conversation_participants cp ON cp.conversation_id = dm.conversation_id
    WHERE dm.id = message_delivery_receipts.message_id
      AND cp.user_id = auth.uid()
  )
);

CREATE OR REPLACE FUNCTION mark_message_delivered(
  p_message_id UUID,
  p_user_id UUID DEFAULT auth.uid()
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_message_id IS NULL OR p_user_id IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO message_delivery_receipts (message_id, user_id, delivered_at)
  SELECT dm.id, p_user_id, NOW()
  FROM direct_messages dm
  WHERE dm.id = p_message_id
    AND EXISTS (
      SELECT 1
      FROM conversation_participants cp
      WHERE cp.conversation_id = dm.conversation_id
        AND cp.user_id = p_user_id
    )
  ON CONFLICT (message_id, user_id) DO NOTHING;
END;
$$;

GRANT EXECUTE ON FUNCTION mark_message_delivered(UUID, UUID) TO authenticated;

CREATE OR REPLACE FUNCTION mark_conversation_delivered(
  p_conversation_id UUID,
  p_user_id UUID DEFAULT auth.uid()
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_conversation_id IS NULL OR p_user_id IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO message_delivery_receipts (message_id, user_id, delivered_at)
  SELECT dm.id, p_user_id, NOW()
  FROM direct_messages dm
  WHERE dm.conversation_id = p_conversation_id
    AND dm.sender_id IS DISTINCT FROM p_user_id
    AND EXISTS (
      SELECT 1
      FROM conversation_participants cp
      WHERE cp.conversation_id = dm.conversation_id
        AND cp.user_id = p_user_id
    )
  ON CONFLICT (message_id, user_id) DO NOTHING;
END;
$$;

GRANT EXECUTE ON FUNCTION mark_conversation_delivered(UUID, UUID) TO authenticated;

CREATE OR REPLACE FUNCTION auto_create_delivery_receipt()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.sender_id IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO message_delivery_receipts (message_id, user_id, delivered_at)
  VALUES (NEW.id, NEW.sender_id, NEW.created_at)
  ON CONFLICT (message_id, user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_auto_create_delivery_receipt ON direct_messages;
CREATE TRIGGER trigger_auto_create_delivery_receipt
AFTER INSERT ON direct_messages
FOR EACH ROW
EXECUTE FUNCTION auto_create_delivery_receipt();

COMMENT ON TABLE message_delivery_receipts IS 'Tracks when direct messages are delivered to each participant';
COMMENT ON FUNCTION mark_message_delivered(UUID, UUID) IS 'Inserts delivered_at for a direct message participant if not already present';
COMMENT ON FUNCTION mark_conversation_delivered(UUID, UUID) IS 'Inserts delivered_at for all deliverable messages in a conversation for a participant if not already present';
