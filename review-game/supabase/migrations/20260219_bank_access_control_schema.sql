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
-- DEFAULT NULL (not '[]') so new BASIC/PREMIUM users get full access, not zero access
-- CHECK constraint ensures value is either NULL or a valid JSON array
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS accessible_prebuilt_bank_ids JSONB DEFAULT NULL
CONSTRAINT chk_accessible_prebuilt_bank_ids_is_array
  CHECK (accessible_prebuilt_bank_ids IS NULL OR jsonb_typeof(accessible_prebuilt_bank_ids) = 'array');

-- Add custom_bank_limit to enforce how many custom banks a user can create
-- NULL means unlimited (PREMIUM tier), non-negative integers enforce limit
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS custom_bank_limit INTEGER DEFAULT 0
CONSTRAINT chk_custom_bank_limit CHECK (custom_bank_limit IS NULL OR custom_bank_limit >= 0);

-- Add custom_bank_count to track how many custom banks a user has created
-- NOT NULL with DEFAULT ensures the column always has a valid value
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS custom_bank_count INTEGER DEFAULT 0 NOT NULL
CONSTRAINT chk_custom_bank_count CHECK (custom_bank_count >= 0);

-- ==============================================================================
-- INDEXES
-- ==============================================================================

-- Create GIN index for efficient querying of accessible bank IDs
-- GIN (Generalized Inverted Index) is optimized for JSONB array containment queries
-- Used for: SELECT * FROM profiles WHERE accessible_prebuilt_bank_ids @> '["bank-id"]'::jsonb
CREATE INDEX IF NOT EXISTS idx_profiles_accessible_banks
ON profiles USING gin(accessible_prebuilt_bank_ids);

-- Note: No index on custom_bank_count needed.
-- The atomic function uses WHERE id = p_owner_id (primary key lookup).
-- An index on custom_bank_count would only help queries like
-- "find all users with > N custom banks" which we don't have.
-- Removing the index reduces write overhead from trigger updates.

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

    -- DEADLOCK PREVENTION: When both OLD and NEW owners need updates (owner_id change),
    -- lock them in a consistent order (by UUID value) to prevent deadlock scenarios
    -- where two concurrent transactions swap ownership between the same two users.

    -- Determine which profiles need updating
    IF OLD.is_custom = true AND NEW.is_custom = true AND NEW.owner_id != OLD.owner_id THEN
      -- Both owners need updates - lock in consistent order to prevent deadlock
      IF OLD.owner_id < NEW.owner_id THEN
        -- Lock smaller UUID first
        SELECT id INTO v_profile_id FROM profiles WHERE id = OLD.owner_id FOR UPDATE;
        SELECT id INTO v_profile_id FROM profiles WHERE id = NEW.owner_id FOR UPDATE;
      ELSE
        -- Lock smaller UUID first
        SELECT id INTO v_profile_id FROM profiles WHERE id = NEW.owner_id FOR UPDATE;
        SELECT id INTO v_profile_id FROM profiles WHERE id = OLD.owner_id FOR UPDATE;
      END IF;

      -- Update both counts
      UPDATE profiles
      SET custom_bank_count = (
        SELECT COUNT(*) FROM question_banks WHERE owner_id = OLD.owner_id AND is_custom = true
      )
      WHERE id = OLD.owner_id;

      UPDATE profiles
      SET custom_bank_count = (
        SELECT COUNT(*) FROM question_banks WHERE owner_id = NEW.owner_id AND is_custom = true
      )
      WHERE id = NEW.owner_id;

    ELSE
      -- Single owner update (is_custom toggle or owner_id unchanged)

      -- Update old owner's count if this was a custom bank or became non-custom
      IF OLD.is_custom = true THEN
        SELECT id INTO v_profile_id FROM profiles WHERE id = OLD.owner_id FOR UPDATE;

        UPDATE profiles
        SET custom_bank_count = (
          SELECT COUNT(*) FROM question_banks WHERE owner_id = OLD.owner_id AND is_custom = true
        )
        WHERE id = OLD.owner_id;
      END IF;

      -- Update new owner's count if this is now a custom bank
      -- AND (owner changed OR is_custom changed to true)
      IF NEW.is_custom = true AND (NEW.owner_id != OLD.owner_id OR OLD.is_custom = false) THEN
        SELECT id INTO v_profile_id FROM profiles WHERE id = NEW.owner_id FOR UPDATE;

        UPDATE profiles
        SET custom_bank_count = (
          SELECT COUNT(*) FROM question_banks WHERE owner_id = NEW.owner_id AND is_custom = true
        )
        WHERE id = NEW.owner_id;
      END IF;
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
-- SECURITY: COLUMN-LEVEL PRIVILEGE RESTRICTIONS
-- ==============================================================================

