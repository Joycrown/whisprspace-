-- Migration: Fix Username Initialization
-- Description: Update handle_new_user trigger and backfill missing usernames
-- Date: 2026-02-06

-- 1. Update the handle_new_user function to initialize username
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
    username, -- Added username initialization
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
    random_id, -- Initialize username to anonymous_id
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

-- 2. Backfill missing usernames for any users that might have been created while trigger was incomplete
UPDATE users 
SET username = anonymous_id 
WHERE username IS NULL;
