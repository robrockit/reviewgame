-- Migration: Final Jeopardy Combined Submission (RG-183)
-- Description: Redesign FJ flow:
--   1. Add final_jeopardy_question_revealed column to games
--   2. New submit_final_jeopardy RPC (wager + answer in one atomic call)
--   3. Update start_final_jeopardy to reset the new column
--   4. Eliminate final_jeopardy_answer game phase from the app flow
--      (DB CHECK constraint retains the value for backwards compatibility
--       with any in-progress games that were mid-flow)
-- Date: 2026-04-02

-- =====================================================
-- 1. Add final_jeopardy_question_revealed to games
-- =====================================================

ALTER TABLE public.games
  ADD COLUMN IF NOT EXISTS final_jeopardy_question_revealed BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.games.final_jeopardy_question_revealed IS
  'Set to true when the teacher explicitly reveals the FJ question text to students. '
  'Persisted so students who join mid-phase still see the question on page load. '
  'Reset to false on start_final_jeopardy and advance out of wager phase.';

-- =====================================================
-- 2. New combined submission RPC: submit_final_jeopardy
-- =====================================================

CREATE OR REPLACE FUNCTION public.submit_final_jeopardy(
  p_game_id  UUID,
  p_team_id  UUID,
  p_wager    INTEGER,
  p_answer   TEXT
)
RETURNS TABLE (
  success        BOOLEAN,
  error_message  TEXT,
  submitted_at   TIMESTAMP
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_score     INTEGER;
  v_max_wager         INTEGER;
  v_game_phase        TEXT;
  v_fj_question       JSONB;
  v_already_submitted BOOLEAN;
  v_submitted_at      TIMESTAMP;
BEGIN
  -- Lock the team row to prevent concurrent double-submissions
  SELECT score INTO v_current_score
  FROM teams
  WHERE id = p_team_id AND game_id = p_game_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'Team not found'::TEXT, NULL::TIMESTAMP;
    RETURN;
  END IF;

  -- Lock the game row so that a concurrent phase advance (wager → reveal) cannot
  -- slip between this phase check and the team UPDATE below. Without FOR UPDATE,
  -- a narrow race could allow a submission to pass the phase check and then write
  -- into a team that is already in the reveal phase.
  SELECT current_phase, final_jeopardy_question
  INTO v_game_phase, v_fj_question
  FROM games
  WHERE id = p_game_id
  FOR UPDATE;

  IF v_game_phase != 'final_jeopardy_wager' THEN
    RETURN QUERY SELECT false, 'Not in wagering phase'::TEXT, NULL::TIMESTAMP;
    RETURN;
  END IF;

  -- Guard against double-submission (wager IS NOT NULL = already submitted)
  SELECT (final_jeopardy_wager IS NOT NULL) INTO v_already_submitted
  FROM teams
  WHERE id = p_team_id;

  IF v_already_submitted THEN
    RETURN QUERY SELECT false, 'Already submitted'::TEXT, NULL::TIMESTAMP;
    RETURN;
  END IF;

  -- Validate wager
  v_max_wager := GREATEST(COALESCE(v_current_score, 0), 0);
  IF p_wager < 0 THEN
    RETURN QUERY SELECT false, 'Wager cannot be negative'::TEXT, NULL::TIMESTAMP;
    RETURN;
  END IF;
  IF p_wager > v_max_wager THEN
    RETURN QUERY SELECT false, format('Wager cannot exceed %s', v_max_wager)::TEXT, NULL::TIMESTAMP;
    RETURN;
  END IF;

  -- Validate answer
  IF LENGTH(COALESCE(p_answer, '')) = 0 THEN
    RETURN QUERY SELECT false, 'Answer cannot be empty'::TEXT, NULL::TIMESTAMP;
    RETURN;
  END IF;
  IF LENGTH(p_answer) > 500 THEN
    RETURN QUERY SELECT false, 'Answer must be 500 characters or less'::TEXT, NULL::TIMESTAMP;
    RETURN;
  END IF;

  v_submitted_at := now();

  -- Update team with both wager and answer atomically
  UPDATE teams
  SET
    final_jeopardy_wager       = p_wager,
    final_jeopardy_answer      = p_answer,
    final_jeopardy_submitted_at = v_submitted_at
  WHERE id = p_team_id;

  -- Create wager audit record with both fields in a single INSERT
  -- The UNIQUE constraint (game_id, team_id, wager_type) prevents duplicate rows.
  INSERT INTO wagers (
    game_id,
    team_id,
    question_id,
    wager_amount,
    answer_text,
    wager_type,
    question_category,
    question_value
  ) VALUES (
    p_game_id,
    p_team_id,
    NULL,  -- Final Jeopardy has no specific question_id
    p_wager,
    p_answer,
    'final_jeopardy',
    COALESCE(v_fj_question->>'category', 'Final Jeopardy'),
    0  -- Final Jeopardy has no point value
  );

  RETURN QUERY SELECT true, NULL::TEXT, v_submitted_at;
END;
$$;

COMMENT ON FUNCTION public.submit_final_jeopardy IS
  'Atomically validates and submits both the Final Jeopardy wager and answer in one '
  'call, replacing the two-step submit_final_jeopardy_wager + submit_final_jeopardy_answer '
  'flow (RG-183). Inserts a single wager audit record with both wager_amount and answer_text.';

-- =====================================================
-- 3. Update start_final_jeopardy to reset the new column
-- =====================================================

CREATE OR REPLACE FUNCTION public.start_final_jeopardy(
  p_game_id    UUID,
  p_teacher_id UUID
)
RETURNS TABLE (
  success        BOOLEAN,
  error_message  TEXT,
  question       JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_fj_question  JSONB;
  v_game_teacher UUID;
BEGIN
  -- Verify ownership and lock game row
  SELECT teacher_id, final_jeopardy_question
  INTO v_game_teacher, v_fj_question
  FROM games
  WHERE id = p_game_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'Game not found'::TEXT, NULL::JSONB;
    RETURN;
  END IF;

  IF v_game_teacher != p_teacher_id THEN
    RETURN QUERY SELECT false, 'Unauthorized'::TEXT, NULL::JSONB;
    RETURN;
  END IF;

  IF v_fj_question IS NULL THEN
    RETURN QUERY SELECT false, 'Final Jeopardy question not configured'::TEXT, NULL::JSONB;
    RETURN;
  END IF;

  IF NOT (v_fj_question ? 'category' AND v_fj_question ? 'question' AND v_fj_question ? 'answer') THEN
    RETURN QUERY SELECT false, 'Invalid Final Jeopardy question data'::TEXT, NULL::JSONB;
    RETURN;
  END IF;

  -- Update game phase and reset question-revealed flag atomically
  UPDATE games
  SET
    current_phase                  = 'final_jeopardy_wager',
    final_jeopardy_question_revealed = FALSE
  WHERE id = p_game_id;

  -- Reset all teams' Final Jeopardy fields (atomic with phase change)
  UPDATE teams
  SET
    final_jeopardy_wager        = NULL,
    final_jeopardy_answer       = NULL,
    final_jeopardy_submitted_at = NULL
  WHERE game_id = p_game_id;

  RETURN QUERY SELECT true, NULL::TEXT, v_fj_question;
END;
$$;

COMMENT ON FUNCTION public.start_final_jeopardy IS
  'Atomically starts Final Jeopardy, resetting game phase, question_revealed flag, '
  'and all team FJ fields in a single transaction.';

-- =====================================================
-- 4. Grant permissions
-- =====================================================

GRANT EXECUTE ON FUNCTION public.submit_final_jeopardy TO authenticated;
-- start_final_jeopardy already has GRANT from previous migration; re-grant is idempotent
GRANT EXECUTE ON FUNCTION public.start_final_jeopardy TO authenticated;
