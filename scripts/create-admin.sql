-- ============================================
-- CREATE FIRST ADMIN USER
-- Run this in Supabase Dashboard > SQL Editor
-- ============================================

-- STEP 1: Find your user UUID
-- Go to: Dashboard > Authentication > Users
-- Copy your user UUID

-- STEP 2: Replace 'YOUR_USER_UUID' below with your actual UUID
-- STEP 3: Run this SQL

INSERT INTO admin_users (user_id, role, permissions)
VALUES (
  'YOUR_USER_UUID',  -- ← Replace this with your user UUID
  'super_admin',
  '{"all": true}'::jsonb
);

-- ============================================
-- VERIFY ADMIN USER CREATED
-- ============================================

SELECT 
  au.user_id,
  au.role,
  u.anonymous_id,
  u.email,
  au.created_at
FROM admin_users au
JOIN users u ON u.id = au.user_id
WHERE au.user_id = 'YOUR_USER_UUID';  -- ← Replace with your UUID

-- If you see a row, you're all set! ✓

-- ============================================
-- OPTIONAL: Create additional admins/moderators
-- ============================================

-- Make another user an admin:
-- INSERT INTO admin_users (user_id, role, permissions)
-- VALUES ('another-user-uuid', 'admin', '{"manage_users": true, "manage_content": true}'::jsonb);

-- Make another user a moderator:
-- INSERT INTO admin_users (user_id, role, permissions)
-- VALUES ('moderator-user-uuid', 'moderator', '{"review_reports": true}'::jsonb);
