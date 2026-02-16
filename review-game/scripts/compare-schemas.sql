-- Complete Schema Comparison
-- Run this in DEV database SQL Editor to see ALL columns

-- Get complete schema for all application tables
SELECT
  table_name,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('profiles', 'question_banks', 'questions', 'games', 'teams')
ORDER BY
  table_name,
  ordinal_position;

-- Get all constraints
SELECT
  tc.table_name,
  tc.constraint_name,
  tc.constraint_type,
  cc.column_name
FROM information_schema.table_constraints tc
LEFT JOIN information_schema.constraint_column_usage cc
  ON tc.constraint_name = cc.constraint_name
WHERE tc.table_schema = 'public'
  AND tc.table_name IN ('profiles', 'question_banks', 'questions', 'games', 'teams')
ORDER BY tc.table_name, tc.constraint_type;
