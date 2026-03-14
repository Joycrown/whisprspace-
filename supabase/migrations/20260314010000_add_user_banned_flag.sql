-- Migration: Add is_banned column to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_banned BOOLEAN DEFAULT FALSE;

-- Update existing users based on banned_users table
UPDATE users u
SET is_banned = EXISTS (
  SELECT 1 FROM banned_users bu 
  WHERE bu.user_id = u.id 
  AND (bu.is_permanent = TRUE OR bu.expires_at > NOW())
);

-- Trigger to keep is_banned in sync with banned_users
CREATE OR REPLACE FUNCTION sync_user_ban_status()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    UPDATE users SET is_banned = TRUE WHERE id = NEW.user_id;
  ELSIF (TG_OP = 'DELETE') THEN
    UPDATE users SET is_banned = FALSE WHERE id = OLD.user_id;
  ELSIF (TG_OP = 'UPDATE') THEN
    IF (NEW.is_permanent = TRUE OR (NEW.expires_at IS NOT NULL AND NEW.expires_at > NOW())) THEN
      UPDATE users SET is_banned = TRUE WHERE id = NEW.user_id;
    ELSE
      UPDATE users SET is_banned = FALSE WHERE id = NEW.user_id;
    END IF;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_sync_user_ban_status ON banned_users;
CREATE TRIGGER tr_sync_user_ban_status
AFTER INSERT OR UPDATE OR DELETE ON banned_users
FOR EACH ROW EXECUTE FUNCTION sync_user_ban_status();
