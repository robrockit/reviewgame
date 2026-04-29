-- Migration: Patch mc_options for "Variables on Both Sides" category
-- Purpose: The "Algebra I: Linear Equations & Inequalities" bank has 7 categories;
--          20260502 only covered 6. This adds the missing category.
-- Depends on: 20260502_algebra_banks_mc_options.sql
-- Date: 2026-05-03

DO $$
DECLARE
  v_bank_id UUID;
BEGIN

  SELECT id INTO v_bank_id
  FROM public.question_banks
  WHERE title = 'Algebra I: Linear Equations & Inequalities'
    AND is_public = true;

  IF v_bank_id IS NULL THEN
    RAISE EXCEPTION 'Algebra I: Linear Equations & Inequalities bank not found';
  END IF;

  -- Idempotency guard: skip if this category is already seeded
  IF EXISTS (
    SELECT 1 FROM public.questions
    WHERE bank_id = v_bank_id
      AND category = 'Variables on Both Sides'
      AND mc_options IS NOT NULL
  ) THEN
    RAISE NOTICE 'Variables on Both Sides mc_options already seeded -- skipping';
    RETURN;
  END IF;

  -- 100: correct = "x = 5"
  -- Errors: forgetting to divide (x = 10), adding coefficients (8x = 10 → x = 5/4),
  --         dividing by wrong coefficient (10/5 = 2)
  UPDATE public.questions SET mc_options = '["x = 10", "x = 5/4", "x = 2"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Variables on Both Sides' AND point_value = 100;

  -- 200: correct = "x = 4"
  -- Errors: moving constant to wrong side (4x = 8 → x = 2),
  --         forgetting to add constant (4x = 12 → x = 3),
  --         forgetting to divide (4x = 16 → x = 16)
  UPDATE public.questions SET mc_options = '["x = 2", "x = 3", "x = 16"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Variables on Both Sides' AND point_value = 200;

  -- 300: correct = "x = 5"
  -- Errors: sign error on moving 9 (-3x = 3 → x = -1),
  --         sign error on final division (-3x = -15 → x = -5),
  --         adding x-terms instead of subtracting (7x = 3 → x = 3/7)
  UPDATE public.questions SET mc_options = '["x = -1", "x = -5", "x = 3/7"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Variables on Both Sides' AND point_value = 300;

  -- 400: correct = "x = 5"
  -- Errors: distributing 3 to first term only (3x + 2 = 2x + 11 → x = 9),
  --         moving constant to wrong side (3x = 2x + 17 → x = 17),
  --         adding x-terms instead of subtracting (5x = 17 → x = 17/5)
  UPDATE public.questions SET mc_options = '["x = 9", "x = 17", "x = 17/5"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Variables on Both Sides' AND point_value = 400;

  -- 500: correct = "x = 2"
  -- Errors: subtracting constants in wrong order (5x = 6 - 4 = 2 → x = 2/5),
  --         moving constants to wrong side (5x = -4 - 6 = -10 → x = -2),
  --         forgetting to divide by 5 (5x = 10 → x = 10)
  UPDATE public.questions SET mc_options = '["x = 2/5", "x = -2", "x = 10"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Variables on Both Sides' AND point_value = 500;

END $$;

-- Verify the full bank now has zero NULL mc_options
DO $$
DECLARE
  v_nulls INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_nulls
  FROM public.questions q
  JOIN public.question_banks b ON q.bank_id = b.id
  WHERE b.title = 'Algebra I: Linear Equations & Inequalities'
    AND q.mc_options IS NULL;

  IF v_nulls > 0 THEN
    RAISE EXCEPTION 'mc_options still incomplete: % questions NULL in Linear Equations & Inequalities', v_nulls;
  END IF;

  RAISE NOTICE 'OK: all questions in Linear Equations & Inequalities now have mc_options';
END $$;
