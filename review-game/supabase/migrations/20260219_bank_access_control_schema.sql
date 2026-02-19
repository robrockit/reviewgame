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
CREATE OR REPLACE FUNCTION update_custom_bank_count()
RETURNS TRIGGER AS $$
BEGIN
  -- Handle INSERT operations
  IF (TG_OP = 'INSERT') THEN
    -- Only update if the new bank is marked as custom
    IF NEW.is_custom = true THEN
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
*/
