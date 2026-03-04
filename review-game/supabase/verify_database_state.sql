-- ================================================================
-- Database State Verification Script
-- Purpose: Verify schema state after manual SQL execution
-- Date: 2026-03-02
-- Related: RG-118, RG-107
-- ================================================================
--
-- INSTRUCTIONS:
-- 1. Copy this entire file
-- 2. Open Supabase Dashboard → SQL Editor
-- 3. Paste and run each section separately
-- 4. Review the results and compare with "Expected Output"
--
-- ================================================================

-- ================================================================
-- SECTION 1: Verify RPC Functions Exist
-- ================================================================
-- Expected: Should return 1 row showing the function exists

SELECT
  routine_name,
  routine_schema,
  routine_type,
  data_type as return_type
FROM information_schema.routines
WHERE routine_name = 'create_custom_bank_with_limit_check'
  AND routine_schema = 'public';

-- Expected Output:
-- routine_name                          | routine_schema | routine_type | return_type
-- --------------------------------------|----------------|--------------|------------
-- create_custom_bank_with_limit_check   | public         | FUNCTION     | uuid
--
-- ❌ If NO ROWS: Function is missing - needs to be created
-- ✅ If 1 ROW: Function exists - type generation issue


-- ================================================================
-- SECTION 2: Verify RPC Function Parameters
-- ================================================================
-- Expected: Should return 5 parameters

SELECT
  parameter_name,
  data_type,
  parameter_default
FROM information_schema.parameters
WHERE specific_name IN (
  SELECT specific_name
  FROM information_schema.routines
  WHERE routine_name = 'create_custom_bank_with_limit_check'
)
ORDER BY ordinal_position;

-- Expected Output:
-- parameter_name | data_type        | parameter_default
-- ---------------|------------------|------------------
-- p_owner_id     | uuid             | NULL
-- p_title        | text             | NULL
-- p_subject      | text             | NULL
-- p_description  | text             | NULL
-- p_difficulty   | text             | NULL
--
-- ❌ If NO ROWS: Function is missing completely
-- ⚠️  If DIFFERENT PARAMS: Function signature doesn't match migration


-- ================================================================
-- SECTION 3: Check teams.game_id Constraint
-- ================================================================
-- Expected: is_nullable should be 'NO' (but currently might be 'YES')

SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'teams'
  AND column_name = 'game_id';

-- Expected Output (SHOULD BE):
-- column_name | data_type | is_nullable | column_default
-- ------------|-----------|-------------|---------------
-- game_id     | uuid      | NO          | NULL
--
-- Current Output (LIKELY):
-- column_name | data_type | is_nullable | column_default
-- ------------|-----------|-------------|---------------
-- game_id     | uuid      | YES         | NULL
--
-- ❌ If is_nullable = 'YES': BROKEN - needs NOT NULL constraint added
-- ✅ If is_nullable = 'NO': CORRECT - previous types were right


-- ================================================================
-- SECTION 4: Check for NULL game_id Values
-- ================================================================
-- Expected: Should return 0 (no NULL values)

SELECT COUNT(*) as null_game_id_count
FROM teams
WHERE game_id IS NULL;

-- Expected Output:
-- null_game_id_count
-- ------------------
-- 0
--
-- ✅ If 0: Safe to add NOT NULL constraint
-- ❌ If > 0: Data corruption - need to investigate and fix rows


-- ================================================================
-- SECTION 5: Verify RG-107 Columns Exist (profiles table)
-- ================================================================
-- Expected: Should return 3 rows

SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'profiles'
  AND column_name IN (
    'accessible_prebuilt_bank_ids',
    'custom_bank_limit',
    'custom_bank_count'
  )
ORDER BY column_name;

-- Expected Output:
-- column_name                     | data_type | is_nullable | column_default
-- --------------------------------|-----------|-------------|---------------
-- accessible_prebuilt_bank_ids    | jsonb     | YES         | NULL
-- custom_bank_count               | integer   | NO          | 0
-- custom_bank_limit               | integer   | YES         | 0
--
-- ❌ If < 3 ROWS: Some columns are missing
-- ✅ If 3 ROWS: All RG-107 columns exist


-- ================================================================
-- SECTION 6: Verify RG-118 Column Exists (games table)
-- ================================================================
-- Expected: Should return 1 row

SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'games'
  AND column_name = 'current_phase';

