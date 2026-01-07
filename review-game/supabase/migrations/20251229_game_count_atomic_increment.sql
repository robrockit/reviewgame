-- Migration: Atomic Game Count Increment with Constraints
-- Description: Adds atomic increment function and database constraints for free tier game limit
-- Date: 2025-12-29
-- Related: RG-84
-- IMPORTANT: This migration must run AFTER tier/billing columns exist

-- Step 1: Add database constraints for data integrity
-- =====================================================

-- Ensure games_created_count has a default and is non-null
ALTER TABLE profiles
ALTER COLUMN games_created_count SET DEFAULT 0;

-- Update any NULL values to 0
UPDATE profiles
SET games_created_count = 0
WHERE games_created_count IS NULL;

-- Make column NOT NULL
ALTER TABLE profiles
ALTER COLUMN games_created_count SET NOT NULL;

-- Add check constraint for non-negative values
ALTER TABLE profiles
ADD CONSTRAINT IF NOT EXISTS chk_games_created_count_non_negative
CHECK (games_created_count >= 0);

-- Add check constraint for FREE tier limit enforcement at database level
-- This provides defense-in-depth even if application code has bugs
ALTER TABLE profiles
ADD CONSTRAINT IF NOT EXISTS chk_free_tier_game_limit
CHECK (
  subscription_tier != 'FREE' OR
  games_created_count <= 3
);

-- Add index for efficient queries on free tier users near their limit
CREATE INDEX IF NOT EXISTS idx_profiles_games_created_count_free
ON profiles(games_created_count)
WHERE subscription_tier = 'FREE';

-- Add comment explaining the constraint
COMMENT ON CONSTRAINT chk_free_tier_game_limit ON profiles IS
  'Enforces 3-game creation limit for FREE tier users at database level. Prevents bypassing application-level checks.';

-- Step 2: Create atomic increment function
-- =====================================================

/**
 * Atomically increments game count for FREE tier users with limit enforcement.
 *
 * This function prevents race conditions by:
 * 1. Locking the user's profile row with FOR UPDATE
 * 2. Checking the current count and tier
 * 3. Only incrementing if under the limit
 * 4. All within a single transaction
 *
 * Returns:
 * - TRUE if increment succeeded (user can create game)
 * - FALSE if limit reached or user not found
 *
 * Usage from application:
 *   SELECT increment_game_count_if_allowed('user-uuid');
 *
 * @param p_user_id UUID of the user attempting to create a game
 * @returns BOOLEAN indicating if game creation is allowed
 */
CREATE OR REPLACE FUNCTION increment_game_count_if_allowed(
  p_user_id UUID
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tier TEXT;
  v_count INTEGER;
  v_status TEXT;
BEGIN
  -- Lock the profile row for this user to prevent concurrent modifications
  -- This is critical for preventing race conditions
  SELECT
    subscription_tier,
    COALESCE(games_created_count, 0),
    subscription_status
  INTO v_tier, v_count, v_status
  FROM profiles
  WHERE id = p_user_id
  FOR UPDATE;  -- Row-level lock prevents concurrent access

  -- If profile not found, deny
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  -- Check if user has active subscription (required for all tiers)
  -- Status must be TRIAL or ACTIVE (uppercase as per application type system)
  IF v_status IS NULL OR (
    UPPER(v_status) != 'TRIAL' AND UPPER(v_status) != 'ACTIVE'
  ) THEN
    RETURN FALSE;
  END IF;

  -- For FREE tier, enforce the 3-game limit
  IF UPPER(v_tier) = 'FREE' THEN
    -- Check if already at limit
    IF v_count >= 3 THEN
      RETURN FALSE;
    END IF;

    -- Increment counter atomically (within same transaction as the check)
    UPDATE profiles
    SET games_created_count = v_count + 1
    WHERE id = p_user_id;

    RETURN TRUE;
  END IF;

  -- For BASIC and PREMIUM tiers, allow unlimited games (don't increment counter)
  RETURN TRUE;
END;
$$;

-- Add comment explaining the function
COMMENT ON FUNCTION increment_game_count_if_allowed(UUID) IS
  'Atomically checks and increments game count for FREE tier users. Prevents race conditions in game creation limit enforcement. Returns TRUE if game creation allowed, FALSE if limit reached.';

-- Step 3: Create rollback function
-- =====================================================

/**
 * Atomically decrements game count for FREE tier users.
 *
 * Used to rollback a game count increment if game creation fails
 * after the counter was already incremented.
 *
 * @param p_user_id UUID of the user
 * @returns BOOLEAN indicating if decrement succeeded
 */
CREATE OR REPLACE FUNCTION decrement_game_count(
  p_user_id UUID
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tier TEXT;
  v_count INTEGER;
BEGIN
  -- Lock the row
  SELECT subscription_tier, games_created_count
  INTO v_tier, v_count
  FROM profiles
  WHERE id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  -- Only decrement for FREE tier and if count > 0
  IF UPPER(v_tier) = 'FREE' AND v_count > 0 THEN
    UPDATE profiles
    SET games_created_count = v_count - 1
    WHERE id = p_user_id;
    RETURN TRUE;
  END IF;

  RETURN FALSE;
END;
$$;

COMMENT ON FUNCTION decrement_game_count(UUID) IS
  'Atomically decrements game count for FREE tier users. Used for rollback when game creation fails after counter increment.';
