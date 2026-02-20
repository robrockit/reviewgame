-- Rollback Migration: Bank Access Control Schema
-- Description: Safely rollback the bank access control schema changes
-- Date: 2026-02-19
-- Related Ticket: RG-107
--
-- IMPORTANT: Run this script ONLY if you need to undo the 20260219_bank_access_control_schema.sql migration.
-- This will remove the bank access control columns and trigger from the database.

-- ==============================================================================
-- DROP TRIGGER AND FUNCTIONS
-- ==============================================================================

-- Drop the trigger first (must be done before dropping the function)
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
  AND indexname IN ('idx_profiles_accessible_banks', 'idx_profiles_custom_bank_count');
-- Should return 0 rows

-- Verify trigger was removed
SELECT trigger_name
FROM information_schema.triggers
WHERE trigger_name = 'trigger_update_custom_bank_count';
-- Should return 0 rows
*/
