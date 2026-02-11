-- Migration: Final Jeopardy Critical Fixes
-- Description: Adds database functions for atomic operations and additional indexes
-- Date: 2026-02-10

-- =====================================================
-- 1. Add missing performance indexes
-- =====================================================

-- Partial indexes for checking submission status (much faster than filtering in app)
CREATE INDEX IF NOT EXISTS idx_teams_game_fj_wager_submitted
ON teams(game_id)
WHERE final_jeopardy_wager IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_teams_game_fj_answer_submitted
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
  v_fj_question JSONB;
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

  -- Check game phase and get Final Jeopardy question
  SELECT current_phase, final_jeopardy_question INTO v_game_phase, v_fj_question
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

  -- Create wager audit record (in same transaction)
  INSERT INTO wagers (
    game_id,
    team_id,
    question_id,
    wager_amount,
    wager_type,
    question_category,
    question_value
  ) VALUES (
    p_game_id,
    p_team_id,
    NULL, -- Final Jeopardy has no specific question_id
    p_wager,
    'final_jeopardy',
    COALESCE(v_fj_question->>'category', 'Final Jeopardy'),
    0 -- Final Jeopardy has no point value
  );

  -- Return success
  RETURN QUERY SELECT true, NULL::TEXT, v_submitted_at;
END;
$$;

-- Add comment
COMMENT ON FUNCTION submit_final_jeopardy_wager IS 'Atomically validates and submits Final Jeopardy wager, preventing race conditions';

-- =====================================================
-- 3. Atomic answer submission function (fixes timestamp consistency)
-- =====================================================

CREATE OR REPLACE FUNCTION submit_final_jeopardy_answer(
  p_game_id UUID,
  p_team_id UUID,
  p_answer TEXT
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
  v_game_phase TEXT;
  v_has_wager BOOLEAN;
  v_submitted_at TIMESTAMP;
BEGIN
  -- Verify team exists and belongs to game
  SELECT EXISTS(
    SELECT 1 FROM teams
    WHERE id = p_team_id AND game_id = p_game_id
  ) INTO v_has_wager;

  IF NOT v_has_wager THEN
    RETURN QUERY SELECT false, 'Team not found'::TEXT, NULL::TIMESTAMP;
    RETURN;
  END IF;

  -- Check game phase
  SELECT current_phase INTO v_game_phase
  FROM games
  WHERE id = p_game_id;

  IF v_game_phase != 'final_jeopardy_answer' THEN
    RETURN QUERY SELECT false, 'Not in answering phase'::TEXT, NULL::TIMESTAMP;
    RETURN;
  END IF;

  -- Verify team has submitted wager
  SELECT (final_jeopardy_wager IS NOT NULL) INTO v_has_wager
  FROM teams
  WHERE id = p_team_id;

  IF NOT v_has_wager THEN
    RETURN QUERY SELECT false, 'Must submit wager before answering'::TEXT, NULL::TIMESTAMP;
    RETURN;
  END IF;

  -- Validate answer length
  IF LENGTH(p_answer) > 500 THEN
    RETURN QUERY SELECT false, 'Answer must be 500 characters or less'::TEXT, NULL::TIMESTAMP;
    RETURN;
  END IF;

  -- Update team with answer (using database timestamp)
  v_submitted_at := now();

  UPDATE teams
  SET
    final_jeopardy_answer = p_answer,
    final_jeopardy_submitted_at = v_submitted_at
  WHERE id = p_team_id;

  -- Update wagers table with answer text
  UPDATE wagers
  SET answer_text = p_answer
  WHERE game_id = p_game_id
    AND team_id = p_team_id
    AND wager_type = 'final_jeopardy';

  -- Return success
  RETURN QUERY SELECT true, NULL::TEXT, v_submitted_at;
END;
$$;

-- Add comment
COMMENT ON FUNCTION submit_final_jeopardy_answer IS 'Atomically submits Final Jeopardy answer with database timestamp';

-- =====================================================
-- 4. Atomic Final Jeopardy start function (fixes transaction issue)
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
-- 5. Atomic reveal and score update function (fixes transaction boundary)
-- =====================================================

CREATE OR REPLACE FUNCTION reveal_final_jeopardy_answer(
  p_game_id UUID,
  p_team_id UUID,
  p_is_correct BOOLEAN,
  p_teacher_id UUID
)
RETURNS TABLE (
  success BOOLEAN,
  error_message TEXT,
  new_score INTEGER,
  score_change INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_game_teacher UUID;
  v_game_phase TEXT;
  v_wager INTEGER;
  v_current_score INTEGER;
  v_score_change INTEGER;
  v_new_score INTEGER;
BEGIN
  -- Verify ownership
  SELECT teacher_id, current_phase INTO v_game_teacher, v_game_phase
  FROM games
  WHERE id = p_game_id;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'Game not found'::TEXT, NULL::INTEGER, NULL::INTEGER;
    RETURN;
  END IF;

  IF v_game_teacher != p_teacher_id THEN
    RETURN QUERY SELECT false, 'Unauthorized'::TEXT, NULL::INTEGER, NULL::INTEGER;
    RETURN;
  END IF;

  -- Verify game phase
  IF v_game_phase != 'final_jeopardy_reveal' THEN
    RETURN QUERY SELECT false, 'Not in reveal phase'::TEXT, NULL::INTEGER, NULL::INTEGER;
    RETURN;
  END IF;

  -- Get team data with row lock
  SELECT score, final_jeopardy_wager
  INTO v_current_score, v_wager
  FROM teams
  WHERE id = p_team_id AND game_id = p_game_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'Team not found'::TEXT, NULL::INTEGER, NULL::INTEGER;
    RETURN;
  END IF;

  -- Verify team has submitted wager and answer
  IF v_wager IS NULL THEN
    RETURN QUERY SELECT false, 'Team has not submitted a wager'::TEXT, NULL::INTEGER, NULL::INTEGER;
    RETURN;
  END IF;

  -- Calculate score change
  v_score_change := CASE WHEN p_is_correct THEN v_wager ELSE -v_wager END;
  v_new_score := COALESCE(v_current_score, 0) + v_score_change;

  -- Update team score (atomic with wager update)
  UPDATE teams
  SET score = v_new_score
  WHERE id = p_team_id;

  -- Update wager record with result (in same transaction)
  UPDATE wagers
  SET
    is_correct = p_is_correct,
    revealed = true
  WHERE game_id = p_game_id
    AND team_id = p_team_id
    AND wager_type = 'final_jeopardy';

  -- Return success with score details
  RETURN QUERY SELECT true, NULL::TEXT, v_new_score, v_score_change;
END;
$$;

-- Add comment
COMMENT ON FUNCTION reveal_final_jeopardy_answer IS 'Atomically reveals Final Jeopardy answer and updates score with wager audit trail in single transaction';

-- =====================================================
-- 6. Function to skip Final Jeopardy with cleanup
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
-- 7. Grant necessary permissions
-- =====================================================

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION submit_final_jeopardy_wager TO authenticated;
GRANT EXECUTE ON FUNCTION submit_final_jeopardy_answer TO authenticated;
GRANT EXECUTE ON FUNCTION start_final_jeopardy TO authenticated;
GRANT EXECUTE ON FUNCTION reveal_final_jeopardy_answer TO authenticated;
GRANT EXECUTE ON FUNCTION skip_final_jeopardy TO authenticated;
