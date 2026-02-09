-- Create message reactions table for emoji reactions
CREATE TABLE message_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID REFERENCES messages(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  reaction_type TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(message_id, user_id, reaction_type)
);

-- Create indexes for better query performance
CREATE INDEX idx_message_reactions_message ON message_reactions(message_id);
CREATE INDEX idx_message_reactions_user ON message_reactions(user_id);
CREATE INDEX idx_message_reactions_type ON message_reactions(reaction_type);

-- Enable RLS
ALTER TABLE message_reactions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view all reactions"
ON message_reactions FOR SELECT
USING (true);

CREATE POLICY "Users can add reactions"
ON message_reactions FOR INSERT
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete their own reactions"
ON message_reactions FOR DELETE
USING (user_id = auth.uid());

-- Enable realtime
ALTER TABLE message_reactions REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE message_reactions;
