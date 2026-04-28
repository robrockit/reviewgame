-- Migration: mc_options for "Algebra I: Quadratic Equations & Functions" bank
-- Purpose: Seeds 3 wrong-answer options for all 35 questions so this bank
--          can be used in Quick Fire (pub_trivia) mode.
-- Depends on: 20260426_questions_mc_options.sql (mc_options column)
-- Date: 2026-05-06

DO $$
DECLARE
  v_bank_id UUID;
BEGIN

  SELECT id INTO v_bank_id
  FROM public.question_banks
  WHERE title = 'Algebra I: Quadratic Equations & Functions'
    AND is_public = true;

  IF v_bank_id IS NULL THEN
    RAISE EXCEPTION 'Algebra I: Quadratic Equations & Functions bank not found';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.questions
    WHERE bank_id = v_bank_id
      AND mc_options IS NOT NULL
  ) THEN
    RAISE NOTICE 'Algebra I: Quadratic Equations & Functions mc_options already seeded -- skipping';
    RETURN;
  END IF;

  -- ── Completing the Square ────────────────────────────────────────────────

  -- 100: correct = "9 (adds (6/2)²)"
  UPDATE public.questions SET mc_options = '["6", "3", "12"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Completing the Square' AND point_value = 100;

  -- 200: correct = "25"
  UPDATE public.questions SET mc_options = '["100", "5", "50"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Completing the Square' AND point_value = 200;

  -- 300: correct = "x = 1 or x = -5"
  UPDATE public.questions SET mc_options = '["x = -1 or x = 5", "x = 2 or x = -4", "x = -2 or x = 4"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Completing the Square' AND point_value = 300;

  -- 400: correct = "y = (x + 3)² - 4"
  UPDATE public.questions SET mc_options = '["y = (x + 3)² + 4", "y = (x - 3)² - 4", "y = (x + 6)² - 4"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Completing the Square' AND point_value = 400;

  -- 500: correct = "x = 1 or x = 7"
  UPDATE public.questions SET mc_options = '["x = -1 or x = -7", "x = 2 or x = 6", "x = 1 or x = -7"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Completing the Square' AND point_value = 500;

  -- ── Factoring Quadratics ─────────────────────────────────────────────────

  -- 100: correct = "(x + 2)(x + 4)"
  UPDATE public.questions SET mc_options = '["(x + 1)(x + 8)", "(x + 3)(x + 3)", "(x - 2)(x - 4)"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Factoring Quadratics' AND point_value = 100;

  -- 200: correct = "(x - 4)(x + 3)"
  UPDATE public.questions SET mc_options = '["(x + 4)(x - 3)", "(x - 6)(x + 2)", "(x - 3)(x + 4)"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Factoring Quadratics' AND point_value = 200;

  -- 300: correct = "(x + 4)(x - 4)"
  UPDATE public.questions SET mc_options = '["(x + 4)(x + 4)", "(x - 4)(x - 4)", "(x + 2)(x - 8)"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Factoring Quadratics' AND point_value = 300;

  -- 400: correct = "(x + 5)² (perfect square trinomial)"
  UPDATE public.questions SET mc_options = '["(x + 5)(x - 5)", "(x + 10)(x + 1)", "(x + 25)(x + 1)"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Factoring Quadratics' AND point_value = 400;

  -- 500: correct = "3(x + 2)(x - 2)"
  UPDATE public.questions SET mc_options = '["3(x - 2)(x - 2)", "(3x + 6)(x - 2)", "3(x + 2)(x + 2)"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Factoring Quadratics' AND point_value = 500;

  -- ── Graphing Parabolas ───────────────────────────────────────────────────

  -- 100: correct = "Parabola"
  UPDATE public.questions SET mc_options = '["Hyperbola", "Ellipse", "Straight line"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Graphing Parabolas' AND point_value = 100;

  -- 200: correct = "(0, 0)"
  UPDATE public.questions SET mc_options = '["(1, 1)", "(0, 1)", "(-1, 0)"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Graphing Parabolas' AND point_value = 200;

  -- 300: correct = "Downward (negative coefficient)"
  UPDATE public.questions SET mc_options = '["Upward (positive coefficient)", "Left (negative coefficient)", "Right (positive coefficient)"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Graphing Parabolas' AND point_value = 300;

  -- 400: correct = "(3, 2)"
  UPDATE public.questions SET mc_options = '["(-3, 2)", "(3, -2)", "(-3, -2)"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Graphing Parabolas' AND point_value = 400;

  -- 500: correct = "x = 3"
  UPDATE public.questions SET mc_options = '["x = -3", "x = 6", "y = 3"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Graphing Parabolas' AND point_value = 500;

  -- ── Quadratic Applications ───────────────────────────────────────────────

  -- 100: correct = "7 and 8"
  UPDATE public.questions SET mc_options = '["6 and 9", "8 and 9", "5 and 10"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Quadratic Applications' AND point_value = 100;

  -- 200: correct = "5"
  UPDATE public.questions SET mc_options = '["4", "8", "6"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Quadratic Applications' AND point_value = 200;

  -- 300: correct = "t = 4 seconds"
  UPDATE public.questions SET mc_options = '["t = 2 seconds", "t = 8 seconds", "t = 3 seconds"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Quadratic Applications' AND point_value = 300;

  -- 400: correct = "5"
  UPDATE public.questions SET mc_options = '["6", "4", "3"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Quadratic Applications' AND point_value = 400;

  -- 500: correct = "30 feet"
  UPDATE public.questions SET mc_options = '["25 feet", "45 feet", "40 feet"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Quadratic Applications' AND point_value = 500;

  -- ── Quadratic Formula ────────────────────────────────────────────────────

  -- 100: correct = "x = [-b ± √(b² - 4ac)]/(2a)"
  UPDATE public.questions SET mc_options = '["x = [-b ± √(b² - 4ac)]/(a)", "x = [b ± √(b² - 4ac)]/(2a)", "x = [-b ± √(b² + 4ac)]/(2a)"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Quadratic Formula' AND point_value = 100;

  -- 200: correct = "b² - 4ac"
  UPDATE public.questions SET mc_options = '["b² + 4ac", "4ac - b²", "b - 4ac"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Quadratic Formula' AND point_value = 200;

  -- 300: correct = "x = -1 or x = -3"
  UPDATE public.questions SET mc_options = '["x = 1 or x = 3", "x = -1 or x = 3", "x = 1 or x = -3"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Quadratic Formula' AND point_value = 300;

  -- 400: correct = "Zero (no real solutions, two complex solutions)"
  UPDATE public.questions SET mc_options = '["One real solution", "Two real solutions", "Infinitely many solutions"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Quadratic Formula' AND point_value = 400;

  -- 500: correct = "x = 1 or x = 5"
  UPDATE public.questions SET mc_options = '["x = -1 or x = -5", "x = 2 or x = 3", "x = 1 or x = -5"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Quadratic Formula' AND point_value = 500;

  -- ── Solving by Factoring ─────────────────────────────────────────────────

  -- 100: correct = "x = 5 or x = -5"
  UPDATE public.questions SET mc_options = '["x = 5 only", "x = 25 or x = -25", "x = 5 or x = 0"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Solving by Factoring' AND point_value = 100;

  -- 200: correct = "x = 0 or x = -7"
  UPDATE public.questions SET mc_options = '["x = 7 or x = 0", "x = -7 only", "x = 0 or x = 7"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Solving by Factoring' AND point_value = 200;

  -- 300: correct = "x = -2 or x = -3"
  UPDATE public.questions SET mc_options = '["x = 2 or x = 3", "x = -2 or x = 3", "x = 2 or x = -3"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Solving by Factoring' AND point_value = 300;

  -- 400: correct = "x = 4 or x = 5"
  UPDATE public.questions SET mc_options = '["x = -4 or x = -5", "x = 3 or x = 6", "x = 4 or x = -5"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Solving by Factoring' AND point_value = 400;

  -- 500: correct = "x = 1/2 or x = -3"
  UPDATE public.questions SET mc_options = '["x = -1/2 or x = 3", "x = 2 or x = -3", "x = 1/2 or x = 3"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Solving by Factoring' AND point_value = 500;

  -- ── Square Roots & Radicals ──────────────────────────────────────────────

  -- 100: correct = "6"
  UPDATE public.questions SET mc_options = '["18", "12", "3"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Square Roots & Radicals' AND point_value = 100;

  -- 200: correct = "10"
  UPDATE public.questions SET mc_options = '["50", "20", "5"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Square Roots & Radicals' AND point_value = 200;

  -- 300: correct = "5√2"
  UPDATE public.questions SET mc_options = '["25√2", "10√5", "5√10"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Square Roots & Radicals' AND point_value = 300;

  -- 400: correct = "8√2"
  UPDATE public.questions SET mc_options = '["15√2", "15√4", "8√4"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Square Roots & Radicals' AND point_value = 400;

  -- 500: correct = "√3/3"
  UPDATE public.questions SET mc_options = '["1/√3", "3/√3", "√3"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Square Roots & Radicals' AND point_value = 500;

END $$;

-- Verify all 35 questions now have mc_options
DO $$
DECLARE
  v_nulls INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_nulls
  FROM public.questions q
  JOIN public.question_banks b ON q.bank_id = b.id
  WHERE b.title = 'Algebra I: Quadratic Equations & Functions'
    AND q.mc_options IS NULL;

  IF v_nulls > 0 THEN
    RAISE EXCEPTION 'mc_options seed incomplete: % questions still NULL in Algebra I: Quadratic Equations & Functions', v_nulls;
  END IF;

  RAISE NOTICE 'OK: all questions in Algebra I: Quadratic Equations & Functions now have mc_options';
END $$;
