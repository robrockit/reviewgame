-- Migration: Add Server-Side RPC Function for Team Score Updates
-- Purpose: Move score update logic to server-side with proper authorization
-- Security: Verifies teacher ownership before allowing score updates
-- Reference: Jira ticket RG-45, PR #23 Code Review
-- Created: 2025-11-06

-- Create RPC function for updating team scores with authorization
-- This function ensures:
-- 1. User is authenticated
-- 2. User is the teacher for the game
-- 3. Team belongs to the specified game
-- 4. Score update is atomic and safe
CREATE OR REPLACE FUNCTION public.update_team_score(
  p_team_id UUID,
  p_score_change INTEGER,
  p_game_id UUID
)
RETURNS TABLE (
  team_id UUID,
  new_score INTEGER,
  success BOOLEAN,
  error_message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_teacher_id UUID;
  v_team_game_id UUID;
  v_new_score INTEGER;
BEGIN
  -- Check if user is authenticated
  IF auth.uid() IS NULL THEN
    RETURN QUERY SELECT
      p_team_id,
      NULL::INTEGER,
      FALSE,
      'Unauthorized: Authentication required'::TEXT;
    RETURN;
  END IF;

  -- Get the teacher_id for the specified game
  SELECT teacher_id INTO v_teacher_id
  FROM public.games
  WHERE id = p_game_id;

  -- Verify game exists
  IF v_teacher_id IS NULL THEN
    RETURN QUERY SELECT
      p_team_id,
      NULL::INTEGER,
      FALSE,
      'Game not found'::TEXT;
    RETURN;
  END IF;

  -- Verify authenticated user is the teacher for this game
  IF v_teacher_id != auth.uid() THEN
    RETURN QUERY SELECT
      p_team_id,
      NULL::INTEGER,
      FALSE,
      'Unauthorized: Only the game teacher can update scores'::TEXT;
    RETURN;
  END IF;

  -- Update team score atomically (prevents race conditions)
  -- This uses a single UPDATE statement that:
  -- 1. Validates team exists and belongs to the game
  -- 2. Atomically calculates new score from current value
  -- 3. Returns both game_id and new score for validation
  UPDATE public.teams
  SET score = COALESCE(score, 0) + p_score_change
  WHERE id = p_team_id
  RETURNING game_id, score INTO v_team_game_id, v_new_score;

  -- Verify team exists
  IF v_team_game_id IS NULL THEN
    RETURN QUERY SELECT
      p_team_id,
      NULL::INTEGER,
      FALSE,
      'Team not found'::TEXT;
    RETURN;
  END IF;

  -- Verify team belongs to the specified game
  IF v_team_game_id != p_game_id THEN
    -- Rollback the update since team doesn't belong to this game
    RAISE EXCEPTION 'Team does not belong to the specified game';
  END IF;

  -- Return success with updated score
  RETURN QUERY SELECT
    p_team_id,
    v_new_score,
    TRUE,
    NULL::TEXT;

EXCEPTION
  WHEN OTHERS THEN
    -- Handle any unexpected errors
    RETURN QUERY SELECT
      p_team_id,
      NULL::INTEGER,
      FALSE,
      ('Error updating score: ' || SQLERRM)::TEXT;
END;
$$;

-- Add comment for documentation
COMMENT ON FUNCTION public.update_team_score(UUID, INTEGER, UUID) IS
  'Server-side function to update team scores with proper authorization. Verifies that the authenticated user is the teacher of the game before allowing score updates. Returns the new score on success or an error message on failure.';

-- Grant execute permission to authenticated users
-- (RLS-like authorization is handled within the function body)
GRANT EXECUTE ON FUNCTION public.update_team_score(UUID, INTEGER, UUID) TO authenticated;

-- Revoke execute permission from anonymous users
REVOKE EXECUTE ON FUNCTION public.update_team_score(UUID, INTEGER, UUID) FROM anon;
