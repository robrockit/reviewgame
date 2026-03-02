-- Migration: Final Schema Alignment with Dev
-- Purpose: Add all remaining missing columns and fix nullability constraints
-- Date: 2026-02-08

-- =====================================================
-- GAMES TABLE
-- =====================================================

-- Add final_jeopardy_question column
ALTER TABLE public.games
ADD COLUMN IF NOT EXISTS final_jeopardy_question JSONB;

-- Fix teacher_id nullability (set NOT NULL)
-- First update any NULL values if they exist (shouldn't happen, but be safe)
UPDATE public.games SET teacher_id = (SELECT id FROM profiles LIMIT 1) WHERE teacher_id IS NULL;

ALTER TABLE public.games
ALTER COLUMN teacher_id SET NOT NULL;

-- Fix bank_id nullability (set NOT NULL)
-- First delete any games without bank_id (orphaned/invalid data)
DELETE FROM public.games WHERE bank_id IS NULL;

ALTER TABLE public.games
ALTER COLUMN bank_id SET NOT NULL;

COMMENT ON COLUMN public.games.final_jeopardy_question IS
  'Final Jeopardy question data stored as JSON. Contains category, question, answer, and wager information.';

-- =====================================================
-- PROFILES TABLE
-- =====================================================

-- Add trial_end_date column
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS trial_end_date TIMESTAMP WITHOUT TIME ZONE;

COMMENT ON COLUMN public.profiles.trial_end_date IS
  'End date of trial period for users on trial subscription. NULL if user has never had a trial or trial has ended.';

-- =====================================================
-- QUESTIONS TABLE
-- =====================================================

-- Fix position nullability (set NOT NULL with default)
-- First, set any NULL positions to a default value (end of list)
UPDATE public.questions
SET position = 999
WHERE position IS NULL;

-- Now make it NOT NULL
ALTER TABLE public.questions
ALTER COLUMN position SET NOT NULL;

-- =====================================================
-- TEAMS TABLE
-- =====================================================

-- Add last_seen column
ALTER TABLE public.teams
ADD COLUMN IF NOT EXISTS last_seen TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW();

-- Create index for last_seen queries (finding stale connections)
CREATE INDEX IF NOT EXISTS idx_teams_last_seen
ON public.teams(last_seen)
WHERE connection_status = 'connected';

COMMENT ON COLUMN public.teams.last_seen IS
  'Timestamp of last heartbeat/activity from this team. Used to detect disconnected teams.';

-- =====================================================
-- VERIFICATION
-- =====================================================

-- Log completion
DO $$
BEGIN
  RAISE NOTICE 'Schema alignment complete!';
  RAISE NOTICE 'Added: games.final_jeopardy_question, profiles.trial_end_date, teams.last_seen';
  RAISE NOTICE 'Fixed nullability: games.teacher_id, games.bank_id, questions.position';
END $$;
