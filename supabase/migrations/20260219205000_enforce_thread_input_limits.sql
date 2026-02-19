-- Enforce thread title/content limits end-to-end.
-- NOTE: Constraints are added as NOT VALID so existing historical rows do not block deploys.
-- New/updated rows are still validated immediately.

ALTER TABLE public.threads
  DROP CONSTRAINT IF EXISTS threads_title_check;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'threads_title_length_check'
      AND conrelid = 'public.threads'::regclass
  ) THEN
    ALTER TABLE public.threads
      ADD CONSTRAINT threads_title_length_check
      CHECK (char_length(title) <= 200) NOT VALID;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'threads_content_length_check'
      AND conrelid = 'public.threads'::regclass
  ) THEN
    ALTER TABLE public.threads
      ADD CONSTRAINT threads_content_length_check
      CHECK (char_length(content) <= 5000) NOT VALID;
  END IF;
END
$$;
