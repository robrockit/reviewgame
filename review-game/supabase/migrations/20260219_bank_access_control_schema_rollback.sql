-- Rollback Migration: Bank Access Control Schema
-- Description: Safely rollback the bank access control schema changes
-- Date: 2026-02-19
-- Related Ticket: RG-107
--
-- IMPORTANT: Run this script ONLY if you need to undo the 20260219_bank_access_control_schema.sql migration.
-- This will remove the bank access control columns and trigger from the database.

-- ==============================================================================
-- RESTORE COLUMN PRIVILEGES
-- ==============================================================================

-- Restore UPDATE privileges on the columns we're about to drop
-- This ensures the authenticated role has normal access after rollback
GRANT UPDATE (custom_bank_count) ON profiles TO authenticated;
GRANT UPDATE (custom_bank_limit) ON profiles TO authenticated;

-- ==============================================================================
-- DROP TRIGGER AND FUNCTIONS
-- ==============================================================================

-- Drop triggers first (must be done before dropping the functions)
DROP TRIGGER IF EXISTS trigger_update_custom_bank_count ON question_banks;

-- Drop the atomic limit enforcement function
DROP FUNCTION IF EXISTS create_custom_bank_with_limit_check(UUID, TEXT, TEXT, TEXT, TEXT);

-- Drop the trigger function
DROP FUNCTION IF EXISTS update_custom_bank_count();

-- ==============================================================================
-- DROP INDEXES
-- ==============================================================================

-- Drop the GIN index on accessible_prebuilt_bank_ids
DROP INDEX IF EXISTS idx_profiles_accessible_banks;

-- ==============================================================================
-- REMOVE COLUMNS FROM PROFILES TABLE
-- ==============================================================================

-- Remove the bank access control columns
ALTER TABLE profiles
DROP COLUMN IF EXISTS accessible_prebuilt_bank_ids;

ALTER TABLE profiles
DROP COLUMN IF EXISTS custom_bank_limit;

ALTER TABLE profiles
DROP COLUMN IF EXISTS custom_bank_count;

-- ==============================================================================
-- VERIFICATION
-- ==============================================================================

-- Uncomment to verify the rollback was successful:
/*
-- Verify columns were removed
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'profiles'
  AND column_name IN ('accessible_prebuilt_bank_ids', 'custom_bank_limit', 'custom_bank_count');
-- Should return 0 rows

-- Verify indexes were removed
SELECT indexname
FROM pg_indexes
WHERE tablename = 'profiles'
  AND indexname = 'idx_profiles_accessible_banks';
-- Should return 0 rows
-- Note: idx_profiles_custom_bank_count was never created (see forward migration comments)

-- Verify trigger was removed
SELECT trigger_name
FROM information_schema.triggers
WHERE trigger_name = 'trigger_update_custom_bank_count';
-- Should return 0 rows

-- Verify column privileges restored
SELECT privilege_type, column_name
FROM information_schema.column_privileges
WHERE table_name = 'profiles'
  AND grantee = 'authenticated'
  AND column_name IN ('custom_bank_count', 'custom_bank_limit')
  AND privilege_type = 'UPDATE';
-- Should return 2 rows (both columns with UPDATE privilege)
*/
