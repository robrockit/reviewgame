-- Migration: Add Timer Columns to Games Table
-- Purpose: Add timer_enabled and timer_seconds columns for timer functionality
-- These columns exist in dev database but were not in original migrations
-- Date: 2026-02-05

-- Add timer_enabled column (default true for backward compatibility)
ALTER TABLE public.games
ADD COLUMN IF NOT EXISTS timer_enabled BOOLEAN DEFAULT true;

-- Add timer_seconds column (default 10 seconds)
ALTER TABLE public.games
ADD COLUMN IF NOT EXISTS timer_seconds INTEGER DEFAULT 10;

-- Add check constraint for valid timer_seconds range
DO $$
BEGIN
  ALTER TABLE public.games
  ADD CONSTRAINT chk_timer_seconds_range
  CHECK (timer_seconds IS NULL OR (timer_seconds >= 5 AND timer_seconds <= 120));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Add comments for documentation
COMMENT ON COLUMN public.games.timer_enabled IS
  'Whether the timer is enabled for this game. If true, students have limited time to answer questions.';

COMMENT ON COLUMN public.games.timer_seconds IS
  'Number of seconds for the timer when timer_enabled is true. Must be between 5 and 120 seconds, or NULL if timer disabled.';