-- Revoke UPDATE privileges on trigger-managed columns from authenticated users.
-- This is the idiomatic PostgreSQL approach for column-level access control.
--
-- Security Issue: The existing RLS policy "Users can update own profile" allows
-- users to UPDATE any column in their own profile row. Without column-level
-- restrictions, users could set custom_bank_count = 0, then call
-- create_custom_bank_with_limit_check() repeatedly to bypass their tier's limit.
--
-- How this works:
-- - authenticated role: Cannot UPDATE these columns (revoked below)
-- - SECURITY DEFINER functions: Run as postgres role, CAN update these columns
-- - This allows triggers and atomic functions to update while blocking users
--
-- Advantages over trigger-based approach:
-- 1. No circular trigger dependencies (trigger can update without blocking itself)
-- 2. Clearer error messages from PostgreSQL privilege system
-- 3. Lower overhead (privilege check vs trigger execution)
-- 4. Standard PostgreSQL pattern for column-level access control

REVOKE UPDATE (custom_bank_count) ON profiles FROM authenticated;
REVOKE UPDATE (custom_bank_limit) ON profiles FROM authenticated;

COMMENT ON COLUMN profiles.custom_bank_count IS
  'Current count of custom question banks created by this user. Maintained automatically by trigger. UPDATE privilege revoked from authenticated role - only SECURITY DEFINER functions can modify.';

COMMENT ON COLUMN profiles.custom_bank_limit IS
  'Maximum number of custom question banks the user can create. 0 for FREE, 15 for BASIC, NULL for PREMIUM (unlimited). UPDATE privilege revoked from authenticated role - only subscription tier changes (via service role) can modify.';

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
  -- Authorization check: Ensure caller is acting on their own behalf
  -- Prevents users from creating custom banks under another user's account
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: authentication required';
  END IF;

  IF auth.uid() != p_owner_id THEN
    RAISE EXCEPTION 'Unauthorized: cannot create banks for another user (caller: %, requested: %)',
      auth.uid(), p_owner_id;
  END IF;

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
  'Array of question bank IDs that FREE tier users can access. For BASIC/PREMIUM tiers, this is NULL (indicating access to all prebuilt banks). CHECK constraint ensures this is NULL or a valid JSON array.';

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
-- Count existing custom banks to maintain data integrity (even though limit = 0)
-- Uses JOIN-based update for O(n + m) performance instead of O(n × m) correlated subquery
--
-- INTENTIONAL DATA INCONSISTENCY: FREE users who somehow acquired custom banks
-- before this migration will have custom_bank_count > custom_bank_limit (e.g., count=5, limit=0).
-- This is correct behavior:
--   - They keep their existing custom banks (no data loss)
--   - create_custom_bank_with_limit_check() will block further creation (limit enforced)
--   - Admins can identify these users with the query at the end of this migration
UPDATE profiles p
SET
  custom_bank_limit = 0,
  custom_bank_count = COALESCE(qb.cnt, 0),
  accessible_prebuilt_bank_ids = '[]'::jsonb
FROM (
  SELECT owner_id, COUNT(*) AS cnt
  FROM question_banks
  WHERE is_custom = true
  GROUP BY owner_id
) qb
WHERE p.id = qb.owner_id
  AND p.subscription_tier = 'FREE';

-- Update FREE users with no custom banks (not in the JOIN above)
-- Uses NOT EXISTS instead of NOT IN for null-safety
UPDATE profiles
SET
  custom_bank_limit = 0,
  custom_bank_count = 0,
  accessible_prebuilt_bank_ids = '[]'::jsonb
