-- Manual Column Addition for STAGING
-- Run this directly in Supabase SQL Editor if migrations aren't working

-- Add description and difficulty to question_banks
ALTER TABLE public.question_banks
ADD COLUMN IF NOT EXISTS description TEXT;

ALTER TABLE public.question_banks
ADD COLUMN IF NOT EXISTS difficulty TEXT;

-- Add image_url, teacher_notes, and position to questions
ALTER TABLE public.questions
ADD COLUMN IF NOT EXISTS image_url TEXT;

ALTER TABLE public.questions
ADD COLUMN IF NOT EXISTS teacher_notes TEXT;

ALTER TABLE public.questions
ADD COLUMN IF NOT EXISTS position INTEGER;

-- Verify columns were added
SELECT 'question_banks columns:' as info;
SELECT column_name FROM information_schema.columns
WHERE table_name = 'question_banks' AND table_schema = 'public'
ORDER BY ordinal_position;

SELECT 'questions columns:' as info;
SELECT column_name FROM information_schema.columns
WHERE table_name = 'questions' AND table_schema = 'public'
ORDER BY ordinal_position;
