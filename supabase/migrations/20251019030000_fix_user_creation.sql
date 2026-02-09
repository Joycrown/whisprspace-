-- ============================================
-- FIX USER CREATION
-- Auto-create user records on Supabase Auth signup
-- ============================================

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS handle_new_user();

-- Function to handle new user creation
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  random_id TEXT;
BEGIN
  -- Generate random anonymous ID
  random_id := 'ANON_' || LPAD((FLOOR(RANDOM() * 100000000))::TEXT, 8, '0');
  
  -- Insert into public.users table
  INSERT INTO public.users (
    id,
    anonymous_id,
    email,
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

-- Create trigger to auto-create user records
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================
-- UPDATE RLS POLICY FOR USER CREATION
-- ============================================

-- Allow service role to insert users (for the trigger)
DROP POLICY IF EXISTS "Service role can insert users" ON users;
CREATE POLICY "Service role can insert users"
ON users FOR INSERT
WITH CHECK (true);

-- Ensure users can still select their own data
DROP POLICY IF EXISTS "Users can view all profiles" ON users;
CREATE POLICY "Users can view all profiles"
ON users FOR SELECT
USING (true);

-- ============================================
-- BACKFILL EXISTING AUTH USERS
-- ============================================

-- Create user records for any existing auth users that don't have them
INSERT INTO public.users (
  id,
  anonymous_id,
  email,
  is_anonymous,
  is_premium,
  points,
  level,
  created_at,
  last_active_at
)
SELECT 
  au.id,
  'ANON_' || LPAD((FLOOR(RANDOM() * 100000000))::TEXT, 8, '0'),
  au.email,
  COALESCE(au.is_anonymous, true),
  false,
  0,
  1,
  au.created_at,
  COALESCE(au.last_sign_in_at, au.created_at)
FROM auth.users au
LEFT JOIN public.users pu ON pu.id = au.id
WHERE pu.id IS NULL;