WHERE subscription_tier = 'FREE'
  AND NOT EXISTS (
    SELECT 1 FROM question_banks WHERE owner_id = profiles.id AND is_custom = true
  );

-- For BASIC tier users: set custom bank limit to 15, calculate existing count
UPDATE profiles p
SET
  custom_bank_limit = 15,
  custom_bank_count = COALESCE(qb.cnt, 0),
  accessible_prebuilt_bank_ids = NULL  -- NULL indicates access to all prebuilt banks
FROM (
  SELECT owner_id, COUNT(*) AS cnt
  FROM question_banks
  WHERE is_custom = true
  GROUP BY owner_id
) qb
WHERE p.id = qb.owner_id
  AND p.subscription_tier = 'BASIC';

-- Update BASIC users with no custom banks
-- Uses NOT EXISTS instead of NOT IN for null-safety
UPDATE profiles
SET
  custom_bank_limit = 15,
  custom_bank_count = 0,
  accessible_prebuilt_bank_ids = NULL
WHERE subscription_tier = 'BASIC'
  AND NOT EXISTS (
    SELECT 1 FROM question_banks WHERE owner_id = profiles.id AND is_custom = true
  );

-- For PREMIUM tier users: set unlimited custom banks (NULL = unlimited), calculate existing count
UPDATE profiles p
SET
  custom_bank_limit = NULL,  -- NULL indicates unlimited
  custom_bank_count = COALESCE(qb.cnt, 0),
  accessible_prebuilt_bank_ids = NULL  -- NULL indicates access to all prebuilt banks
FROM (
  SELECT owner_id, COUNT(*) AS cnt
  FROM question_banks
  WHERE is_custom = true
  GROUP BY owner_id
) qb
WHERE p.id = qb.owner_id
  AND p.subscription_tier = 'PREMIUM';

-- Update PREMIUM users with no custom banks
-- Uses NOT EXISTS instead of NOT IN for null-safety
UPDATE profiles
SET
  custom_bank_limit = NULL,
  custom_bank_count = 0,
  accessible_prebuilt_bank_ids = NULL
WHERE subscription_tier = 'PREMIUM'
  AND NOT EXISTS (
    SELECT 1 FROM question_banks WHERE owner_id = profiles.id AND is_custom = true
  );

-- Catch-all for users with unexpected tier values (NULL, 'admin', legacy values, etc.)
-- Treat them like FREE tier (limit = 0) for safety, but log for manual review
UPDATE profiles p
SET
  custom_bank_limit = 0,
  custom_bank_count = COALESCE(qb.cnt, 0),
  accessible_prebuilt_bank_ids = '[]'::jsonb  -- No prebuilt access for unknown tiers
FROM (
  SELECT owner_id, COUNT(*) AS cnt
  FROM question_banks
  WHERE is_custom = true
  GROUP BY owner_id
) qb
WHERE p.id = qb.owner_id
  AND (p.subscription_tier NOT IN ('FREE', 'BASIC', 'PREMIUM') OR p.subscription_tier IS NULL);

-- Update catch-all users with no custom banks
-- Uses NOT EXISTS instead of NOT IN for null-safety
UPDATE profiles
SET
  custom_bank_limit = 0,
  custom_bank_count = 0,
  accessible_prebuilt_bank_ids = '[]'::jsonb
WHERE (subscription_tier NOT IN ('FREE', 'BASIC', 'PREMIUM') OR subscription_tier IS NULL)
  AND NOT EXISTS (
    SELECT 1 FROM question_banks WHERE owner_id = profiles.id AND is_custom = true
  );

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

-- Identify FREE users with existing custom banks (count > limit)
-- These users acquired banks before this migration and are grandfathered in
SELECT
  p.id,
  p.email,
  p.full_name,
  p.subscription_tier,
  p.custom_bank_limit,
  p.custom_bank_count,
  (p.custom_bank_count - p.custom_bank_limit) AS over_limit_by
FROM profiles p
WHERE p.subscription_tier = 'FREE'
  AND p.custom_bank_count > COALESCE(p.custom_bank_limit, 0)
ORDER BY p.custom_bank_count DESC;
-- If any rows returned, these users have custom banks but are on FREE tier.
-- They keep existing banks but cannot create more.

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
