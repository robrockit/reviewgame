-- Import Question Banks and Questions to STAGING
-- Run this in your STAGING Supabase SQL Editor (kvygljdyzdhltngqvrii project)
--
-- BEFORE RUNNING:
-- 1. Export data from dev using export-questions.sql
-- 2. Replace PASTE_QUESTION_BANKS_HERE with exported question banks
-- 3. Replace PASTE_QUESTIONS_HERE with exported questions
-- 4. If you have custom banks with owner_id, update those UUIDs to match staging user IDs

-- =====================================================
-- Disable RLS temporarily for import (admin only)
-- =====================================================
-- This allows us to insert data without RLS blocking us
ALTER TABLE question_banks DISABLE ROW LEVEL SECURITY;
ALTER TABLE questions DISABLE ROW LEVEL SECURITY;

-- =====================================================
-- PASTE QUESTION BANKS INSERT STATEMENTS HERE
-- =====================================================
-- Example:
-- INSERT INTO question_banks (id, owner_id, title, subject, is_public, is_custom, created_at, updated_at)
-- VALUES ('uuid-here'::uuid, NULL, 'Sample Bank', 'Math', true, false, NOW(), NOW());



-- =====================================================
-- PASTE QUESTIONS INSERT STATEMENTS HERE
-- =====================================================
-- Example:
-- INSERT INTO questions (id, bank_id, category, question_text, answer_text, point_value, created_at, updated_at)
-- VALUES ('uuid-here'::uuid, 'bank-uuid-here'::uuid, 'Category 1', 'Question?', 'Answer', 100, NOW(), NOW());



-- =====================================================
-- Re-enable RLS after import
-- =====================================================
ALTER TABLE question_banks ENABLE ROW LEVEL SECURITY;
ALTER TABLE questions ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- Verify import
-- =====================================================
SELECT 'Question Banks Imported: ' || COUNT(*) FROM question_banks;
SELECT 'Questions Imported: ' || COUNT(*) FROM questions;
SELECT 'Public Banks: ' || COUNT(*) FROM question_banks WHERE is_public = true;
SELECT 'Custom Banks: ' || COUNT(*) FROM question_banks WHERE is_custom = true;
