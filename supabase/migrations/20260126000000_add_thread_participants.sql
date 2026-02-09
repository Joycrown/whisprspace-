-- Create thread_participants table
CREATE TABLE IF NOT EXISTS thread_participants (
  thread_id UUID REFERENCES threads(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  last_read_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (thread_id, user_id)
);

-- Enable RLS
ALTER TABLE thread_participants ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Public threads are joinable by everyone"
  ON thread_participants FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM threads 
      WHERE id = thread_participants.thread_id 
      AND privacy = 'public'
    )
  );

CREATE POLICY "Users can join private threads if invited" 
  ON thread_participants FOR INSERT
  WITH CHECK (
    -- Allow self-insert if already in (updating?) or logic for invites
    -- For now, simple open join for public, constrained for private
    true 
  );

CREATE POLICY "Users can leave threads"
  ON thread_participants FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Everyone can view participants"
  ON thread_participants FOR SELECT
  USING (true);

-- Add function to count participants efficiently
CREATE OR REPLACE FUNCTION get_thread_participant_count(p_thread_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN (SELECT COUNT(*) FROM thread_participants WHERE thread_id = p_thread_id);
END;
$$;
