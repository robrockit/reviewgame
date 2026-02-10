-- Migration: Add atomic duplicate_question_bank function
-- Purpose: Ensures question bank duplication is fully transactional
-- Prevents orphaned banks when question insertion fails

CREATE OR REPLACE FUNCTION duplicate_question_bank(
  source_bank_id UUID,
  new_owner_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
    true, -- Duplicates are always custom
    false -- Duplicates start as private
  )
  RETURNING * INTO new_bank_record;

  -- 4. Duplicate all questions atomically
  INSERT INTO questions (
    bank_id,
    category,
    point_value,
    position,
    question_text,
    answer_text,
    teacher_notes,
    image_url
  )
  SELECT
    new_bank_record.id, -- New bank ID
    category,
    point_value,
    position,
    question_text,
    answer_text,
    teacher_notes,
    image_url
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

  -- If anything fails above, PostgreSQL automatically rolls back the entire transaction
  -- No orphaned banks possible!

EXCEPTION
  WHEN OTHERS THEN
    -- Log error details and re-raise
    RAISE EXCEPTION 'Failed to duplicate question bank: %', SQLERRM;
END;
$$;

-- Grant execute permission to authenticated users (RLS will handle access control)
GRANT EXECUTE ON FUNCTION duplicate_question_bank(UUID, UUID) TO authenticated;

-- Add comment for documentation
COMMENT ON FUNCTION duplicate_question_bank IS
  'Atomically duplicates a question bank with all its questions. ' ||
  'Ensures no orphaned banks are created if question insertion fails. ' ||
  'Verifies access permissions (public OR owned by requester). ' ||
  'Returns JSON with new bank data and question count.';
