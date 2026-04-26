-- Migration: Add multiple-choice wrong options to questions table
-- Description: Adds mc_options JSONB column — an array of exactly 3 wrong answer strings
--              used by pub trivia mode. NULL on existing Jeopardy questions; no data loss.
-- Date: 2026-04-26

ALTER TABLE public.questions
  ADD COLUMN IF NOT EXISTS mc_options JSONB;

-- Partial index allows efficient lookup of pub-trivia-ready questions within a bank
-- (questions WHERE mc_options IS NOT NULL). Used at game-creation validation time.
CREATE INDEX IF NOT EXISTS idx_questions_mc_options_bank
  ON public.questions(bank_id)
  WHERE mc_options IS NOT NULL;

COMMENT ON COLUMN public.questions.mc_options IS
  'Array of 3 wrong answer strings for pub trivia multiple choice, e.g. ["London","Berlin","Rome"]. NULL means question is Jeopardy-only. answer_text holds the correct answer.';
