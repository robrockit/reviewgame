-- Export Question Banks and Questions
-- Run this query in your DEV Supabase SQL Editor (nyacfskxqoumzzfvpysv project)
-- Copy the output and save it to use in staging

-- =====================================================
-- STEP 1: Export Question Banks
-- =====================================================
-- This will generate INSERT statements for all question banks
SELECT
  'INSERT INTO question_banks (id, owner_id, title, subject, is_public, is_custom, created_at, updated_at) VALUES (' ||
  '''' || id || '''::uuid, ' ||
  COALESCE('''' || owner_id || '''::uuid', 'NULL') || ', ' ||
  '''' || REPLACE(title, '''', '''''') || ''', ' ||
  COALESCE('''' || REPLACE(subject, '''', '''''') || '''', 'NULL') || ', ' ||
  is_public || ', ' ||
  is_custom || ', ' ||
  '''' || created_at || '''::timestamptz, ' ||
  '''' || updated_at || '''::timestamptz' ||
  ');'
FROM question_banks
ORDER BY created_at;

-- =====================================================
-- STEP 2: Export Questions
-- =====================================================
-- This will generate INSERT statements for all questions
-- Run this AFTER exporting question banks
SELECT
  'INSERT INTO questions (id, bank_id, category, question_text, answer_text, point_value, created_at, updated_at) VALUES (' ||
  '''' || id || '''::uuid, ' ||
  '''' || bank_id || '''::uuid, ' ||
  '''' || REPLACE(category, '''', '''''') || ''', ' ||
  '''' || REPLACE(question_text, '''', '''''') || ''', ' ||
  '''' || REPLACE(answer_text, '''', '''''') || ''', ' ||
  point_value || ', ' ||
  '''' || created_at || '''::timestamptz, ' ||
  '''' || updated_at || '''::timestamptz' ||
  ');'
FROM questions
ORDER BY bank_id, category, point_value;
