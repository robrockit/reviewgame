-- Migration: mc_options for "Pre-Algebra Fundamentals" bank
-- Purpose: Seeds 3 wrong-answer options for all 35 questions so this bank
--          can be used in Quick Fire (pub_trivia) mode.
-- Depends on: 20260426_questions_mc_options.sql (mc_options column)
-- Date: 2026-05-19

DO $$
DECLARE
  v_bank_id UUID;
BEGIN

  SELECT id INTO v_bank_id
  FROM public.question_banks
  WHERE title = 'Pre-Algebra Fundamentals'
    AND is_public = true;

  IF v_bank_id IS NULL THEN
    RAISE EXCEPTION 'Pre-Algebra Fundamentals bank not found';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.questions
    WHERE bank_id = v_bank_id
      AND mc_options IS NOT NULL
  ) THEN
    RAISE NOTICE 'Pre-Algebra Fundamentals mc_options already seeded -- skipping';
    RETURN;
  END IF;

  -- ── Basic Equations & Inequalities ──────────────────────────────────────

  -- 100: correct = "x = 8"
  UPDATE public.questions SET mc_options = '["x = 7", "x = 22", "x = 9"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Basic Equations & Inequalities' AND point_value = 100;

  -- 200: correct = "x = 7"
  UPDATE public.questions SET mc_options = '["x = 4", "x = 24", "x = 6"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Basic Equations & Inequalities' AND point_value = 200;

  -- 300: correct = "x = 6"
  UPDATE public.questions SET mc_options = '["x = 12", "x = 4", "x = 11"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Basic Equations & Inequalities' AND point_value = 300;

  -- 400: correct = "x = 7"
  UPDATE public.questions SET mc_options = '["x = 5", "x = 3", "x = 9"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Basic Equations & Inequalities' AND point_value = 400;

  -- 500: correct = "x < 4"
  UPDATE public.questions SET mc_options = '["x < 8", "x > 4", "x < 7"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Basic Equations & Inequalities' AND point_value = 500;

  -- ── Exponents & Roots ────────────────────────────────────────────────────

  -- 100: correct = "25"
  UPDATE public.questions SET mc_options = '["10", "15", "55"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Exponents & Roots' AND point_value = 100;

  -- 200: correct = "8"
  UPDATE public.questions SET mc_options = '["32", "4", "16"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Exponents & Roots' AND point_value = 200;

  -- 300: correct = "32"
  UPDATE public.questions SET mc_options = '["16", "64", "12"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Exponents & Roots' AND point_value = 300;

  -- 400: correct = "3"
  UPDATE public.questions SET mc_options = '["9", "7", "5"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Exponents & Roots' AND point_value = 400;

  -- 500: correct = "729"
  UPDATE public.questions SET mc_options = '["216", "81", "6561"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Exponents & Roots' AND point_value = 500;

  -- ── Fractions, Decimals & Percents ───────────────────────────────────────

  -- 100: correct = "3/4"
  UPDATE public.questions SET mc_options = '["2/3", "1/3", "5/6"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Fractions, Decimals & Percents' AND point_value = 100;

  -- 200: correct = "3/4"
  UPDATE public.questions SET mc_options = '["75/100", "7/10", "4/5"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Fractions, Decimals & Percents' AND point_value = 200;

  -- 300: correct = "20"
  UPDATE public.questions SET mc_options = '["2", "16", "25"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Fractions, Decimals & Percents' AND point_value = 300;

  -- 400: correct = "1/2"
  UPDATE public.questions SET mc_options = '["2/3", "1/3", "3/4"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Fractions, Decimals & Percents' AND point_value = 400;

  -- 500: correct = "$28"
  UPDATE public.questions SET mc_options = '["$12", "$32", "$24"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Fractions, Decimals & Percents' AND point_value = 500;

  -- ── Integers & Operations ────────────────────────────────────────────────

  -- 100: correct = "3"
  UPDATE public.questions SET mc_options = '["-3", "13", "-13"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Integers & Operations' AND point_value = 100;

  -- 200: correct = "-5"
  UPDATE public.questions SET mc_options = '["-19", "5", "-12"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Integers & Operations' AND point_value = 200;

  -- 300: correct = "15"
  UPDATE public.questions SET mc_options = '["-15", "0", "1"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Integers & Operations' AND point_value = 300;

  -- 400: correct = "24"
  UPDATE public.questions SET mc_options = '["-24", "10", "-10"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Integers & Operations' AND point_value = 400;

  -- 500: correct = "7°F"
  UPDATE public.questions SET mc_options = '["23°F", "-23°F", "-7°F"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Integers & Operations' AND point_value = 500;

  -- ── Order of Operations & Properties ────────────────────────────────────

  -- 100: correct = "Parentheses, Exponents, Multiplication, Division, Addition, Subtraction"
  UPDATE public.questions SET mc_options = '["Parentheses, Exponents, Addition, Division, Multiplication, Subtraction", "Parentheses, Evaluation, Multiplication, Division, Addition, Subtraction", "Powers, Exponents, Multiplication, Division, Addition, Subtraction"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Order of Operations & Properties' AND point_value = 100;

  -- 200: correct = "11"
  UPDATE public.questions SET mc_options = '["14", "10", "7"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Order of Operations & Properties' AND point_value = 200;

  -- 300: correct = "14"
  UPDATE public.questions SET mc_options = '["10", "24", "6"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Order of Operations & Properties' AND point_value = 300;

  -- 400: correct = "Commutative Property of Multiplication"
  UPDATE public.questions SET mc_options = '["Associative Property of Multiplication", "Distributive Property", "Identity Property of Multiplication"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Order of Operations & Properties' AND point_value = 400;

  -- 500: correct = "4x + 12"
  UPDATE public.questions SET mc_options = '["4x + 3", "4x + 4", "x + 12"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Order of Operations & Properties' AND point_value = 500;

  -- ── Ratios & Proportions ─────────────────────────────────────────────────

  -- 100: correct = "2:3"
  UPDATE public.questions SET mc_options = '["3:2", "2:4", "1:3"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Ratios & Proportions' AND point_value = 100;

  -- 200: correct = "$8"
  UPDATE public.questions SET mc_options = '["$6", "$10", "$4"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Ratios & Proportions' AND point_value = 200;

  -- 300: correct = "50 mph"
  UPDATE public.questions SET mc_options = '["45 mph", "30 mph", "60 mph"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Ratios & Proportions' AND point_value = 300;

  -- 400: correct = "15"
  UPDATE public.questions SET mc_options = '["10", "12", "20"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Ratios & Proportions' AND point_value = 400;

  -- 500: correct = "175 miles"
  UPDATE public.questions SET mc_options = '["150 miles", "200 miles", "125 miles"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Ratios & Proportions' AND point_value = 500;

  -- ── Variables & Expressions ──────────────────────────────────────────────

  -- 100: correct = "12"
  UPDATE public.questions SET mc_options = '["7", "35", "10"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Variables & Expressions' AND point_value = 100;

  -- 200: correct = "5x"
  UPDATE public.questions SET mc_options = '["6x", "3x + 2x²", "x + 2x"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Variables & Expressions' AND point_value = 200;

  -- 300: correct = "2"
  UPDATE public.questions SET mc_options = '["-2", "14", "10"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Variables & Expressions' AND point_value = 300;

  -- 400: correct = "3x + 10"
  UPDATE public.questions SET mc_options = '["7x + 10", "3x + 4", "5x + 10"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Variables & Expressions' AND point_value = 400;

  -- 500: correct = "2n + 5"
  UPDATE public.questions SET mc_options = '["5n + 2", "n + 5 × 2", "2 + 5n"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Variables & Expressions' AND point_value = 500;

END $$;

-- Verify all 35 questions now have mc_options
DO $$
DECLARE
  v_nulls INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_nulls
  FROM public.questions q
  JOIN public.question_banks b ON q.bank_id = b.id
  WHERE b.title = 'Pre-Algebra Fundamentals'
    AND q.mc_options IS NULL;

  IF v_nulls > 0 THEN
    RAISE EXCEPTION 'mc_options seed incomplete: % questions still NULL in Pre-Algebra Fundamentals', v_nulls;
  END IF;

  RAISE NOTICE 'OK: all questions in Pre-Algebra Fundamentals now have mc_options';
END $$;
