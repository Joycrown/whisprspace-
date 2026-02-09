-- Migration: Fix update_user_username to prevent false success
-- Description: Enforce auth.uid() match and return error when no rows updated
-- Date: 2026-02-06

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
  rows_updated INTEGER;
BEGIN
  -- Ensure the caller is authenticated and updating their own record
  IF auth.uid() IS NULL THEN
    RETURN json_build_object('success', FALSE, 'error', 'Not authenticated');
  END IF;

  IF user_id IS DISTINCT FROM auth.uid() THEN
    RETURN json_build_object('success', FALSE, 'error', 'Unauthorized');
  END IF;

  -- Normalize input
  new_username := TRIM(new_username);

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

  GET DIAGNOSTICS rows_updated = ROW_COUNT;

  IF rows_updated = 0 THEN
    RETURN json_build_object('success', FALSE, 'error', 'Username update failed');
  END IF;

  RETURN json_build_object('success', TRUE, 'username', new_username);
END;
$$ LANGUAGE plpgsql;
