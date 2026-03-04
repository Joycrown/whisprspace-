-- ============================================
-- WhisprSpace Storage Setup
-- ============================================

-- Create the thread-attachments bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'thread-attachments', 
  'thread-attachments', 
  true, 
  52428800, -- 50MB
  ARRAY['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'application/pdf', 'text/plain']
)
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- STORAGE RLS POLICIES
-- ============================================

-- Enable RLS on storage.objects (if not already enabled)
DO $$
BEGIN
  BEGIN
    ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
  EXCEPTION
    WHEN insufficient_privilege THEN
      -- On hosted Supabase, storage ownership may not allow this statement.
      RAISE NOTICE 'Skipping ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY (insufficient privilege).';
  END;
END
$$;

-- 1. Anyone can view/download attachments (Public bucket)
DROP POLICY IF EXISTS "Public Read Access" ON storage.objects;
CREATE POLICY "Public Read Access"
ON storage.objects FOR SELECT
USING ( bucket_id = 'thread-attachments' );

-- 2. Authenticated and Anonymous users can upload files
-- We allow both 'authenticated' and 'anon' roles because WhisprSpace supports anonymous threads
DROP POLICY IF EXISTS "Users can upload attachments" ON storage.objects;
CREATE POLICY "Users can upload attachments"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'thread-attachments' 
  AND (auth.role() = 'authenticated' OR auth.role() = 'anon')
);

-- 3. Users can update their own attachments
DROP POLICY IF EXISTS "Users can update own attachments" ON storage.objects;
CREATE POLICY "Users can update own attachments"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'thread-attachments' 
  AND auth.uid() = owner
);

-- 4. Users can delete their own attachments
DROP POLICY IF EXISTS "Users can delete own attachments" ON storage.objects;
CREATE POLICY "Users can delete own attachments"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'thread-attachments' 
  AND auth.uid() = owner
);

-- Note: We don't restrict by thread access here for performance, 
-- but filenames include the thread ID for organization.
-- The app logic maintains the connection between message and attachment.
