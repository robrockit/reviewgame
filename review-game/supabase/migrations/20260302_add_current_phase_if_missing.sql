-- Migration: Add current_phase column to games table (if missing)
-- Description: Ensures current_phase column exists for Final Jeopardy game flow
-- Date: 2026-03-02
-- Related: RG-118 - Fix deployment blocker

-- Add current_phase column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'games' AND column_name = 'current_phase'
    ) THEN
        -- Add column
        ALTER TABLE games
        ADD COLUMN current_phase TEXT DEFAULT 'regular'
        CHECK (current_phase IN ('regular', 'final_jeopardy_wager', 'final_jeopardy_answer', 'final_jeopardy_reveal'));

        -- Add index for performance
        CREATE INDEX idx_games_current_phase ON games(current_phase);

        -- Add comment for documentation
        COMMENT ON COLUMN games.current_phase IS 'Tracks the current phase of the game: regular, final_jeopardy_wager, final_jeopardy_answer, or final_jeopardy_reveal';

        RAISE NOTICE 'Added current_phase column to games table';
    ELSE
        RAISE NOTICE 'current_phase column already exists in games table';
    END IF;
END $$;
