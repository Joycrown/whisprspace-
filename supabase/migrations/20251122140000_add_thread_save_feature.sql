-- ============================================
-- ADD THREAD SAVE FUNCTIONALITY
-- Add is_saved column and update visibility logic
-- ============================================

-- Step 1: Add is_saved column to threads table
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'threads' 
    AND column_name = 'is_saved'
  ) THEN
    ALTER TABLE public.threads ADD COLUMN is_saved BOOLEAN DEFAULT false;
  END IF;
END $$;

-- Step 2: Create index for faster queries on saved threads
CREATE INDEX IF NOT EXISTS idx_threads_is_saved ON public.threads(is_saved);
CREATE INDEX IF NOT EXISTS idx_threads_creator_is_saved ON public.threads(creator_id, is_saved);

-- Step 3: Update fetchThreads to exclude saved threads from public view
-- This is handled in the application code, but we can add a database view for convenience

CREATE OR REPLACE VIEW public_threads AS
SELECT *
FROM public.threads
WHERE deleted_at IS NULL
  AND (is_saved = false OR is_saved IS NULL);

-- Step 4: Create function to cleanup expired threads
-- This function deletes threads that are expired AND not saved
CREATE OR REPLACE FUNCTION cleanup_expired_threads()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  -- Delete expired threads that are NOT saved
  WITH deleted AS (
    DELETE FROM public.threads
    WHERE expires_at < NOW()
      AND (is_saved = false OR is_saved IS NULL)
      AND deleted_at IS NULL
    RETURNING id
  )
  SELECT COUNT(*) INTO deleted_count FROM deleted;
  
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Step 5: Create a scheduled job to run cleanup (optional, requires pg_cron extension)
-- Uncomment if you have pg_cron extension enabled:
-- SELECT cron.schedule(
--   'cleanup-expired-threads',
--   '0 * * * *',  -- Run every hour
--   $$SELECT cleanup_expired_threads()$$
-- );

-- Alternative: Create a trigger to prevent access to saved threads by non-creators
-- This is better handled in application code for flexibility
