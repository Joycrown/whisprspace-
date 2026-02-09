-- ============================================
-- FIX: Allow authenticated users to receive real-time messages
-- ============================================
-- Supabase Realtime respects RLS. The previous policy was too restrictive
-- and prevented real-time events from being delivered to thread participants.
--
-- This migration:
-- 1. Drops the old restrictive policy
-- 2. Creates a new policy that allows authenticated users to see messages
--    in threads they can view (public threads + threads they have access to)

-- Drop the old policy
DROP POLICY IF EXISTS "Users can view messages in accessible threads" ON messages;

-- Create new, more permissive policy for Realtime compatibility
-- This allows any authenticated user to see messages in:
-- 1. Public threads
-- 2. Threads where they are the sender
-- 3. Threads they have explicit access to (via the has_thread_access function)
CREATE POLICY "Authenticated users can view messages"
ON messages FOR SELECT
USING (
    -- Allow if the thread is public
    EXISTS (
        SELECT 1 FROM threads
        WHERE threads.id = messages.thread_id
        AND threads.privacy = 'public'
        AND threads.deleted_at IS NULL
    )
    -- OR the user is the sender
    OR sender_id = auth.uid()
    -- OR the user has explicit access
    OR has_thread_access(thread_id, auth.uid())
);

-- Ensure messages table has REPLICA IDENTITY FULL for complete payloads
ALTER TABLE messages REPLICA IDENTITY FULL;
