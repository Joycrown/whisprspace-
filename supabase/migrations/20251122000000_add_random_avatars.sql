-- ============================================
-- ADD AVATAR_URL COLUMN AND RANDOM AVATAR ASSIGNMENT
-- ============================================

-- Step 1: Add avatar_url column to users table if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'users' 
    AND column_name = 'avatar_url'
  ) THEN
    ALTER TABLE public.users ADD COLUMN avatar_url TEXT;
  END IF;
END $$;

-- Step 2: Drop existing trigger and function
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS handle_new_user();

-- Step 3: Function to handle new user creation with random avatar assignment
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  random_id TEXT;
  random_avatar TEXT;
BEGIN
  -- Generate random anonymous ID
  random_id := 'ANON_' || LPAD((FLOOR(RANDOM() * 100000000))::TEXT, 8, '0');
  
  -- Generate random avatar (1-10)
  random_avatar := '/avatars/avatar-' || (FLOOR(RANDOM() * 10) + 1)::TEXT || '.png';
  
  -- Insert into public.users table
  INSERT INTO public.users (
    id,
    anonymous_id,
    email,
    avatar_url,
    is_anonymous,
    is_premium,
    points,
    level,
    preferences,
    created_at,
    last_active_at,
    updated_at
  ) VALUES (
    NEW.id,
    random_id,
    NEW.email,
    random_avatar,
    COALESCE(NEW.is_anonymous, true),
    false,
    0,
    1,
    '{
      "theme": "system",
      "notifications": {
        "email": false,
        "push": true,
        "inApp": true,
        "likes": true,
        "replies": true,
        "mentions": true,
        "groupInvites": true
      },
      "privacy": {
        "showOnlineStatus": false,
        "allowDirectMessages": false
      }
    }'::jsonb,
    NOW(),
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO NOTHING;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 4: Create trigger to auto-create user records
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Step 5: Update existing users who don't have avatars
UPDATE public.users
SET avatar_url = '/avatars/avatar-' || (FLOOR(RANDOM() * 10) + 1)::TEXT || '.png'
WHERE avatar_url IS NULL OR avatar_url = '';
