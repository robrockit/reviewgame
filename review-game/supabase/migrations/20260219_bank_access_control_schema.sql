-- Migration: Bank Access Control Schema
-- Description: Add columns to support question bank access control for 3-tier pricing
-- Date: 2026-02-19
-- Related Ticket: RG-107
-- Parent Epic: RG-87 - Pricing Structure Update
--
-- Overview:
-- This migration adds the database fields needed to enforce bank access limits
-- based on subscription tiers (FREE, BASIC, PREMIUM).
--
-- Note: subscription_tier and is_custom columns already exist from previous migrations.

-- ==============================================================================
-- PROFILES TABLE - Add Bank Access Control Columns
-- ==============================================================================

-- Add accessible_prebuilt_bank_ids column to track which prebuilt banks FREE users can access
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS accessible_prebuilt_bank_ids JSONB DEFAULT '[]'::jsonb;

-- Add custom_bank_limit to enforce how many custom banks a user can create
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS custom_bank_limit INTEGER DEFAULT 0;

-- Add custom_bank_count to track how many custom banks a user has created
-- NOT NULL with DEFAULT ensures the column always has a valid value
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS custom_bank_count INTEGER DEFAULT 0 NOT NULL
CHECK (custom_bank_count >= 0);

-- ==============================================================================
-- INDEXES
-- ==============================================================================

-- Create GIN index for efficient querying of accessible bank IDs
-- GIN (Generalized Inverted Index) is optimized for JSONB array containment queries
CREATE INDEX IF NOT EXISTS idx_profiles_accessible_banks
ON profiles USING gin(accessible_prebuilt_bank_ids);

-- Create index on custom_bank_count for efficient tier limit checks
CREATE INDEX IF NOT EXISTS idx_profiles_custom_bank_count
ON profiles(custom_bank_count);

-- ==============================================================================
-- TRIGGER FUNCTION - Maintain custom_bank_count Automatically
-- ==============================================================================

-- Function to update the custom_bank_count when custom banks are created/deleted/modified
-- Uses SECURITY DEFINER to ensure count updates work regardless of RLS policies
-- SET search_path prevents schema injection attacks
-- Row-level locking prevents race conditions under concurrent inserts
CREATE OR REPLACE FUNCTION update_custom_bank_count()
RETURNS TRIGGER AS $$
DECLARE
  v_profile_id UUID;
BEGIN
  -- Handle INSERT operations
  IF (TG_OP = 'INSERT') THEN
    -- Only update if the new bank is marked as custom
    IF NEW.is_custom = true THEN
      -- Lock the profile row to prevent race conditions
      -- FOR UPDATE ensures only one concurrent transaction can update the count at a time
      SELECT id INTO v_profile_id
      FROM profiles
      WHERE id = NEW.owner_id
      FOR UPDATE;

      UPDATE profiles
      SET custom_bank_count = (
        SELECT COUNT(*)
        FROM question_banks
        WHERE owner_id = NEW.owner_id AND is_custom = true
      )
      WHERE id = NEW.owner_id;
    END IF;
    RETURN NEW;

  -- Handle UPDATE operations
  ELSIF (TG_OP = 'UPDATE') THEN
    -- Handle both is_custom toggling and owner_id changes
    -- Case 1: is_custom changed from TRUE to FALSE (decrement old owner)
    -- Case 2: is_custom changed from FALSE to TRUE (increment new owner)
    -- Case 3: owner_id changed while is_custom = TRUE (decrement old owner, increment new owner)

    -- Update old owner's count if this was a custom bank or became non-custom
    IF OLD.is_custom = true THEN
      -- Lock the old owner's profile row
      SELECT id INTO v_profile_id
      FROM profiles
      WHERE id = OLD.owner_id
      FOR UPDATE;

      UPDATE profiles
      SET custom_bank_count = (
        SELECT COUNT(*)
        FROM question_banks
        WHERE owner_id = OLD.owner_id AND is_custom = true
      )
      WHERE id = OLD.owner_id;
    END IF;

    -- Update new owner's count if this is now a custom bank
    -- AND (owner changed OR is_custom changed to true)
    IF NEW.is_custom = true AND (NEW.owner_id != OLD.owner_id OR OLD.is_custom = false) THEN
      -- Lock the new owner's profile row
      SELECT id INTO v_profile_id
      FROM profiles
      WHERE id = NEW.owner_id
      FOR UPDATE;

      UPDATE profiles
      SET custom_bank_count = (
        SELECT COUNT(*)
        FROM question_banks
        WHERE owner_id = NEW.owner_id AND is_custom = true
      )
      WHERE id = NEW.owner_id;
    END IF;
    RETURN NEW;

  -- Handle DELETE operations
  ELSIF (TG_OP = 'DELETE') THEN
    -- Only update if the deleted bank was custom
    IF OLD.is_custom = true THEN
      -- Lock the profile row
      SELECT id INTO v_profile_id
      FROM profiles
      WHERE id = OLD.owner_id
      FOR UPDATE;

      UPDATE profiles
      SET custom_bank_count = (
        SELECT COUNT(*)
        FROM question_banks
        WHERE owner_id = OLD.owner_id AND is_custom = true
      )
      WHERE id = OLD.owner_id;
    END IF;
    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger on question_banks table
