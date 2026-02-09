-- EMERGENCY FIX: Simplify messages INSERT policy to unblock message sending
-- The complex has_thread_access() function is causing RLS evaluation to hang

-- Drop the problematic policy
DROP POLICY IF EXISTS "Authenticated users can post messages" ON messages;

--Create a simpler, direct policy
CREATE POLICY "Authenticated users can post messages (simplified)"
ON messages FOR INSERT
WITH CHECK (
  auth.uid() = sender_id
  AND EXISTS (
    SELECT 1 FROM threads t
    WHERE t.id = thread_id
    AND (
      t.privacy = 'public'
      OR t.creator_id = auth.uid()
    )
  )
);
