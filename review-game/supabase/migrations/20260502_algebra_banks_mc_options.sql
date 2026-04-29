-- Migration: Seed mc_options for Algebra I prebuilt question banks
-- Purpose: Enables pub trivia mode for 3 Algebra I banks originally seeded for Jeopardy.
-- Banks: Exponents & Polynomials (35q), Graphing & Linear Functions (35q),
--        Linear Equations & Inequalities (30q)
-- Depends on: 20260426_questions_mc_options.sql
-- Date: 2026-05-02

DO $$
DECLARE
  v_exp  UUID;  -- Exponents & Polynomials
  v_grf  UUID;  -- Graphing & Linear Functions
  v_lin  UUID;  -- Linear Equations & Inequalities
BEGIN

  SELECT id INTO v_exp FROM public.question_banks WHERE title = 'Algebra I: Exponents & Polynomials'      AND is_public = true;
  SELECT id INTO v_grf FROM public.question_banks WHERE title = 'Algebra I: Graphing & Linear Functions'  AND is_public = true;
  SELECT id INTO v_lin FROM public.question_banks WHERE title = 'Algebra I: Linear Equations & Inequalities' AND is_public = true;

  -- =========================================================
  -- BANK 1: Algebra I: Exponents & Polynomials
  -- =========================================================

  IF v_exp IS NULL THEN
    RAISE NOTICE 'Algebra I: Exponents & Polynomials not found -- skipping';
  ELSIF EXISTS (SELECT 1 FROM public.questions WHERE bank_id = v_exp AND mc_options IS NOT NULL) THEN
    RAISE NOTICE 'Exponents & Polynomials mc_options already seeded -- skipping';
  ELSE

    -- Adding & Subtracting Polynomials
    UPDATE public.questions SET mc_options = '["An expression with exactly one term containing a variable", "An equation that always has exactly two solutions", "A ratio of two expressions where the denominator contains a variable"]'::jsonb
    WHERE bank_id = v_exp AND category = 'Adding & Subtracting Polynomials' AND point_value = 100;

    UPDATE public.questions SET mc_options = '["5x + 6", "5x - 4", "6x + 4"]'::jsonb
    WHERE bank_id = v_exp AND category = 'Adding & Subtracting Polynomials' AND point_value = 200;

    UPDATE public.questions SET mc_options = '["6x² + 8x", "2x² - 2x", "6x⁴ - 2x"]'::jsonb
    WHERE bank_id = v_exp AND category = 'Adding & Subtracting Polynomials' AND point_value = 300;

    UPDATE public.questions SET mc_options = '["3x² - 2x - 2", "7x² - 2x + 6", "3x² - 4x - 2"]'::jsonb
    WHERE bank_id = v_exp AND category = 'Adding & Subtracting Polynomials' AND point_value = 400;

    UPDATE public.questions SET mc_options = '["3", "8", "0"]'::jsonb
    WHERE bank_id = v_exp AND category = 'Adding & Subtracting Polynomials' AND point_value = 500;

    -- Factoring Polynomials
    UPDATE public.questions SET mc_options = '["2(3x + 6)", "6(x + 12)", "3(2x + 4)"]'::jsonb
    WHERE bank_id = v_exp AND category = 'Factoring Polynomials' AND point_value = 100;

    UPDATE public.questions SET mc_options = '["(x + 1)(x + 6)", "(x - 2)(x - 3)", "(x + 5)(x + 1)"]'::jsonb
    WHERE bank_id = v_exp AND category = 'Factoring Polynomials' AND point_value = 200;

    UPDATE public.questions SET mc_options = '["(x - 3)²", "(x + 9)(x - 1)", "(x - 9)(x + 1)"]'::jsonb
    WHERE bank_id = v_exp AND category = 'Factoring Polynomials' AND point_value = 300;

    UPDATE public.questions SET mc_options = '["(x + 3)(x - 4)", "(x - 2)(x - 6)", "(x - 1)(x - 12)"]'::jsonb
    WHERE bank_id = v_exp AND category = 'Factoring Polynomials' AND point_value = 400;

    UPDATE public.questions SET mc_options = '["(2x + 3)(x + 1)", "(x + 1)(2x + 7)", "(2x - 1)(x - 3)"]'::jsonb
    WHERE bank_id = v_exp AND category = 'Factoring Polynomials' AND point_value = 500;

    -- Multiplying Polynomials
    UPDATE public.questions SET mc_options = '["3x² + 4", "3x + 12x", "3x² + 12"]'::jsonb
    WHERE bank_id = v_exp AND category = 'Multiplying Polynomials' AND point_value = 100;

    UPDATE public.questions SET mc_options = '["-6x² - 10x", "6x² + 10x", "-6x² - 5x"]'::jsonb
    WHERE bank_id = v_exp AND category = 'Multiplying Polynomials' AND point_value = 200;

    UPDATE public.questions SET mc_options = '["x² + 15x + 8", "x² + 8x + 8", "x² + 15"]'::jsonb
    WHERE bank_id = v_exp AND category = 'Multiplying Polynomials' AND point_value = 300;

    UPDATE public.questions SET mc_options = '["2x² - 4", "2x² + 8x - 1", "2x² - 7x - 4"]'::jsonb
    WHERE bank_id = v_exp AND category = 'Multiplying Polynomials' AND point_value = 400;

    UPDATE public.questions SET mc_options = '["x³ - x² + 5x + 2", "x³ + x² - 5x + 2", "x³ - x² - 5x - 2"]'::jsonb
    WHERE bank_id = v_exp AND category = 'Multiplying Polynomials' AND point_value = 500;

    -- Negative & Zero Exponents
    UPDATE public.questions SET mc_options = '["0", "The base itself", "Undefined"]'::jsonb
    WHERE bank_id = v_exp AND category = 'Negative & Zero Exponents' AND point_value = 100;

    UPDATE public.questions SET mc_options = '["0", "5", "1/5"]'::jsonb
    WHERE bank_id = v_exp AND category = 'Negative & Zero Exponents' AND point_value = 200;

    UPDATE public.questions SET mc_options = '["-x³", "x³", "1/(-x³)"]'::jsonb
    WHERE bank_id = v_exp AND category = 'Negative & Zero Exponents' AND point_value = 300;

    UPDATE public.questions SET mc_options = '["-16", "-1/16", "1/8"]'::jsonb
    WHERE bank_id = v_exp AND category = 'Negative & Zero Exponents' AND point_value = 400;

    UPDATE public.questions SET mc_options = '["x⁵/y⁴", "y²/x⁵", "y⁴/x"]'::jsonb
    WHERE bank_id = v_exp AND category = 'Negative & Zero Exponents' AND point_value = 500;

    -- Properties of Exponents
    UPDATE public.questions SET mc_options = '["x¹²", "2x⁷", "x³⁴"]'::jsonb
    WHERE bank_id = v_exp AND category = 'Properties of Exponents' AND point_value = 100;

    UPDATE public.questions SET mc_options = '["x⁷", "x²⁵", "5x²"]'::jsonb
    WHERE bank_id = v_exp AND category = 'Properties of Exponents' AND point_value = 200;

    UPDATE public.questions SET mc_options = '["x¹¹", "x²⁴", "1/x⁵"]'::jsonb
    WHERE bank_id = v_exp AND category = 'Properties of Exponents' AND point_value = 300;

    UPDATE public.questions SET mc_options = '["2x¹²", "8x¹²", "16x⁷"]'::jsonb
    WHERE bank_id = v_exp AND category = 'Properties of Exponents' AND point_value = 400;

    UPDATE public.questions SET mc_options = '["6x⁴y⁶", "9x⁴y⁵", "9x²y³"]'::jsonb
    WHERE bank_id = v_exp AND category = 'Properties of Exponents' AND point_value = 500;

    -- Scientific Notation
    UPDATE public.questions SET mc_options = '["5 × 10⁴", "50 × 10²", "0.5 × 10⁴"]'::jsonb
    WHERE bank_id = v_exp AND category = 'Scientific Notation' AND point_value = 100;

    UPDATE public.questions SET mc_options = '["320,000", "3,200", "0.00032"]'::jsonb
    WHERE bank_id = v_exp AND category = 'Scientific Notation' AND point_value = 200;

    UPDATE public.questions SET mc_options = '["4.5 × 10⁴", "45 × 10⁻⁵", "4.5 × 10⁻³"]'::jsonb
    WHERE bank_id = v_exp AND category = 'Scientific Notation' AND point_value = 300;

    UPDATE public.questions SET mc_options = '["6 × 10¹²", "5 × 10⁷", "6 × 10⁸"]'::jsonb
    WHERE bank_id = v_exp AND category = 'Scientific Notation' AND point_value = 400;

    UPDATE public.questions SET mc_options = '["4 × 10¹²", "4 × 10³", "16 × 10⁴"]'::jsonb
    WHERE bank_id = v_exp AND category = 'Scientific Notation' AND point_value = 500;

    -- Special Products
    UPDATE public.questions SET mc_options = '["a² + b²", "a² - 2ab + b²", "a² + ab + b²"]'::jsonb
    WHERE bank_id = v_exp AND category = 'Special Products' AND point_value = 100;

    UPDATE public.questions SET mc_options = '["x² + 25", "x² + 5x + 25", "x² - 10x + 25"]'::jsonb
    WHERE bank_id = v_exp AND category = 'Special Products' AND point_value = 200;

    UPDATE public.questions SET mc_options = '["x² - 9", "x² + 6x + 9", "x² - 3x + 9"]'::jsonb
    WHERE bank_id = v_exp AND category = 'Special Products' AND point_value = 300;

    UPDATE public.questions SET mc_options = '["a² + b²", "a² - 2ab - b²", "a² - 2ab + b²"]'::jsonb
    WHERE bank_id = v_exp AND category = 'Special Products' AND point_value = 400;

    UPDATE public.questions SET mc_options = '["4x² + 9", "4x² - 6x - 9", "2x² - 9"]'::jsonb
    WHERE bank_id = v_exp AND category = 'Special Products' AND point_value = 500;

  END IF;

  -- =========================================================
  -- BANK 2: Algebra I: Graphing & Linear Functions
  -- =========================================================

  IF v_grf IS NULL THEN
    RAISE NOTICE 'Algebra I: Graphing & Linear Functions not found -- skipping';
  ELSIF EXISTS (SELECT 1 FROM public.questions WHERE bank_id = v_grf AND mc_options IS NOT NULL) THEN
    RAISE NOTICE 'Graphing & Linear Functions mc_options already seeded -- skipping';
  ELSE

    -- Coordinate Plane & Graphing Points
    UPDATE public.questions SET mc_options = '["Quadrant I", "Quadrant II", "Quadrant III"]'::jsonb
    WHERE bank_id = v_grf AND category = 'Coordinate Plane & Graphing Points' AND point_value = 100;

    UPDATE public.questions SET mc_options = '["(1, 1)", "(1, 0)", "(0, 1)"]'::jsonb
    WHERE bank_id = v_grf AND category = 'Coordinate Plane & Graphing Points' AND point_value = 200;

    UPDATE public.questions SET mc_options = '["7", "4", "(-4, 7)"]'::jsonb
    WHERE bank_id = v_grf AND category = 'Coordinate Plane & Graphing Points' AND point_value = 300;

    UPDATE public.questions SET mc_options = '["11 units", "25 units", "√29 units"]'::jsonb
    WHERE bank_id = v_grf AND category = 'Coordinate Plane & Graphing Points' AND point_value = 400;

    UPDATE public.questions SET mc_options = '["(8, 14)", "(3, 5)", "(6, 6)"]'::jsonb
    WHERE bank_id = v_grf AND category = 'Coordinate Plane & Graphing Points' AND point_value = 500;

    -- Functions & Function Notation
    UPDATE public.questions SET mc_options = '["f multiplied by x", "The x-intercept of the function", "The slope of the function at point x"]'::jsonb
    WHERE bank_id = v_grf AND category = 'Functions & Function Notation' AND point_value = 100;

    UPDATE public.questions SET mc_options = '["8", "14", "10"]'::jsonb
    WHERE bank_id = v_grf AND category = 'Functions & Function Notation' AND point_value = 200;

    UPDATE public.questions SET mc_options = '["Yes, because all x-values are positive", "Yes, because the outputs 2, 3, and 4 are all different", "No, because there are only 3 ordered pairs"]'::jsonb
    WHERE bank_id = v_grf AND category = 'Functions & Function Notation' AND point_value = 300;

    UPDATE public.questions SET mc_options = '["-14", "14", "-4"]'::jsonb
    WHERE bank_id = v_grf AND category = 'Functions & Function Notation' AND point_value = 400;

    UPDATE public.questions SET mc_options = '["All real numbers except x = 0", "All real numbers", "All real numbers except x = -2"]'::jsonb
    WHERE bank_id = v_grf AND category = 'Functions & Function Notation' AND point_value = 500;

    -- Parallel & Perpendicular Lines
    UPDATE public.questions SET mc_options = '["They are negative reciprocals of each other", "Their product equals 1", "They are opposite in sign"]'::jsonb
    WHERE bank_id = v_grf AND category = 'Parallel & Perpendicular Lines' AND point_value = 100;

    UPDATE public.questions SET mc_options = '["They are equal", "Their sum equals 0", "Their product equals 1"]'::jsonb
    WHERE bank_id = v_grf AND category = 'Parallel & Perpendicular Lines' AND point_value = 200;

    UPDATE public.questions SET mc_options = '["2", "1/2", "-2"]'::jsonb
    WHERE bank_id = v_grf AND category = 'Parallel & Perpendicular Lines' AND point_value = 300;

    UPDATE public.questions SET mc_options = '["Perpendicular", "Neither", "They are the same line"]'::jsonb
    WHERE bank_id = v_grf AND category = 'Parallel & Perpendicular Lines' AND point_value = 400;

    UPDATE public.questions SET mc_options = '["y = 4x + 5", "y = -4x + 5", "y = -(1/4)x + 5"]'::jsonb
    WHERE bank_id = v_grf AND category = 'Parallel & Perpendicular Lines' AND point_value = 500;

    -- Slope
    UPDATE public.questions SET mc_options = '["m = (x₂ - x₁)/(y₂ - y₁)", "m = (y₂ + y₁)/(x₂ + x₁)", "m = (y₂ - y₁) × (x₂ - x₁)"]'::jsonb
    WHERE bank_id = v_grf AND category = 'Slope' AND point_value = 100;

    UPDATE public.questions SET mc_options = '["m = 1/2", "m = 4", "m = 8"]'::jsonb
    WHERE bank_id = v_grf AND category = 'Slope' AND point_value = 200;

    UPDATE public.questions SET mc_options = '["Undefined", "1", "∞"]'::jsonb
    WHERE bank_id = v_grf AND category = 'Slope' AND point_value = 300;

    UPDATE public.questions SET mc_options = '["1", "-4", "4"]'::jsonb
    WHERE bank_id = v_grf AND category = 'Slope' AND point_value = 400;

    UPDATE public.questions SET mc_options = '["0", "1", "∞"]'::jsonb
    WHERE bank_id = v_grf AND category = 'Slope' AND point_value = 500;

    -- Slope-Intercept Form
    UPDATE public.questions SET mc_options = '["Ax + By = C", "y - y₁ = m(x - x₁)", "y = ax² + bx + c"]'::jsonb
    WHERE bank_id = v_grf AND category = 'Slope-Intercept Form' AND point_value = 100;

    UPDATE public.questions SET mc_options = '["m = 5", "m = -3", "m = 1/3"]'::jsonb
    WHERE bank_id = v_grf AND category = 'Slope-Intercept Form' AND point_value = 200;

    UPDATE public.questions SET mc_options = '["-2", "-7", "2"]'::jsonb
    WHERE bank_id = v_grf AND category = 'Slope-Intercept Form' AND point_value = 300;

    UPDATE public.questions SET mc_options = '["y = -3x + 4", "y = 4x + 3", "y = -4x - 3"]'::jsonb
    WHERE bank_id = v_grf AND category = 'Slope-Intercept Form' AND point_value = 400;

    UPDATE public.questions SET mc_options = '["y = 2x + 8", "y = 2x - 8", "y = -2x - 8"]'::jsonb
    WHERE bank_id = v_grf AND category = 'Slope-Intercept Form' AND point_value = 500;

    -- Standard Form & Point-Slope Form
    UPDATE public.questions SET mc_options = '["y = mx + b", "y - y₁ = m(x - x₁)", "y = ax² + bx + c"]'::jsonb
    WHERE bank_id = v_grf AND category = 'Standard Form & Point-Slope Form' AND point_value = 100;

    UPDATE public.questions SET mc_options = '["y = mx + b", "Ax + By = C", "y + y₁ = m(x + x₁)"]'::jsonb
    WHERE bank_id = v_grf AND category = 'Standard Form & Point-Slope Form' AND point_value = 200;

    UPDATE public.questions SET mc_options = '["y - 5 = 3(x + 2)", "y + 5 = 3(x - 2)", "y - 2 = 3(x - 5)"]'::jsonb
    WHERE bank_id = v_grf AND category = 'Standard Form & Point-Slope Form' AND point_value = 300;

    UPDATE public.questions SET mc_options = '["2x + y = 6", "-2x + y = -6", "2x - y = 6"]'::jsonb
    WHERE bank_id = v_grf AND category = 'Standard Form & Point-Slope Form' AND point_value = 400;

    UPDATE public.questions SET mc_options = '["x = 3", "x = 12", "(0, 3)"]'::jsonb
    WHERE bank_id = v_grf AND category = 'Standard Form & Point-Slope Form' AND point_value = 500;

    -- Writing Linear Equations
    UPDATE public.questions SET mc_options = '["x = 5", "y = 5x", "y = x + 5"]'::jsonb
    WHERE bank_id = v_grf AND category = 'Writing Linear Equations' AND point_value = 100;

    UPDATE public.questions SET mc_options = '["y = -3", "x = 3", "y = -3x"]'::jsonb
    WHERE bank_id = v_grf AND category = 'Writing Linear Equations' AND point_value = 200;

    UPDATE public.questions SET mc_options = '["y = 4x + 2", "y = 2x", "y = 2x - 4"]'::jsonb
    WHERE bank_id = v_grf AND category = 'Writing Linear Equations' AND point_value = 300;

    UPDATE public.questions SET mc_options = '["y = 2x + 3", "y = 4x + 1", "y = 2x - 1"]'::jsonb
    WHERE bank_id = v_grf AND category = 'Writing Linear Equations' AND point_value = 400;

    UPDATE public.questions SET mc_options = '["y = 3x + 4", "y = 3x - 1", "y = -(1/3)x - 1"]'::jsonb
    WHERE bank_id = v_grf AND category = 'Writing Linear Equations' AND point_value = 500;

  END IF;

  -- =========================================================
  -- BANK 3: Algebra I: Linear Equations & Inequalities
  -- =========================================================

  IF v_lin IS NULL THEN
    RAISE NOTICE 'Algebra I: Linear Equations & Inequalities not found -- skipping';
  ELSIF EXISTS (SELECT 1 FROM public.questions WHERE bank_id = v_lin AND mc_options IS NOT NULL) THEN
    RAISE NOTICE 'Linear Equations & Inequalities mc_options already seeded -- skipping';
  ELSE

    -- Absolute Value Equations & Inequalities
    UPDATE public.questions SET mc_options = '["x = 7", "x = ±49", "No solution"]'::jsonb
    WHERE bank_id = v_lin AND category = 'Absolute Value Equations & Inequalities' AND point_value = 100;

    UPDATE public.questions SET mc_options = '["x = 2 or x = -2", "x = 8 or x = -2", "x = 2"]'::jsonb
    WHERE bank_id = v_lin AND category = 'Absolute Value Equations & Inequalities' AND point_value = 200;

    UPDATE public.questions SET mc_options = '["x = 5 or x = 4", "x = 4 or x = -5", "x = 10 or x = -8"]'::jsonb
    WHERE bank_id = v_lin AND category = 'Absolute Value Equations & Inequalities' AND point_value = 300;

    UPDATE public.questions SET mc_options = '["x < 4", "x < -4 or x > 4", "-4 ≤ x ≤ 4"]'::jsonb
    WHERE bank_id = v_lin AND category = 'Absolute Value Equations & Inequalities' AND point_value = 400;

    UPDATE public.questions SET mc_options = '["-3 < x < 7", "x < -7 or x > 3", "x ≤ -3 or x ≥ 7"]'::jsonb
    WHERE bank_id = v_lin AND category = 'Absolute Value Equations & Inequalities' AND point_value = 500;

    -- Compound Inequalities
    UPDATE public.questions SET mc_options = '["[-2, 5]", "(-2, 5]", "(-5, 2)"]'::jsonb
    WHERE bank_id = v_lin AND category = 'Compound Inequalities' AND point_value = 100;

    UPDATE public.questions SET mc_options = '["x < 3 or x > 8", "x > 3 or x < 8", "x < 3 and x < 8"]'::jsonb
    WHERE bank_id = v_lin AND category = 'Compound Inequalities' AND point_value = 200;

    UPDATE public.questions SET mc_options = '["-2 < x < 8", "-1 < x < 8", "1/2 < x < 4"]'::jsonb
    WHERE bank_id = v_lin AND category = 'Compound Inequalities' AND point_value = 300;

    UPDATE public.questions SET mc_options = '["-2 < x < 5", "-5 < x < 2", "x < 2 or x > -5"]'::jsonb
    WHERE bank_id = v_lin AND category = 'Compound Inequalities' AND point_value = 400;

    UPDATE public.questions SET mc_options = '["4 ≤ x < 16", "-10 ≤ x < 2", "1 ≤ x < 16"]'::jsonb
    WHERE bank_id = v_lin AND category = 'Compound Inequalities' AND point_value = 500;

    -- Literal Equations
    UPDATE public.questions SET mc_options = '["w = P - 2l", "w = P/2 - 2l", "w = (P + 2l)/2"]'::jsonb
    WHERE bank_id = v_lin AND category = 'Literal Equations' AND point_value = 100;

    UPDATE public.questions SET mc_options = '["h = Ab", "h = b/A", "h = A - b"]'::jsonb
    WHERE bank_id = v_lin AND category = 'Literal Equations' AND point_value = 200;

    UPDATE public.questions SET mc_options = '["y = 3x - 12", "y = 12 + 3x", "y = -3x - 12"]'::jsonb
    WHERE bank_id = v_lin AND category = 'Literal Equations' AND point_value = 300;

    UPDATE public.questions SET mc_options = '["r = 2πC", "r = C/2", "r = C - 2π"]'::jsonb
    WHERE bank_id = v_lin AND category = 'Literal Equations' AND point_value = 400;

    UPDATE public.questions SET mc_options = '["x = (c + b)/a", "x = c/a - b", "x = a(c - b)"]'::jsonb
    WHERE bank_id = v_lin AND category = 'Literal Equations' AND point_value = 500;

    -- Multi-Step Equations
    UPDATE public.questions SET mc_options = '["x = 10", "x = 20", "x = 5"]'::jsonb
    WHERE bank_id = v_lin AND category = 'Multi-Step Equations' AND point_value = 100;

    UPDATE public.questions SET mc_options = '["x = 5", "x = 4.5", "x = 7"]'::jsonb
    WHERE bank_id = v_lin AND category = 'Multi-Step Equations' AND point_value = 200;

    UPDATE public.questions SET mc_options = '["x = 2", "x = 3", "x = 10"]'::jsonb
    WHERE bank_id = v_lin AND category = 'Multi-Step Equations' AND point_value = 300;

    UPDATE public.questions SET mc_options = '["x = 1/3", "x = 14/3", "x = 7/3"]'::jsonb
    WHERE bank_id = v_lin AND category = 'Multi-Step Equations' AND point_value = 400;

    UPDATE public.questions SET mc_options = '["x = 2.1", "x = 25/7", "x = -21/5"]'::jsonb
    WHERE bank_id = v_lin AND category = 'Multi-Step Equations' AND point_value = 500;

    -- One-Step & Two-Step Equations
    UPDATE public.questions SET mc_options = '["x = -4", "x = 8", "x = 4"]'::jsonb
    WHERE bank_id = v_lin AND category = 'One-Step & Two-Step Equations' AND point_value = 100;

    UPDATE public.questions SET mc_options = '["x = 7", "x = -175", "x = -5"]'::jsonb
    WHERE bank_id = v_lin AND category = 'One-Step & Two-Step Equations' AND point_value = 200;

    UPDATE public.questions SET mc_options = '["x = 9/4", "x = 13", "x = 5"]'::jsonb
    WHERE bank_id = v_lin AND category = 'One-Step & Two-Step Equations' AND point_value = 300;

    UPDATE public.questions SET mc_options = '["x = 28/3", "x = 35/3", "x = 21"]'::jsonb
    WHERE bank_id = v_lin AND category = 'One-Step & Two-Step Equations' AND point_value = 400;

    UPDATE public.questions SET mc_options = '["x = 9", "x = -4", "x = 4"]'::jsonb
    WHERE bank_id = v_lin AND category = 'One-Step & Two-Step Equations' AND point_value = 500;

    -- One-Variable Inequalities
    UPDATE public.questions SET mc_options = '["x > 17", "x < 7", "x > 2.4"]'::jsonb
    WHERE bank_id = v_lin AND category = 'One-Variable Inequalities' AND point_value = 100;

    UPDATE public.questions SET mc_options = '["x ≤ 54", "x ≤ 15", "x ≥ 6"]'::jsonb
    WHERE bank_id = v_lin AND category = 'One-Variable Inequalities' AND point_value = 200;

    UPDATE public.questions SET mc_options = '["x < 1", "x < 4.5", "x > 8"]'::jsonb
    WHERE bank_id = v_lin AND category = 'One-Variable Inequalities' AND point_value = 300;

    UPDATE public.questions SET mc_options = '["x > -5", "x < 5", "x > 5"]'::jsonb
    WHERE bank_id = v_lin AND category = 'One-Variable Inequalities' AND point_value = 400;

    UPDATE public.questions SET mc_options = '["x ≥ 5", "x ≥ -2", "x ≤ -5"]'::jsonb
    WHERE bank_id = v_lin AND category = 'One-Variable Inequalities' AND point_value = 500;

    -- Variables on Both Sides
    UPDATE public.questions SET mc_options = '["x = 10", "x = 5/4", "x = 2"]'::jsonb
    WHERE bank_id = v_lin AND category = 'Variables on Both Sides' AND point_value = 100;

    UPDATE public.questions SET mc_options = '["x = 2", "x = 3", "x = 16"]'::jsonb
    WHERE bank_id = v_lin AND category = 'Variables on Both Sides' AND point_value = 200;

    UPDATE public.questions SET mc_options = '["x = -1", "x = -5", "x = 3/7"]'::jsonb
    WHERE bank_id = v_lin AND category = 'Variables on Both Sides' AND point_value = 300;

    UPDATE public.questions SET mc_options = '["x = 9", "x = 17", "x = 17/5"]'::jsonb
    WHERE bank_id = v_lin AND category = 'Variables on Both Sides' AND point_value = 400;

    UPDATE public.questions SET mc_options = '["x = 2/5", "x = -2", "x = 10"]'::jsonb
    WHERE bank_id = v_lin AND category = 'Variables on Both Sides' AND point_value = 500;

  END IF;

END $$;

-- =========================================================
-- Verify: no questions with NULL mc_options remain in any
-- of the three banks (for whichever banks exist)
-- =========================================================
DO $$
DECLARE
  v_bank  RECORD;
  v_nulls INTEGER;
BEGIN
  FOR v_bank IN
    SELECT id, title
    FROM public.question_banks
    WHERE title IN (
      'Algebra I: Exponents & Polynomials',
      'Algebra I: Graphing & Linear Functions',
      'Algebra I: Linear Equations & Inequalities'
    ) AND is_public = true
  LOOP
    SELECT COUNT(*) INTO v_nulls
    FROM public.questions
    WHERE bank_id = v_bank.id AND mc_options IS NULL;

    IF v_nulls > 0 THEN
      RAISE EXCEPTION 'mc_options incomplete for "%": % questions still NULL', v_bank.title, v_nulls;
    ELSE
      RAISE NOTICE 'OK: "%" -- all questions have mc_options', v_bank.title;
    END IF;
  END LOOP;
END $$;
