-- ============================================================================
-- RG-107 Migration Verification Script
-- Run this in Supabase Dashboard SQL Editor to verify migration success
-- ============================================================================

-- 1. CHECK NEW COLUMNS EXIST
SELECT
  'COLUMNS' as check_type,
  column_name,
  data_type,
  column_default,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'profiles'
  AND column_name IN ('accessible_prebuilt_bank_ids', 'custom_bank_limit', 'custom_bank_count')
ORDER BY column_name;
-- Expected: 3 rows with correct data types and defaults

-- 2. CHECK CONSTRAINTS EXIST
SELECT
  'CONSTRAINTS' as check_type,
  conname AS constraint_name,
  pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conrelid = 'profiles'::regclass
  AND conname IN ('chk_accessible_prebuilt_bank_ids_is_array', 'chk_custom_bank_limit', 'chk_custom_bank_count')
ORDER BY conname;
-- Expected: 3 rows with CHECK constraints

-- 3. CHECK INDEX EXISTS
SELECT
  'INDEXES' as check_type,
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'profiles'
  AND indexname = 'idx_profiles_accessible_banks';
-- Expected: 1 row with GIN index

-- 4. CHECK FUNCTIONS EXIST
SELECT
  'FUNCTIONS' as check_type,
  routine_name,
  routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN ('update_custom_bank_count', 'create_custom_bank_with_limit_check')
ORDER BY routine_name;
-- Expected: 2 rows (both functions)

-- 5. CHECK TRIGGER EXISTS
SELECT
  'TRIGGERS' as check_type,
  trigger_name,
  event_manipulation,
  event_object_table
FROM information_schema.triggers
WHERE trigger_name = 'trigger_update_custom_bank_count';
-- Expected: 1 row

-- 6. CHECK COLUMN PRIVILEGES (REVOKED)
SELECT
  'PRIVILEGES' as check_type,
  grantee,
  table_name,
  column_name,
  privilege_type
FROM information_schema.column_privileges
WHERE table_name = 'profiles'
  AND column_name IN ('custom_bank_count', 'custom_bank_limit')
  AND grantee = 'authenticated'
  AND privilege_type = 'UPDATE';
-- Expected: 0 rows (UPDATE privilege should be revoked)

-- 7. CHECK DATA MIGRATION (Sample)
SELECT
  'DATA_MIGRATION' as check_type,
  subscription_tier,
  COUNT(*) as user_count,
  COUNT(CASE WHEN custom_bank_limit = 0 THEN 1 END) as free_limit_count,
  COUNT(CASE WHEN custom_bank_limit = 15 THEN 1 END) as basic_limit_count,
  COUNT(CASE WHEN custom_bank_limit IS NULL THEN 1 END) as premium_unlimited_count,
  AVG(custom_bank_count) as avg_custom_banks
FROM profiles
GROUP BY subscription_tier
ORDER BY subscription_tier;
-- Expected: Shows tier-appropriate limits were applied

-- 8. CHECK CUSTOM_BANK_COUNT ACCURACY
SELECT
  'COUNT_ACCURACY' as check_type,
  COUNT(*) as mismatched_count
FROM profiles p
LEFT JOIN (
  SELECT owner_id, COUNT(*) as actual_count
  FROM question_banks
  WHERE is_custom = true
  GROUP BY owner_id
) qb ON qb.owner_id = p.id
WHERE p.custom_bank_count != COALESCE(qb.actual_count, 0);
-- Expected: 0 rows (all counts should match actual)

-- ============================================================================
-- SUCCESS CRITERIA:
-- ✓ 3 new columns exist with correct types
-- ✓ 3 CHECK constraints exist
-- ✓ 1 GIN index exists
-- ✓ 2 functions exist
-- ✓ 1 trigger exists
-- ✓ 0 UPDATE privileges for authenticated role
-- ✓ Data migration applied tier-appropriate values
-- ✓ 0 count mismatches
-- ============================================================================
