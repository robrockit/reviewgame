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
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS custom_bank_count INTEGER DEFAULT 0;

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

-- Function to update the custom_bank_count when custom banks are created/deleted
CREATE OR REPLACE FUNCTION update_custom_bank_count()
RETURNS TRIGGER AS $$
BEGIN
  -- Handle INSERT and UPDATE operations
  IF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE') THEN
    -- Only update if the bank is marked as custom
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on question_banks table
DROP TRIGGER IF EXISTS trigger_update_custom_bank_count ON question_banks;
CREATE TRIGGER trigger_update_custom_bank_count
AFTER INSERT OR UPDATE OR DELETE ON question_banks
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
  'Current count of custom question banks created by this user. Maintained automatically by trigger.';

-- ==============================================================================
-- DATA MIGRATION - Set Default Values Based on Subscription Tier
-- ==============================================================================

-- For FREE tier users: set limits to 0 (no custom banks allowed)
UPDATE profiles
SET
  custom_bank_limit = 0,
  custom_bank_count = 0,
  accessible_prebuilt_bank_ids = '[]'::jsonb
WHERE subscription_tier = 'FREE'
  AND (custom_bank_limit IS NULL OR custom_bank_count IS NULL OR accessible_prebuilt_bank_ids IS NULL);

-- For BASIC tier users: set custom bank limit to 15
UPDATE profiles
SET
  custom_bank_limit = 15,
  custom_bank_count = COALESCE(
    (SELECT COUNT(*) FROM question_banks WHERE owner_id = profiles.id AND is_custom = true),
    0
  ),
  accessible_prebuilt_bank_ids = NULL  -- NULL indicates access to all prebuilt banks
WHERE subscription_tier = 'BASIC'
  AND (custom_bank_limit IS NULL OR custom_bank_count IS NULL);

-- For PREMIUM tier users: set unlimited custom banks (NULL = unlimited)
UPDATE profiles
SET
  custom_bank_limit = NULL,  -- NULL indicates unlimited
  custom_bank_count = COALESCE(
    (SELECT COUNT(*) FROM question_banks WHERE owner_id = profiles.id AND is_custom = true),
    0
  ),
  accessible_prebuilt_bank_ids = NULL  -- NULL indicates access to all prebuilt banks
WHERE subscription_tier = 'PREMIUM'
  AND custom_bank_count IS NULL;

-- ==============================================================================
-- VERIFICATION QUERIES (for manual testing)
-- ==============================================================================

-- Uncomment these queries to verify the migration in the Supabase SQL Editor:
/*
-- Check that all columns were added
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'profiles'
  AND column_name IN ('accessible_prebuilt_bank_ids', 'custom_bank_limit', 'custom_bank_count')
ORDER BY column_name;

-- Check that indexes were created
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'profiles'
  AND indexname IN ('idx_profiles_accessible_banks', 'idx_profiles_custom_bank_count');

-- Check that trigger was created
SELECT trigger_name, event_manipulation, event_object_table
FROM information_schema.triggers
WHERE trigger_name = 'trigger_update_custom_bank_count';

-- Verify tier-based defaults were applied correctly
SELECT
  subscription_tier,
  COUNT(*) as user_count,
  COUNT(CASE WHEN custom_bank_limit = 0 THEN 1 END) as free_tier_limit,
  COUNT(CASE WHEN custom_bank_limit = 15 THEN 1 END) as basic_tier_limit,
  COUNT(CASE WHEN custom_bank_limit IS NULL THEN 1 END) as premium_tier_unlimited
FROM profiles
GROUP BY subscription_tier;
*/
