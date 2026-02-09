-- Enable Realtime for messages table
-- This allows us to subscribe to INSERT, UPDATE, and DELETE events

-- Enable REPLICA IDENTITY FULL to get all columns in the payload
ALTER TABLE messages REPLICA IDENTITY FULL;

-- Enable realtime for the messages table (if not already enabled)
-- Note: Supabase enables realtime by default, but this ensures it's on
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