-- Only fires when is_custom or owner_id columns change (performance optimization)
DROP TRIGGER IF EXISTS trigger_update_custom_bank_count ON question_banks;
CREATE TRIGGER trigger_update_custom_bank_count
AFTER INSERT OR DELETE OR UPDATE OF is_custom, owner_id ON question_banks
FOR EACH ROW
EXECUTE FUNCTION update_custom_bank_count();

-- ==============================================================================
-- ATOMIC LIMIT ENFORCEMENT FUNCTION
-- ==============================================================================

-- Function to atomically check limit and create custom bank
-- This prevents race conditions where concurrent requests could exceed the limit
-- Returns the created bank ID on success, or raises an exception if limit exceeded
--
-- IMPORTANT: Applications should use this function instead of direct INSERT + count check
-- to ensure limits are enforced correctly under concurrent load.
CREATE OR REPLACE FUNCTION create_custom_bank_with_limit_check(
  p_owner_id UUID,
  p_title TEXT,
  p_subject TEXT DEFAULT NULL,
  p_description TEXT DEFAULT NULL,
  p_difficulty TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_current_count INTEGER;
  v_limit INTEGER;
  v_tier TEXT;
  v_bank_id UUID;
BEGIN
  -- Lock the profile row to prevent race conditions
  -- This ensures only one concurrent transaction can check/update limits at a time
  SELECT
    custom_bank_count,
    custom_bank_limit,
    subscription_tier
  INTO
    v_current_count,
    v_limit,
    v_tier
  FROM profiles
  WHERE id = p_owner_id
  FOR UPDATE;

  -- Check if profile exists
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile not found for user %', p_owner_id;
  END IF;

  -- Check limit (NULL means unlimited for PREMIUM tier)
  IF v_limit IS NOT NULL AND v_current_count >= v_limit THEN
    RAISE EXCEPTION 'Custom bank limit exceeded. Tier: %, Limit: %, Current: %',
      v_tier, v_limit, v_current_count;
  END IF;

  -- Create the custom bank
  INSERT INTO question_banks (owner_id, title, subject, description, difficulty, is_custom, is_public)
  VALUES (p_owner_id, p_title, p_subject, p_description, p_difficulty, true, false)
  RETURNING id INTO v_bank_id;

  -- Trigger will automatically update custom_bank_count

  RETURN v_bank_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

COMMENT ON FUNCTION create_custom_bank_with_limit_check IS
  'Atomically checks custom bank limit and creates a new bank. Prevents race conditions under concurrent load. Applications should use this instead of checking custom_bank_count then INSERT to ensure limits are enforced correctly.';

-- ==============================================================================
-- RACE CONDITION MITIGATION
-- ==============================================================================
--
-- The custom_bank_count trigger uses row-level locking (FOR UPDATE) to prevent
-- race conditions under concurrent inserts. Without locking, the following could occur:
--
-- Example race condition (without FOR UPDATE):
--   Transaction A: INSERT custom bank → trigger reads COUNT = 5 → writes 6
--   Transaction B: INSERT custom bank → trigger reads COUNT = 5 → writes 6
--   Result: Actual count = 7, stored count = 6 (off by 1)
--
-- With FOR UPDATE locking:
--   Transaction A: INSERT → trigger locks profile → reads COUNT = 5 → writes 6
--   Transaction B: INSERT → trigger waits for lock → reads COUNT = 6 → writes 7
--   Result: Actual count = 7, stored count = 7 (correct)
--
-- For limit enforcement, applications SHOULD use create_custom_bank_with_limit_check()
-- which atomically checks the limit and creates the bank in a single transaction.
-- This prevents TOCTOU (Time-Of-Check-Time-Of-Use) vulnerabilities where a user
-- could exceed their limit by submitting concurrent requests.
--
-- Alternative mitigation strategies:
-- 1. Row-level locking (implemented) - Prevents count drift, minimal contention
-- 2. Periodic reconciliation - Accept eventual consistency, fix periodically
-- 3. Application-level serialization - More complex, not database-enforced
--
-- Chosen approach: Row-level locking + atomic enforcement function

-- ==============================================================================
-- COMMENTS - Document the New Columns
-- ==============================================================================

COMMENT ON COLUMN profiles.accessible_prebuilt_bank_ids IS
  'Array of question bank IDs that FREE tier users can access. For BASIC/PREMIUM tiers, this is NULL (indicating access to all prebuilt banks).';

COMMENT ON COLUMN profiles.custom_bank_limit IS
  'Maximum number of custom question banks the user can create. 0 for FREE, 15 for BASIC, NULL for PREMIUM (unlimited).';

COMMENT ON COLUMN profiles.custom_bank_count IS
  'Current count of custom question banks created by this user. Maintained automatically by trigger. NOT NULL, >= 0 enforced by constraint.';

-- ==============================================================================
-- DATA MIGRATION - Set Tier-Appropriate Values for Existing Users
-- ==============================================================================
-- Note: ADD COLUMN ... DEFAULT backfills immediately, so IS NULL conditions
-- are removed (they would never match). This is an initial migration, so we
-- unconditionally set all existing users to tier-appropriate values.

-- For FREE tier users: set limits to 0 (no custom banks allowed)
UPDATE profiles
SET
  custom_bank_limit = 0,
  custom_bank_count = 0,
  accessible_prebuilt_bank_ids = '[]'::jsonb
WHERE subscription_tier = 'FREE';

-- For BASIC tier users: set custom bank limit to 15, calculate existing count
UPDATE profiles
SET
  custom_bank_limit = 15,
  custom_bank_count = COALESCE(
    (SELECT COUNT(*) FROM question_banks WHERE owner_id = profiles.id AND is_custom = true),
    0
  ),
  accessible_prebuilt_bank_ids = NULL  -- NULL indicates access to all prebuilt banks
WHERE subscription_tier = 'BASIC';

-- For PREMIUM tier users: set unlimited custom banks (NULL = unlimited), calculate existing count
UPDATE profiles
SET
  custom_bank_limit = NULL,  -- NULL indicates unlimited
  custom_bank_count = COALESCE(
    (SELECT COUNT(*) FROM question_banks WHERE owner_id = profiles.id AND is_custom = true),
    0
  ),
  accessible_prebuilt_bank_ids = NULL  -- NULL indicates access to all prebuilt banks
WHERE subscription_tier = 'PREMIUM';

-- ==============================================================================
-- VERIFICATION QUERIES (for manual testing)
-- ==============================================================================

-- Uncomment these queries to verify the migration in the Supabase SQL Editor:
/*
-- Check that all columns were added with correct constraints
SELECT
  column_name,
  data_type,
  column_default,
  is_nullable,
  character_maximum_length
FROM information_schema.columns
WHERE table_name = 'profiles'
  AND column_name IN ('accessible_prebuilt_bank_ids', 'custom_bank_limit', 'custom_bank_count')
ORDER BY column_name;

-- Check that indexes were created
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'profiles'
  AND indexname IN ('idx_profiles_accessible_banks', 'idx_profiles_custom_bank_count');

-- Check that trigger was created with correct event columns
SELECT
  trigger_name,
  event_manipulation,
  event_object_table,
  action_statement
FROM information_schema.triggers
WHERE trigger_name = 'trigger_update_custom_bank_count';

-- Verify CHECK constraint exists
SELECT
  conname AS constraint_name,
  pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conrelid = 'profiles'::regclass
  AND conname LIKE '%custom_bank_count%';

-- Verify tier-based defaults were applied correctly
SELECT
  subscription_tier,
  COUNT(*) as user_count,
  COUNT(CASE WHEN custom_bank_limit = 0 THEN 1 END) as free_tier_limit,
  COUNT(CASE WHEN custom_bank_limit = 15 THEN 1 END) as basic_tier_limit,
  COUNT(CASE WHEN custom_bank_limit IS NULL THEN 1 END) as premium_tier_unlimited,
  AVG(custom_bank_count) as avg_custom_banks
FROM profiles
GROUP BY subscription_tier;

-- Verify custom_bank_count matches actual custom banks
SELECT
  p.id,
  p.subscription_tier,
  p.custom_bank_count AS stored_count,
  COUNT(qb.id) AS actual_count,
  (p.custom_bank_count = COUNT(qb.id)) AS counts_match
FROM profiles p
LEFT JOIN question_banks qb ON qb.owner_id = p.id AND qb.is_custom = true
GROUP BY p.id, p.subscription_tier, p.custom_bank_count
HAVING p.custom_bank_count != COUNT(qb.id);
-- Should return 0 rows if all counts are accurate

-- Test atomic limit enforcement function
-- (Replace 'user-uuid-here' with an actual FREE tier user ID)
/*
SELECT create_custom_bank_with_limit_check(
  'user-uuid-here'::uuid,
  'Test Bank',
  'Test Subject',
  'Test Description',
  'Easy'
);
-- Should raise exception: "Custom bank limit exceeded" for FREE users
*/
*/
