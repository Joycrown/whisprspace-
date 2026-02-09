-- Migration: Add Username System
-- Description: Add username and username change tracking to users table
-- Date: 2025-10-22
-- 
-- Features:
-- - username column (replaces anonymous_id for display)
-- - last_username_change timestamp (for cooldown)
-- - Unique constraint on lowercase username
-- - Default username to anonymous_id value

-- ============================================
-- Step 1: Add username column
-- ============================================

-- Add username column (nullable initially)
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS username TEXT;

-- ============================================
-- Step 2: Add last_username_change column
-- ============================================

-- Track when user last changed their username
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS last_username_change TIMESTAMPTZ;

-- ============================================
-- Step 3: Set default usernames
-- ============================================

-- Set username to anonymous_id for all existing users
UPDATE users 
SET username = anonymous_id 
WHERE username IS NULL;

-- ============================================
-- Step 4: Add unique constraint
-- ============================================

-- Create unique index on lowercase username (case-insensitive uniqueness)
CREATE UNIQUE INDEX IF NOT EXISTS users_username_lower_idx 
ON users (LOWER(username));

-- ============================================
-- Step 5: Add check constraint
-- ============================================

-- Ensure username length is between 3 and 30 characters
ALTER TABLE users 
ADD CONSTRAINT username_length_check 
CHECK (LENGTH(TRIM(username)) >= 3 AND LENGTH(TRIM(username)) <= 30);

-- ============================================
-- Step 6: Create function to check username availability
-- ============================================

-- Function to check if username is available (case-insensitive)
CREATE OR REPLACE FUNCTION is_username_available(
  check_username TEXT,
  exclude_user_id UUID DEFAULT NULL
)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN NOT EXISTS (
    SELECT 1 
    FROM users 
    WHERE LOWER(username) = LOWER(check_username)
    AND (exclude_user_id IS NULL OR id != exclude_user_id)
  );
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Step 7: Create function to update username
-- ============================================

-- Function to update username with validation
CREATE OR REPLACE FUNCTION update_user_username(
  user_id UUID,
  new_username TEXT
)
RETURNS JSON AS $$
DECLARE
  user_record RECORD;
  days_since_last_change INTEGER;
  cooldown_days INTEGER;
  can_change BOOLEAN;
BEGIN
  -- Get current user data
  SELECT * INTO user_record FROM users WHERE id = user_id;
  
  IF NOT FOUND THEN
    RETURN json_build_object('success', FALSE, 'error', 'User not found');
  END IF;

  -- Check username availability
  IF NOT is_username_available(new_username, user_id) THEN
    RETURN json_build_object('success', FALSE, 'error', 'Username already taken');
  END IF;

  -- Calculate cooldown
  cooldown_days := CASE WHEN user_record.is_premium THEN 7 ELSE 30 END;
  
  -- Check if user can change username
  IF user_record.last_username_change IS NOT NULL THEN
    days_since_last_change := EXTRACT(DAY FROM NOW() - user_record.last_username_change);
    can_change := days_since_last_change >= cooldown_days;
    
    IF NOT can_change THEN
      RETURN json_build_object(
        'success', FALSE, 
        'error', FORMAT('You can change your username again in %s days', cooldown_days - days_since_last_change)
      );
    END IF;
  END IF;

  -- Update username
  UPDATE users 
  SET 
    username = new_username,
    last_username_change = NOW()
  WHERE id = user_id;

  RETURN json_build_object('success', TRUE, 'username', new_username);
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Step 8: Add comment documentation
-- ============================================

COMMENT ON COLUMN users.username IS 'User''s display username. Initially set to anonymous_id, can be changed with cooldown (30 days free, 7 days premium)';
COMMENT ON COLUMN users.last_username_change IS 'Timestamp of last username change, used to enforce cooldown period';
COMMENT ON FUNCTION is_username_available IS 'Check if a username is available (case-insensitive)';
COMMENT ON FUNCTION update_user_username IS 'Update user username with validation and cooldown check';

-- ============================================
-- Step 9: Grant permissions (if using RLS)
-- ============================================

-- Allow users to read usernames
GRANT SELECT (username, last_username_change) ON users TO authenticated;
GRANT SELECT (username, last_username_change) ON users TO anon;

-- Allow users to update their own username via function
GRANT EXECUTE ON FUNCTION update_user_username TO authenticated;
GRANT EXECUTE ON FUNCTION is_username_available TO authenticated;
GRANT EXECUTE ON FUNCTION is_username_available TO anon;

-- ============================================
-- Step 10: Create RLS policies for username
-- ============================================

-- Policy: Users can read all usernames (for mentions, display, etc.)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'users' 
    AND policyname = 'Users can view usernames'
  ) THEN
    CREATE POLICY "Users can view usernames"
      ON users FOR SELECT
      USING (true);
  END IF;
END $$;
