-- Fix RLS policies for thread_participants to ensure join/leave and counts work

-- Ensure RLS is enabled
ALTER TABLE public.thread_participants ENABLE ROW LEVEL SECURITY;

-- Drop old policies if they exist
DROP POLICY IF EXISTS "Public threads are joinable by everyone" ON public.thread_participants;
DROP POLICY IF EXISTS "Users can join private threads if invited" ON public.thread_participants;
DROP POLICY IF EXISTS "Users can leave threads" ON public.thread_participants;
DROP POLICY IF EXISTS "Everyone can view participants" ON public.thread_participants;

-- Allow reading participants for threads the user can access
CREATE POLICY "Users can view thread participants"
  ON public.thread_participants
  FOR SELECT
  USING (
    -- Public threads are visible to everyone (including anon)
    EXISTS (
      SELECT 1
      FROM public.threads t
      WHERE t.id = thread_participants.thread_id
      AND t.privacy = 'public'
    )
    OR
    -- Authenticated users can view participants if they have access
    has_thread_access(thread_participants.thread_id, auth.uid())
  );

-- Allow joining a thread if user has access (public or invited/purchased/creator)
CREATE POLICY "Users can join threads they can access"
  ON public.thread_participants
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND has_thread_access(thread_participants.thread_id, auth.uid())
  );

-- Allow users to leave threads they joined
CREATE POLICY "Users can leave threads they joined"
  ON public.thread_participants
  FOR DELETE
  USING (auth.uid() = user_id);

-- Allow users to update their own participant row (e.g. last_read_at)
CREATE POLICY "Users can update their participant record"
  ON public.thread_participants
  FOR UPDATE
  USING (auth.uid() = user_id);
