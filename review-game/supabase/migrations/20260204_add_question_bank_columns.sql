-- Migration: Add Missing Question Bank Columns
-- Purpose: Add description and difficulty columns to question_banks table
-- These columns exist in dev database but were not in original migrations
-- Date: 2026-02-03

-- Add description column for question bank details
ALTER TABLE public.question_banks
ADD COLUMN IF NOT EXISTS description TEXT;

-- Add difficulty column for filtering question banks by difficulty level
ALTER TABLE public.question_banks
ADD COLUMN IF NOT EXISTS difficulty TEXT;

-- Add check constraint for difficulty values if needed
-- Uncomment and adjust if you have specific difficulty levels
-- ALTER TABLE public.question_banks
-- ADD CONSTRAINT chk_difficulty CHECK (difficulty IN ('easy', 'medium', 'hard') OR difficulty IS NULL);

-- Add comments for documentation
COMMENT ON COLUMN public.question_banks.description IS
  'Detailed description of the question bank content and purpose.';

COMMENT ON COLUMN public.question_banks.difficulty IS
  'Difficulty level of the question bank (e.g., easy, medium, hard). Used for filtering and recommendations.';
