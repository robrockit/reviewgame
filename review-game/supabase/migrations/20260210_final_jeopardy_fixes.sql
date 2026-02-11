-- Migration: Final Jeopardy Critical Fixes
-- Description: Adds database functions for atomic operations and additional indexes
-- Date: 2026-02-10

-- =====================================================
-- 1. Add missing performance indexes
-- =====================================================

-- Partial indexes for checking submission status (much faster than filtering in app)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_teams_game_fj_wager_submitted
ON teams(game_id)
WHERE final_jeopardy_wager IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_teams_game_fj_answer_submitted
ON teams(game_id)
WHERE final_jeopardy_answer IS NOT NULL;

-- Comment for documentation
COMMENT ON INDEX idx_teams_game_fj_wager_submitted IS 'Efficiently find teams that have submitted Final Jeopardy wagers';
COMMENT ON INDEX idx_teams_game_fj_answer_submitted IS 'Efficiently find teams that have submitted Final Jeopardy answers';

-- =====================================================
-- 2. Atomic wager submission function (fixes race condition)
-- =====================================================

CREATE OR REPLACE FUNCTION submit_final_jeopardy_wager(
  p_game_id UUID,
  p_team_id UUID,
  p_wager INTEGER
)
RETURNS TABLE (
  success BOOLEAN,
  error_message TEXT,
  submitted_at TIMESTAMP
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_score INTEGER;
  v_max_wager INTEGER;
  v_game_phase TEXT;
  v_submitted_at TIMESTAMP;
BEGIN
  -- Lock the team row for update to prevent concurrent modifications
  SELECT score INTO v_current_score
  FROM teams
  WHERE id = p_team_id AND game_id = p_game_id
  FOR UPDATE;

  -- Verify team exists
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'Team not found'::TEXT, NULL::TIMESTAMP;
    RETURN;
  END IF;

  -- Check game phase
  SELECT current_phase INTO v_game_phase
  FROM games
  WHERE id = p_game_id;

  IF v_game_phase != 'final_jeopardy_wager' THEN
    RETURN QUERY SELECT false, 'Not in wagering phase'::TEXT, NULL::TIMESTAMP;
    RETURN;
  END IF;

  -- Calculate max wager (using GREATEST for NULL safety)
  v_max_wager := GREATEST(COALESCE(v_current_score, 0), 0);

  -- Validate wager amount
  IF p_wager < 0 THEN
    RETURN QUERY SELECT false, 'Wager cannot be negative'::TEXT, NULL::TIMESTAMP;
    RETURN;
  END IF;

  IF p_wager > v_max_wager THEN
    RETURN QUERY SELECT false, format('Wager cannot exceed %s', v_max_wager)::TEXT, NULL::TIMESTAMP;
    RETURN;
  END IF;

  -- Update team with wager (atomic with validation)
  v_submitted_at := now();

  UPDATE teams
  SET
    final_jeopardy_wager = p_wager,
    final_jeopardy_submitted_at = v_submitted_at
  WHERE id = p_team_id;

  -- Return success
  RETURN QUERY SELECT true, NULL::TEXT, v_submitted_at;
END;
$$;

-- Add comment
COMMENT ON FUNCTION submit_final_jeopardy_wager IS 'Atomically validates and submits Final Jeopardy wager, preventing race conditions';

-- =====================================================
-- 3. Atomic Final Jeopardy start function (fixes transaction issue)
-- =====================================================

CREATE OR REPLACE FUNCTION start_final_jeopardy(
  p_game_id UUID,
  p_teacher_id UUID
)
RETURNS TABLE (
  success BOOLEAN,
  error_message TEXT,
  question JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_fj_question JSONB;
  v_game_teacher UUID;
BEGIN
  -- Verify ownership
  SELECT teacher_id, final_jeopardy_question
  INTO v_game_teacher, v_fj_question
  FROM games
  WHERE id = p_game_id
  FOR UPDATE;  -- Lock game row

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'Game not found'::TEXT, NULL::JSONB;
    RETURN;
  END IF;

  IF v_game_teacher != p_teacher_id THEN
    RETURN QUERY SELECT false, 'Unauthorized'::TEXT, NULL::JSONB;
    RETURN;
  END IF;

  -- Verify Final Jeopardy question exists
  IF v_fj_question IS NULL THEN
    RETURN QUERY SELECT false, 'Final Jeopardy question not configured'::TEXT, NULL::JSONB;
    RETURN;
  END IF;

  -- Validate question structure
  IF NOT (v_fj_question ? 'category' AND v_fj_question ? 'question' AND v_fj_question ? 'answer') THEN
    RETURN QUERY SELECT false, 'Invalid Final Jeopardy question data'::TEXT, NULL::JSONB;
    RETURN;
  END IF;

  -- Update game phase
  UPDATE games
  SET current_phase = 'final_jeopardy_wager'
  WHERE id = p_game_id;

  -- Reset all teams' Final Jeopardy fields (atomic with phase change)
  UPDATE teams
  SET
    final_jeopardy_wager = NULL,
    final_jeopardy_answer = NULL,
    final_jeopardy_submitted_at = NULL
  WHERE game_id = p_game_id;

  -- Return success with question
  RETURN QUERY SELECT true, NULL::TEXT, v_fj_question;
END;
$$;

-- Add comment
COMMENT ON FUNCTION start_final_jeopardy IS 'Atomically starts Final Jeopardy round, ensuring game phase and team reset happen together';

-- =====================================================
-- 4. Function to skip Final Jeopardy with cleanup
-- =====================================================

CREATE OR REPLACE FUNCTION skip_final_jeopardy(
  p_game_id UUID,
  p_teacher_id UUID
)
RETURNS TABLE (
  success BOOLEAN,
  error_message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_game_teacher UUID;
BEGIN
  -- Verify ownership
  SELECT teacher_id INTO v_game_teacher
  FROM games
  WHERE id = p_game_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'Game not found'::TEXT;
    RETURN;
  END IF;

  IF v_game_teacher != p_teacher_id THEN
    RETURN QUERY SELECT false, 'Unauthorized'::TEXT;
    RETURN;
  END IF;

  -- Reset game phase
  UPDATE games
  SET current_phase = 'regular'
  WHERE id = p_game_id;

  -- Clear teams' Final Jeopardy fields
  UPDATE teams
  SET
    final_jeopardy_wager = NULL,
    final_jeopardy_answer = NULL,
    final_jeopardy_submitted_at = NULL
  WHERE game_id = p_game_id;

  -- Delete orphaned wager records (cleanup)
  DELETE FROM wagers
  WHERE game_id = p_game_id
    AND wager_type = 'final_jeopardy';

  -- Return success
  RETURN QUERY SELECT true, NULL::TEXT;
END;
$$;

-- Add comment
COMMENT ON FUNCTION skip_final_jeopardy IS 'Skips Final Jeopardy and cleans up orphaned wager records';

-- =====================================================
-- 5. Grant necessary permissions
-- =====================================================

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION submit_final_jeopardy_wager TO authenticated;
GRANT EXECUTE ON FUNCTION start_final_jeopardy TO authenticated;
GRANT EXECUTE ON FUNCTION skip_final_jeopardy TO authenticated;
