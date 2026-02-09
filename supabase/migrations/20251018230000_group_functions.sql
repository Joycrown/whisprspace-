-- ============================================
-- GROUP MANAGEMENT FUNCTIONS
-- ============================================

-- Function to increment group member count
CREATE OR REPLACE FUNCTION increment_group_members(group_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE groups
  SET current_members = current_members + 1,
      updated_at = NOW()
  WHERE id = group_id;
END;
$$ LANGUAGE plpgsql;

-- Function to decrement group member count
CREATE OR REPLACE FUNCTION decrement_group_members(group_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE groups
  SET current_members = GREATEST(current_members - 1, 0),
      updated_at = NOW()
  WHERE id = group_id;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-increment members when someone joins
CREATE OR REPLACE FUNCTION auto_increment_group_members()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE groups
  SET current_members = current_members + 1,
      updated_at = NOW()
  WHERE id = NEW.group_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_auto_increment_group_members
AFTER INSERT ON group_members
FOR EACH ROW EXECUTE FUNCTION auto_increment_group_members();

-- Trigger to auto-decrement members when someone leaves
CREATE OR REPLACE FUNCTION auto_decrement_group_members()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE groups
  SET current_members = GREATEST(current_members - 1, 0),
      updated_at = NOW()
  WHERE id = OLD.group_id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_auto_decrement_group_members
AFTER DELETE ON group_members
FOR EACH ROW EXECUTE FUNCTION auto_decrement_group_members();

-- Function to check if group is full
CREATE OR REPLACE FUNCTION is_group_full(group_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  group_record RECORD;
BEGIN
  SELECT current_members, max_members INTO group_record
  FROM groups
  WHERE id = group_id;
  
  RETURN group_record.current_members >= group_record.max_members;
END;
$$ LANGUAGE plpgsql;
