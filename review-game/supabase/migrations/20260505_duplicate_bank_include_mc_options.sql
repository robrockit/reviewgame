-- Migration: Fix duplicate_question_bank to copy mc_options
-- Purpose: The function was written before mc_options existed (20250210).
--          Duplicated banks had NULL mc_options on all questions, making them
--          unusable in Quick Fire mode even when the source bank was seeded.
-- Depends on: 20250210_duplicate_question_bank_function.sql
--             20260426_questions_mc_options.sql

CREATE OR REPLACE FUNCTION duplicate_question_bank(
  source_bank_id UUID,
  new_owner_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  new_bank_record RECORD;
  original_bank_record RECORD;
  questions_count INTEGER;
BEGIN
  -- 1. Fetch original bank (with row lock to prevent concurrent modifications)
  SELECT * INTO original_bank_record
  FROM question_banks
  WHERE id = source_bank_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Source question bank not found: %', source_bank_id;
  END IF;

  -- 2. Verify access (must be public OR owned by requester)
  IF NOT original_bank_record.is_public AND original_bank_record.owner_id != new_owner_id THEN
    RAISE EXCEPTION 'Access denied to question bank: %', source_bank_id;
  END IF;

  -- 3. Create new bank (will fail atomically if any issues)
  INSERT INTO question_banks (
    owner_id,
    title,
    subject,
    description,
    difficulty,
    is_custom,
    is_public
  ) VALUES (
    new_owner_id,
    'Copy of ' || original_bank_record.title,
    original_bank_record.subject,
    original_bank_record.description,
    original_bank_record.difficulty,
    true,  -- Duplicates are always custom
    false  -- Duplicates start as private
  )
  RETURNING * INTO new_bank_record;

  -- 4. Duplicate all questions atomically, including mc_options
  INSERT INTO questions (
    bank_id,
    category,
    point_value,
    position,
    question_text,
    answer_text,
    teacher_notes,
    image_url,
    mc_options
  )
  SELECT
    new_bank_record.id,
    category,
    point_value,
    position,
    question_text,
    answer_text,
    teacher_notes,
    image_url,
    mc_options
  FROM questions
  WHERE bank_id = source_bank_id
  ORDER BY position;

  -- 5. Get count of duplicated questions
  GET DIAGNOSTICS questions_count = ROW_COUNT;

  -- 6. Return success with new bank data
  RETURN json_build_object(
    'id', new_bank_record.id,
    'title', new_bank_record.title,
    'subject', new_bank_record.subject,
    'description', new_bank_record.description,
    'difficulty', new_bank_record.difficulty,
    'is_custom', new_bank_record.is_custom,
    'is_public', new_bank_record.is_public,
    'owner_id', new_bank_record.owner_id,
    'created_at', new_bank_record.created_at,
    'updated_at', new_bank_record.updated_at,
    'questions_count', questions_count
  );

EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Failed to duplicate question bank: %', SQLERRM;
END;
$$;

GRANT EXECUTE ON FUNCTION public.duplicate_question_bank(UUID, UUID) TO authenticated;

COMMENT ON FUNCTION duplicate_question_bank IS
  'Atomically duplicates a question bank with all its questions, including mc_options for Quick Fire mode. Verifies access permissions (public OR owned by requester). Returns JSON with new bank data and question count.';
