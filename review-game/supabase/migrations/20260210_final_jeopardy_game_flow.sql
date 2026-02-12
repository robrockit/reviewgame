-- Migration: Final Jeopardy Game Flow
-- Description: Adds game phase tracking and Final Jeopardy team fields
-- Date: 2026-02-10

-- =====================================================
-- 1. Add game phase tracking to games table
-- =====================================================

-- Add current_phase column to track game flow
ALTER TABLE games
ADD COLUMN current_phase TEXT DEFAULT 'regular'
CHECK (current_phase IN ('regular', 'final_jeopardy_wager', 'final_jeopardy_answer', 'final_jeopardy_reveal'));

-- Add index for performance
CREATE INDEX idx_games_current_phase ON games(current_phase);

-- Add comment for documentation
COMMENT ON COLUMN games.current_phase IS 'Tracks the current phase of the game: regular, final_jeopardy_wager, final_jeopardy_answer, or final_jeopardy_reveal';

-- =====================================================
-- 2. Add Final Jeopardy tracking fields to teams table
-- =====================================================

-- Add Final Jeopardy wager amount
ALTER TABLE teams
ADD COLUMN final_jeopardy_wager INTEGER DEFAULT NULL;

-- Add Final Jeopardy answer text
ALTER TABLE teams
ADD COLUMN final_jeopardy_answer TEXT DEFAULT NULL;

-- Add submission timestamp
ALTER TABLE teams
ADD COLUMN final_jeopardy_submitted_at TIMESTAMP DEFAULT NULL;

-- Add constraint: wager must be non-negative
ALTER TABLE teams
ADD CONSTRAINT teams_final_jeopardy_wager_check
CHECK (final_jeopardy_wager IS NULL OR final_jeopardy_wager >= 0);

-- Add index for efficient queries
CREATE INDEX idx_teams_final_jeopardy_submitted ON teams(game_id, final_jeopardy_submitted_at);

-- Add comments for documentation
COMMENT ON COLUMN teams.final_jeopardy_wager IS 'The wager amount for Final Jeopardy (0 to max(score, 0))';
COMMENT ON COLUMN teams.final_jeopardy_answer IS 'The team''s answer for Final Jeopardy';
COMMENT ON COLUMN teams.final_jeopardy_submitted_at IS 'Timestamp when the team submitted their wager/answer';

-- =====================================================
-- 3. Verification queries (for testing)
-- =====================================================

-- Verify games table changes
-- SELECT column_name, data_type, column_default, is_nullable
-- FROM information_schema.columns
-- WHERE table_name = 'games' AND column_name = 'current_phase';

-- Verify teams table changes
-- SELECT column_name, data_type, column_default, is_nullable
-- FROM information_schema.columns
-- WHERE table_name = 'teams' AND column_name IN ('final_jeopardy_wager', 'final_jeopardy_answer', 'final_jeopardy_submitted_at');

-- Verify indexes
-- SELECT indexname, indexdef
-- FROM pg_indexes
-- WHERE tablename IN ('games', 'teams') AND indexname LIKE '%final_jeopardy%';
