-- ============================================
-- POPULATE BAD WORDS FILTER (OPTIONAL)
-- Run this in Supabase Dashboard > SQL Editor
-- ============================================

-- This is a starter list. Add more words based on your community needs.

INSERT INTO bad_words (word, severity, is_active) VALUES
  -- Common spam words
  ('viagra', 'high', true),
  ('cialis', 'high', true),
  ('casino', 'medium', true),
  ('lottery', 'medium', true),
  ('winner', 'low', true),
  ('congratulations', 'low', true),
  
  -- Scam indicators
  ('free money', 'high', true),
  ('click here', 'medium', true),
  ('limited time', 'low', true),
  ('act now', 'low', true),
  
  -- Add your community-specific words here
  ('spam', 'medium', true),
  ('scam', 'high', true)
  
ON CONFLICT (word) DO NOTHING;

-- ============================================
-- VERIFY BAD WORDS ADDED
-- ============================================

SELECT 
  word,
  severity,
  is_active,
  created_at
FROM bad_words
ORDER BY severity DESC, word ASC;

-- ============================================
-- TEST BAD WORDS FILTER
-- ============================================

-- Test if filter catches words
SELECT * FROM check_bad_words('This is a spam message with free money!');
-- Should return: has_bad_words = true, matched_words = ["spam", "free money"]

SELECT * FROM check_bad_words('This is a clean message.');
-- Should return: has_bad_words = false, matched_words = []

-- ============================================
-- MANAGE BAD WORDS
-- ============================================

-- Disable a word temporarily:
-- UPDATE bad_words SET is_active = false WHERE word = 'some-word';

-- Remove a word permanently:
-- DELETE FROM bad_words WHERE word = 'some-word';

-- Add more words:
-- INSERT INTO bad_words (word, severity, is_active) 
-- VALUES ('newword', 'medium', true);
