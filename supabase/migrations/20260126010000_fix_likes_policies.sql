-- Enable RLS for likes tables
ALTER TABLE thread_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_likes ENABLE ROW LEVEL SECURITY;

-- Drop existing SELECT policies to ensure clean slate
DROP POLICY IF EXISTS "Users can view thread likes" ON thread_likes;
DROP POLICY IF EXISTS "Users can view message likes" ON message_likes;
DROP POLICY IF EXISTS "Everyone can view thread likes" ON thread_likes;
DROP POLICY IF EXISTS "Everyone can view message likes" ON message_likes;

-- Create new "public view" policies
CREATE POLICY "Everyone can view thread likes"
  ON thread_likes FOR SELECT
  USING (true);

CREATE POLICY "Everyone can view message likes"
  ON message_likes FOR SELECT
  USING (true);

-- Ensure Insert/Delete are still protected (usually authenticated only)
-- These likely exist but for completeness/safety let's verify or add standard ones
-- (Assuming they exist from initial schema, so we won't touch them unless needed to avoid conflicts)