-- Expected Output:
-- column_name   | data_type | is_nullable | column_default
-- --------------|-----------|-------------|----------------
-- current_phase | text      | YES         | 'regular'
--
-- ❌ If NO ROWS: Column is missing - RG-118 SQL not applied
-- ✅ If 1 ROW: Column exists


-- ================================================================
-- SECTION 7: Check GIN Index on accessible_prebuilt_bank_ids
-- ================================================================
-- Expected: Should return 1 row showing the index exists

SELECT
  indexname,
  tablename,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname = 'idx_profiles_accessible_banks';

-- Expected Output:
-- indexname                     | tablename | indexdef
-- ------------------------------|-----------|------------------------------------------
-- idx_profiles_accessible_banks | profiles  | CREATE INDEX idx_profiles_accessible_banks ON public.profiles USING gin(accessible_prebuilt_bank_ids)
--
-- ❌ If NO ROWS: Index is missing
-- ✅ If 1 ROW: Index exists


-- ================================================================
-- SECTION 8: Verify Trigger Function Exists (custom_bank_count)
-- ================================================================
-- Expected: Should return 1 row

SELECT
  routine_name,
  routine_schema,
  routine_type
FROM information_schema.routines
WHERE routine_name = 'update_custom_bank_count'
  AND routine_schema = 'public';

-- Expected Output:
-- routine_name              | routine_schema | routine_type
-- --------------------------|----------------|-------------
-- update_custom_bank_count  | public         | FUNCTION
--
-- ❌ If NO ROWS: Trigger function is missing
-- ✅ If 1 ROW: Trigger function exists


-- ================================================================
-- SECTION 9: Verify Trigger Exists on question_banks
-- ================================================================
-- Expected: Should return 2 rows (INSERT and DELETE triggers)

SELECT
  trigger_name,
  event_manipulation,
  event_object_table,
  action_timing
FROM information_schema.triggers
WHERE trigger_schema = 'public'
  AND event_object_table = 'question_banks'
  AND trigger_name IN ('trg_update_custom_bank_count_insert', 'trg_update_custom_bank_count_delete')
ORDER BY trigger_name;

-- Expected Output:
-- trigger_name                          | event_manipulation | event_object_table | action_timing
-- --------------------------------------|--------------------|--------------------|---------------
-- trg_update_custom_bank_count_delete   | DELETE             | question_banks     | AFTER
-- trg_update_custom_bank_count_insert   | INSERT             | question_banks     | AFTER
--
-- ❌ If < 2 ROWS: Triggers are missing - count won't stay accurate
-- ✅ If 2 ROWS: Triggers exist


-- ================================================================
-- SECTION 10: All Other RPC Functions (Sanity Check)
-- ================================================================
-- Expected: Should return multiple rows showing all public functions

SELECT
  routine_name,
  routine_type,
  data_type as return_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_type = 'FUNCTION'
ORDER BY routine_name;

-- Expected to include (among others):
-- - cleanup_old_audit_logs
-- - cleanup_old_stripe_events
-- - create_custom_bank_with_limit_check  ← Should be in this list!
-- - increment_game_count_if_allowed
-- - decrement_game_count
-- - duplicate_question_bank
-- - update_custom_bank_count
--
-- Review this list to see which functions exist


-- ================================================================
-- SUMMARY OF CRITICAL CHECKS
-- ================================================================
--
-- PASS CRITERIA:
-- ✅ Section 1: create_custom_bank_with_limit_check exists
-- ✅ Section 2: Function has 5 parameters (p_owner_id, p_title, p_subject, p_description, p_difficulty)
-- ✅ Section 3: teams.game_id has is_nullable = 'NO'
-- ✅ Section 4: Zero NULL game_id values
-- ✅ Section 5: All 3 RG-107 columns exist
-- ✅ Section 6: current_phase column exists
-- ✅ Section 7: GIN index exists
-- ✅ Section 8: update_custom_bank_count function exists
-- ✅ Section 9: Both triggers exist
--
-- FAIL SCENARIOS:
-- ❌ Section 1 NO ROWS → RPC function missing (HIGH PRIORITY BUG)
-- ❌ Section 3 is_nullable='YES' → game_id can be null (HIGH PRIORITY BUG)
-- ❌ Section 4 count > 0 → Data corruption (CRITICAL)
-- ❌ Section 5 < 3 rows → RG-107 incomplete (BLOCKER)
-- ❌ Section 6 NO ROWS → RG-118 incomplete (BLOCKER)
--
-- ================================================================
