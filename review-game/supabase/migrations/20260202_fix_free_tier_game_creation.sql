-- Migration: Fix Free Tier Game Creation
-- Purpose: Allow users with 'free' subscription status to create games
-- Issue: increment_game_count_if_allowed() was rejecting 'free' status users
-- Date: 2026-02-02

-- Update the increment_game_count_if_allowed function to accept 'free' status
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
  SELECT
    subscription_tier,
    COALESCE(games_created_count, 0),
    subscription_status
  INTO v_tier, v_count, v_status
  FROM profiles
  WHERE id = p_user_id
  FOR UPDATE;

  -- If profile not found, deny
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  -- Check if user has active subscription OR is on free tier
  -- Allow: 'free', 'TRIAL', 'ACTIVE' (case-insensitive)
  -- Deny: NULL, 'INACTIVE', 'CANCELLED'
  IF v_status IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Normalize to uppercase for comparison
  v_status := UPPER(v_status);

  -- Allow free, trial, and active users
  IF v_status NOT IN ('FREE', 'TRIAL', 'ACTIVE') THEN
    RETURN FALSE;
  END IF;

  -- For FREE tier, enforce the 3-game limit
  IF UPPER(COALESCE(v_tier, 'FREE')) = 'FREE' THEN
    -- Check if already at limit
    IF v_count >= 3 THEN
      RETURN FALSE;
    END IF;

    -- Increment counter atomically
    UPDATE profiles
    SET games_created_count = v_count + 1
    WHERE id = p_user_id;

    RETURN TRUE;
  END IF;

  -- For BASIC and PREMIUM tiers, allow unlimited games (don't increment counter)
  RETURN TRUE;
END;
$$;

-- Add updated comment
COMMENT ON FUNCTION increment_game_count_if_allowed(UUID) IS
  'Atomically checks and increments game count for FREE tier users. Allows users with subscription_status of ''free'', ''TRIAL'', or ''ACTIVE''. Returns TRUE if game creation allowed, FALSE if limit reached or user inactive.';
