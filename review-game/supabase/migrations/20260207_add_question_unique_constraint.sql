-- Migration: Add Unique Constraint to Questions Table
-- Purpose: Prevent duplicate questions within same bank/category/point_value
-- This constraint exists in dev database but was not in original migrations
-- Date: 2026-02-07

-- Add composite unique constraint on (bank_id, category, point_value)
-- This prevents creating duplicate questions with the same category and point value in one bank
DO $$
BEGIN
  ALTER TABLE public.questions
  ADD CONSTRAINT questions_bank_id_category_point_value_key
  UNIQUE (bank_id, category, point_value);
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN unique_violation THEN
    -- If constraint fails due to existing duplicates, log warning but continue
    RAISE NOTICE 'Warning: Duplicate questions found. Constraint not added. Clean up duplicates first.';
END $$;

-- Add comment for documentation
COMMENT ON CONSTRAINT questions_bank_id_category_point_value_key ON public.questions IS
  'Ensures each question bank has only one question per category/point_value combination. Prevents duplicate question slots in the Jeopardy board.';
