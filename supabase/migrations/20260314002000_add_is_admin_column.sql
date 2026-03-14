-- Add is_admin column to users table
ALTER TABLE users ADD COLUMN is_admin BOOLEAN DEFAULT FALSE;

-- Create index for performance
CREATE INDEX idx_users_is_admin ON users(is_admin) WHERE is_admin = TRUE;

-- Function to sync is_admin status from admin_users to users
CREATE OR REPLACE FUNCTION sync_user_admin_status()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    UPDATE users SET is_admin = TRUE WHERE id = NEW.user_id;
  ELSIF (TG_OP = 'DELETE') THEN
    UPDATE users SET is_admin = FALSE WHERE id = OLD.user_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Trigger to keep users.is_admin in sync with admin_users table
DROP TRIGGER IF EXISTS tr_sync_user_admin_status ON admin_users;
CREATE TRIGGER tr_sync_user_admin_status
AFTER INSERT OR DELETE ON admin_users
FOR EACH ROW EXECUTE FUNCTION sync_user_admin_status();

-- Backfill existing admin users
UPDATE users 
SET is_admin = TRUE 
WHERE id IN (SELECT user_id FROM admin_users);
