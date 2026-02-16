-- Verify Schema - Run this in STAGING SQL Editor
-- This will show you the actual columns in each table

-- Check question_banks columns
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'question_banks'
ORDER BY ordinal_position;

-- Check questions columns
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'questions'
ORDER BY ordinal_position;

-- Check which migrations have been applied
SELECT version, name, created_at
FROM supabase_migrations.schema_migrations
ORDER BY version DESC
LIMIT 10;
