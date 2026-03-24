-- Migration: Final Jeopardy Game Flow
-- Description: Adds game phase tracking and Final Jeopardy team fields
-- Date: 2026-02-10

-- =====================================================
-- 1. Add game phase tracking to games table
-- =====================================================

-- Add current_phase column to track game flow
ALTER TABLE games
ADD COLUMN IF NOT EXISTS current_phase TEXT DEFAULT 'regular'
CHECK (current_phase IN ('regular', 'final_jeopardy_wager', 'final_jeopardy_answer', 'final_jeopardy_reveal'));

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_games_current_phase ON games(current_phase);

-- Add comment for documentation
COMMENT ON COLUMN games.current_phase IS 'Tracks the current phase of the game: regular, final_jeopardy_wager, final_jeopardy_answer, or final_jeopardy_reveal';

-- =====================================================
-- 2. Add Final Jeopardy tracking fields to teams table
-- =====================================================

-- Add Final Jeopardy wager amount
ALTER TABLE teams
ADD COLUMN IF NOT EXISTS final_jeopardy_wager INTEGER DEFAULT NULL;

-- Add Final Jeopardy answer text
ALTER TABLE teams
ADD COLUMN IF NOT EXISTS final_jeopardy_answer TEXT DEFAULT NULL;

-- Add submission timestamp
ALTER TABLE teams
ADD COLUMN IF NOT EXISTS final_jeopardy_submitted_at TIMESTAMP DEFAULT NULL;

-- Add constraint: wager must be non-negative
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'teams_final_jeopardy_wager_check'
  ) THEN
    ALTER TABLE teams
    ADD CONSTRAINT teams_final_jeopardy_wager_check
    CHECK (final_jeopardy_wager IS NULL OR final_jeopardy_wager >= 0);
  END IF;
END;
$$;

-- Add index for efficient queries
CREATE INDEX IF NOT EXISTS idx_teams_final_jeopardy_submitted ON teams(game_id, final_jeopardy_submitted_at);

-- Add comments for documentation
COMMENT ON COLUMN teams.final_jeopardy_wager IS 'The wager amount for Final Jeopardy (0 to max(score, 0))';
COMMENT ON COLUMN teams.final_jeopardy_answer IS 'The team''s answer for Final Jeopardy';
COMMENT ON COLUMN teams.final_jeopardy_submitted_at IS 'Timestamp when the team submitted their wager/answer';
