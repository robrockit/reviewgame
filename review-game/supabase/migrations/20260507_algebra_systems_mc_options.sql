-- Migration: mc_options for "Algebra I: Systems of Equations" bank
-- Purpose: Seeds 3 wrong-answer options for all 35 questions so this bank
--          can be used in Quick Fire (pub_trivia) mode.
-- Depends on: 20260426_questions_mc_options.sql (mc_options column)
-- Date: 2026-05-07

DO $$
DECLARE
  v_bank_id UUID;
BEGIN

  SELECT id INTO v_bank_id
  FROM public.question_banks
  WHERE title = 'Algebra I: Systems of Equations'
    AND is_public = true;

  IF v_bank_id IS NULL THEN
    RAISE EXCEPTION 'Algebra I: Systems of Equations bank not found';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.questions
    WHERE bank_id = v_bank_id
      AND mc_options IS NOT NULL
  ) THEN
    RAISE NOTICE 'Algebra I: Systems of Equations mc_options already seeded -- skipping';
    RETURN;
  END IF;

  -- ── Applications of Systems ──────────────────────────────────────────────

  -- 100: correct = "5 apples"
  UPDATE public.questions SET mc_options = '["10 apples", "8 apples", "3 apples"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Applications of Systems' AND point_value = 100;

  -- 200: correct = "2 hours"
  UPDATE public.questions SET mc_options = '["1 hour", "4 hours", "3 hours"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Applications of Systems' AND point_value = 200;

  -- 300: correct = "6 cm"
  UPDATE public.questions SET mc_options = '["9 cm", "7.5 cm", "4 cm"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Applications of Systems' AND point_value = 300;

  -- 400: correct = "5 pounds coffee, 5 pounds tea"
  UPDATE public.questions SET mc_options = '["7 pounds coffee, 3 pounds tea", "4 pounds coffee, 6 pounds tea", "6 pounds coffee, 4 pounds tea"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Applications of Systems' AND point_value = 400;

  -- 500: correct = "2.5 mph"
  UPDATE public.questions SET mc_options = '["5 mph", "1 mph", "3.5 mph"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Applications of Systems' AND point_value = 500;

  -- ── Elimination Method ───────────────────────────────────────────────────

  -- 100: correct = "x = 5, y = 3"
  UPDATE public.questions SET mc_options = '["x = 3, y = 5", "x = 5, y = 5", "x = 4, y = 4"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Elimination Method' AND point_value = 100;

  -- 200: correct = "x = 4, y = 2"
  UPDATE public.questions SET mc_options = '["x = 2, y = 4", "x = 3, y = 3", "x = 4, y = 4"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Elimination Method' AND point_value = 200;

  -- 300: correct = "x = 3, y = 1.5"
  UPDATE public.questions SET mc_options = '["x = 2, y = 3", "x = 3, y = 3", "x = 4, y = 0"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Elimination Method' AND point_value = 300;

  -- 400: correct = "x = 3, y = 4"
  UPDATE public.questions SET mc_options = '["x = 4, y = 3", "x = 2, y = 5", "x = 5, y = 2"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Elimination Method' AND point_value = 400;

  -- 500: correct = "x = 3, y = 2"
  UPDATE public.questions SET mc_options = '["x = 2, y = 3", "x = 1, y = 4", "x = 3, y = 3"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Elimination Method' AND point_value = 500;

  -- ── Graphing Systems ─────────────────────────────────────────────────────

  -- 100: correct = "Two or more equations with the same variables"
  UPDATE public.questions SET mc_options = '["A single equation with two variables", "An equation with squared terms", "Two equations with different variables"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Graphing Systems' AND point_value = 100;

  -- 200: correct = "The point of intersection"
  UPDATE public.questions SET mc_options = '["Where one line crosses the x-axis", "The slope of each line", "The y-intercept of both lines"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Graphing Systems' AND point_value = 200;

  -- 300: correct = "x = 2, y = 5"
  UPDATE public.questions SET mc_options = '["x = 5, y = 2", "x = -2, y = 5", "x = 2, y = -5"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Graphing Systems' AND point_value = 300;

  -- 400: correct = "No solution"
  UPDATE public.questions SET mc_options = '["One solution", "Infinitely many solutions", "Two solutions"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Graphing Systems' AND point_value = 400;

  -- 500: correct = "Infinitely many solutions"
  UPDATE public.questions SET mc_options = '["No solution", "Exactly one solution", "Exactly two solutions"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Graphing Systems' AND point_value = 500;

  -- ── Special Systems ──────────────────────────────────────────────────────

  -- 100: correct = "Inconsistent system"
  UPDATE public.questions SET mc_options = '["Dependent system", "Independent system", "Consistent system"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Special Systems' AND point_value = 100;

  -- 200: correct = "Dependent system"
  UPDATE public.questions SET mc_options = '["Inconsistent system", "Independent system", "Linear system"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Special Systems' AND point_value = 200;

  -- 300: correct = "No solution (parallel lines)"
  UPDATE public.questions SET mc_options = '["One solution", "Infinitely many solutions", "Two solutions"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Special Systems' AND point_value = 300;

  -- 400: correct = "Infinitely many (same line)"
  UPDATE public.questions SET mc_options = '["No solution (parallel lines)", "Exactly one solution", "Exactly two solutions"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Special Systems' AND point_value = 400;

  -- 500: correct = "Infinitely many solutions (dependent system or same line)"
  UPDATE public.questions SET mc_options = '["No solution (inconsistent system)", "One unique solution", "The system has an error and cannot be solved"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Special Systems' AND point_value = 500;

  -- ── Substitution Method ──────────────────────────────────────────────────

  -- 100: correct = "x = 1, y = 2"
  UPDATE public.questions SET mc_options = '["x = 2, y = 1", "x = 0, y = 1", "x = 1, y = 3"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Substitution Method' AND point_value = 100;

  -- 200: correct = "x = 3, y = 6"
  UPDATE public.questions SET mc_options = '["x = 6, y = 3", "x = 4, y = 5", "x = 2, y = 7"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Substitution Method' AND point_value = 200;

  -- 300: correct = "x = 4, y = 5"
  UPDATE public.questions SET mc_options = '["x = 5, y = 4", "x = 4, y = 4", "x = 3, y = 5"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Substitution Method' AND point_value = 300;

  -- 400: correct = "x = 4, y = 2"
  UPDATE public.questions SET mc_options = '["x = 2, y = 4", "x = 3, y = 1", "x = 5, y = 3"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Substitution Method' AND point_value = 400;

  -- 500: correct = "x = 3, y = 1"
  UPDATE public.questions SET mc_options = '["x = 1, y = 3", "x = 3, y = -1", "x = 2, y = 2"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Substitution Method' AND point_value = 500;

  -- ── Systems of Inequalities ──────────────────────────────────────────────

  -- 100: correct = "The overlapping shaded region"
  UPDATE public.questions SET mc_options = '["The union of both shaded regions", "The boundary lines only", "The region outside both inequalities"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Systems of Inequalities' AND point_value = 100;

  -- 200: correct = "Yes"
  UPDATE public.questions SET mc_options = '["No", "Cannot be determined", "Only satisfies one inequality"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Systems of Inequalities' AND point_value = 200;

  -- 300: correct = "No"
  UPDATE public.questions SET mc_options = '["Yes", "Only satisfies y > x + 1", "Only satisfies y < 2x"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Systems of Inequalities' AND point_value = 300;

  -- 400: correct = "Above the line"
  UPDATE public.questions SET mc_options = '["Below the line", "To the left of the line", "On the line only"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Systems of Inequalities' AND point_value = 400;

  -- 500: correct = "Solid (the inequality includes equal to)"
  UPDATE public.questions SET mc_options = '["Dashed (the inequality is strict)", "Dotted (all inequalities use dotted lines)", "No line is drawn"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Systems of Inequalities' AND point_value = 500;

  -- ── Systems Word Problems ────────────────────────────────────────────────

  -- 100: correct = "6 and 9"
  UPDATE public.questions SET mc_options = '["7 and 8", "5 and 10", "4 and 11"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Systems Word Problems' AND point_value = 100;

  -- 200: correct = "50 adult tickets"
  UPDATE public.questions SET mc_options = '["40 adult tickets", "60 adult tickets", "30 adult tickets"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Systems Word Problems' AND point_value = 200;

  -- 300: correct = "12"
  UPDATE public.questions SET mc_options = '["10", "14", "8"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Systems Word Problems' AND point_value = 300;

  -- 400: correct = "8 shirts"
  UPDATE public.questions SET mc_options = '["6 shirts", "4 shirts", "10 shirts"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Systems Word Problems' AND point_value = 400;

  -- 500: correct = "8 dimes"
  UPDATE public.questions SET mc_options = '["12 dimes", "10 dimes", "6 dimes"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Systems Word Problems' AND point_value = 500;

END $$;

-- Verify all 35 questions now have mc_options
DO $$
DECLARE
  v_nulls INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_nulls
  FROM public.questions q
  JOIN public.question_banks b ON q.bank_id = b.id
  WHERE b.title = 'Algebra I: Systems of Equations'
    AND q.mc_options IS NULL;

  IF v_nulls > 0 THEN
    RAISE EXCEPTION 'mc_options seed incomplete: % questions still NULL in Algebra I: Systems of Equations', v_nulls;
  END IF;

  RAISE NOTICE 'OK: all questions in Algebra I: Systems of Equations now have mc_options';
END $$;
