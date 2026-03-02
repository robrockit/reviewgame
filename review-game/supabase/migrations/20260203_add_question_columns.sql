-- Migration: Add Missing Question Columns
-- Purpose: Add image_url, teacher_notes, and position columns to questions table
-- These columns exist in dev database but were not in original migrations
-- Date: 2026-02-03

-- Add image_url column for video/image question support (Premium feature)
ALTER TABLE public.questions
ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Add teacher_notes column for instructor guidance
ALTER TABLE public.questions
ADD COLUMN IF NOT EXISTS teacher_notes TEXT;

-- Add position column for custom question ordering
ALTER TABLE public.questions
ADD COLUMN IF NOT EXISTS position INTEGER;

-- Add index on position for efficient ordering queries
CREATE INDEX IF NOT EXISTS idx_questions_position
ON public.questions(bank_id, position);

-- Add comments for documentation
COMMENT ON COLUMN public.questions.image_url IS
  'URL to image or video for this question. Premium feature for BASIC and PREMIUM tiers.';

COMMENT ON COLUMN public.questions.teacher_notes IS
  'Private notes for teachers about this question. Not shown to students.';

COMMENT ON COLUMN public.questions.position IS
  'Custom ordering position within the question bank. NULL means use default ordering.';
