-- Migration: mc_options for "Scientific Method & Lab Skills" bank
-- Purpose: Seeds 3 wrong-answer options for all 35 questions so this bank
--          can be used in Quick Fire (pub_trivia) mode.
-- Depends on: 20260426_questions_mc_options.sql (mc_options column)
-- Date: 2026-05-21

DO $$
DECLARE
  v_bank_id UUID;
BEGIN

  SELECT id INTO v_bank_id
  FROM public.question_banks
  WHERE title = 'Scientific Method & Lab Skills'
    AND is_public = true;

  IF v_bank_id IS NULL THEN
    RAISE EXCEPTION 'Scientific Method & Lab Skills bank not found';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.questions
    WHERE bank_id = v_bank_id
      AND mc_options IS NOT NULL
  ) THEN
    RAISE NOTICE 'Scientific Method & Lab Skills mc_options already seeded -- skipping';
    RETURN;
  END IF;

  -- ── Data Collection & Measurement ────────────────────────────────────────

  -- 100: correct = "Qualitative and quantitative"
  UPDATE public.questions SET mc_options = '["Primary and secondary", "Objective and subjective", "Discrete and continuous"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Data Collection & Measurement' AND point_value = 100;

  -- 200: correct = "Meter"
  UPDATE public.questions SET mc_options = '["Gram", "Liter", "Kelvin"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Data Collection & Measurement' AND point_value = 200;

  -- 300: correct = "To increase reliability and reduce the impact of random errors"
  UPDATE public.questions SET mc_options = '["To save time and reduce the number of experiments needed", "To make the experiment more difficult to replicate by other scientists", "To ensure the independent variable causes different results each time"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Data Collection & Measurement' AND point_value = 300;

  -- 400: correct = "Accuracy is how close to the true value; precision is how close repeated measurements are to each other"
  UPDATE public.questions SET mc_options = '["Accuracy means repeated measurements agree; precision means the measurement is correct", "Accuracy and precision mean the same thing in scientific measurement", "Precision refers to how close to the true value; accuracy refers to consistency"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Data Collection & Measurement' AND point_value = 400;

  -- 500: correct = "1000 milliliters"
  UPDATE public.questions SET mc_options = '["100 milliliters", "10000 milliliters", "500 milliliters"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Data Collection & Measurement' AND point_value = 500;

  -- ── Graphing & Data Analysis ─────────────────────────────────────────────

  -- 100: correct = "X-axis"
  UPDATE public.questions SET mc_options = '["Y-axis", "Z-axis", "Origin"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Graphing & Data Analysis' AND point_value = 100;

  -- 200: correct = "Pie chart"
  UPDATE public.questions SET mc_options = '["Bar graph", "Line graph", "Scatter plot"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Graphing & Data Analysis' AND point_value = 200;

  -- 300: correct = "A line drawn through data points that shows the general trend"
  UPDATE public.questions SET mc_options = '["A line that connects every data point precisely on the graph", "A line that shows the maximum and minimum values only", "A dotted line marking where the independent variable equals zero"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Graphing & Data Analysis' AND point_value = 300;

  -- 400: correct = "20"
  UPDATE public.questions SET mc_options = '["15", "25", "18"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Graphing & Data Analysis' AND point_value = 400;

  -- 500: correct = "As one variable increases, the other also increases"
  UPDATE public.questions SET mc_options = '["As one variable increases, the other decreases", "The two variables have no relationship to each other", "One variable causes the other to change in a random pattern"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Graphing & Data Analysis' AND point_value = 500;

  -- ── Lab Safety & Equipment ───────────────────────────────────────────────

  -- 100: correct = "Safety goggles"
  UPDATE public.questions SET mc_options = '["Lab gloves", "Lab apron", "Face shield"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Lab Safety & Equipment' AND point_value = 100;

  -- 200: correct = "Waft the fumes toward your nose"
  UPDATE public.questions SET mc_options = '["Smell directly from the container", "Hold the container near your mouth to test odor", "Ask a classmate to smell it first"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Lab Safety & Equipment' AND point_value = 200;

  -- 300: correct = "Graduated cylinder"
  UPDATE public.questions SET mc_options = '["Beaker", "Erlenmeyer flask", "Test tube"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Lab Safety & Equipment' AND point_value = 300;

  -- 400: correct = "Compound microscope views thin specimens at high magnification; dissecting microscope views thick specimens at lower magnification"
  UPDATE public.questions SET mc_options = '["Dissecting microscope has higher magnification; compound microscope is used only for living specimens", "Both microscopes function identically but are used in different labs", "Compound microscope views living specimens; dissecting microscope views only preserved specimens"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Lab Safety & Equipment' AND point_value = 400;

  -- 500: correct = "Rinse with water immediately at the safety shower or sink"
  UPDATE public.questions SET mc_options = '["Apply a neutralizing chemical to the affected area immediately", "Wipe the chemical off with a dry paper towel before rinsing", "Wait for the teacher to assess the spill before taking any action"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Lab Safety & Equipment' AND point_value = 500;

  -- ── Observations & Inferences ────────────────────────────────────────────

  -- 100: correct = "An observation is what you directly detect with senses; an inference is a logical conclusion based on observations"
  UPDATE public.questions SET mc_options = '["An observation is a guess about what might happen; an inference is what actually occurs in an experiment", "An observation and an inference mean the same thing in science", "An inference is what you detect with your senses; an observation is a conclusion"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Observations & Inferences' AND point_value = 100;

  -- 200: correct = "The plant is 15 cm tall"
  UPDATE public.questions SET mc_options = '["The plant grew because it received water", "Both are observations", "Neither is an observation"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Observations & Inferences' AND point_value = 200;

  -- 300: correct = "A representation of something in nature; useful for understanding complex systems or making predictions"
  UPDATE public.questions SET mc_options = '["A perfect replica of a natural system with exact measurements and components", "A mathematical equation that precisely describes all aspects of a phenomenon", "A physical object built to replace real experiments in the laboratory"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Observations & Inferences' AND point_value = 300;

  -- 400: correct = "Correlation means two things are related; causation means one thing causes the other"
  UPDATE public.questions SET mc_options = '["Correlation and causation mean the same thing in scientific research", "Causation means two variables are related; correlation means one variable causes another", "Correlation proves a cause-and-effect relationship between two variables"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Observations & Inferences' AND point_value = 400;

  -- 500: correct = "Bias can lead to inaccurate results or misinterpretation of data"
  UPDATE public.questions SET mc_options = '["Bias makes experiments more efficient by focusing on expected outcomes", "Scientific bias is acceptable if the researcher discloses it in the report", "Avoiding bias is optional when the researcher has prior expertise in the field"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Observations & Inferences' AND point_value = 500;

  -- ── Scientific Communication ─────────────────────────────────────────────

  -- 100: correct = "Title, hypothesis, materials, procedure, data/results, and conclusion"
  UPDATE public.questions SET mc_options = '["Introduction, methods, results, and discussion only", "Abstract, background, experiment, and bibliography", "Thesis, evidence, analysis, and reflection"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Scientific Communication' AND point_value = 100;

  -- 200: correct = "To give credit to the original authors of information you used"
  UPDATE public.questions SET mc_options = '["To make your paper appear longer and more professional", "To show that you have read at least three sources for your report", "To prove that your experiment was not performed by someone else"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Scientific Communication' AND point_value = 200;

  -- 300: correct = "Yes"
  UPDATE public.questions SET mc_options = '["No, the conclusion should introduce new information only", "Only if the hypothesis was supported by data", "Only if the hypothesis was not supported by data"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Scientific Communication' AND point_value = 300;

  -- 400: correct = "When other scientists evaluate research before publication; ensures quality and validity"
  UPDATE public.questions SET mc_options = '["When a teacher grades a student''s lab report before it is submitted", "When a company reviews research to determine if it is profitable", "When scientists summarize previously published work for a new audience"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Scientific Communication' AND point_value = 400;

  -- 500: correct = "Analyze what happened, consider sources of error, and report honestly"
  UPDATE public.questions SET mc_options = '["Discard the data and repeat the experiment until results support the hypothesis", "Change the hypothesis to match whatever results were obtained", "Report only the trials that came closest to supporting the hypothesis"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Scientific Communication' AND point_value = 500;

  -- ── Scientific Method & Experimental Design ──────────────────────────────

  -- 100: correct = "Make an observation or ask a question"
  UPDATE public.questions SET mc_options = '["Form a hypothesis", "Conduct an experiment", "Draw a conclusion"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Scientific Method & Experimental Design' AND point_value = 100;

  -- 200: correct = "Hypothesis"
  UPDATE public.questions SET mc_options = '["Theory", "Law", "Inference"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Scientific Method & Experimental Design' AND point_value = 200;

  -- 300: correct = "A hypothesis is a testable prediction; a theory is a well-supported explanation based on extensive evidence"
  UPDATE public.questions SET mc_options = '["A hypothesis is proven fact; a theory is an unproven guess", "A theory is a testable prediction; a hypothesis is a well-supported explanation", "Hypothesis and theory mean the same thing in everyday and scientific usage"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Scientific Method & Experimental Design' AND point_value = 300;

  -- 400: correct = "A law describes what happens; a theory explains why it happens"
  UPDATE public.questions SET mc_options = '["A law is less certain than a theory because laws can be overturned", "A theory becomes a law once it is proven with enough experiments", "Both laws and theories explain why natural phenomena occur"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Scientific Method & Experimental Design' AND point_value = 400;

  -- 500: correct = "To verify results and ensure reliability"
  UPDATE public.questions SET mc_options = '["To allow scientists to get credit for repeating someone else''s work", "To make science more time-consuming and expensive", "Reproducibility is not required if the original experiment was carefully done"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Scientific Method & Experimental Design' AND point_value = 500;

  -- ── Variables & Controls ─────────────────────────────────────────────────

  -- 100: correct = "Independent variable"
  UPDATE public.questions SET mc_options = '["Dependent variable", "Control variable", "Constant"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Variables & Controls' AND point_value = 100;

  -- 200: correct = "Dependent variable"
  UPDATE public.questions SET mc_options = '["Independent variable", "Control variable", "Constant"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Variables & Controls' AND point_value = 200;

  -- 300: correct = "To provide a baseline for comparison"
  UPDATE public.questions SET mc_options = '["To test multiple independent variables at once", "To prove that the hypothesis is correct before the experiment begins", "To measure the dependent variable without any interference"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Variables & Controls' AND point_value = 300;

  -- 400: correct = "Variables kept the same for all groups; they ensure a fair test"
  UPDATE public.questions SET mc_options = '["Variables that are changed in each experimental group to test different outcomes", "The results that are expected based on the hypothesis before testing begins", "Independent variables that have already been tested in previous experiments"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Variables & Controls' AND point_value = 400;

  -- 500: correct = "Independent: amount/type of fertilizer; Dependent: plant growth/height"
  UPDATE public.questions SET mc_options = '["Independent: plant growth/height; Dependent: amount/type of fertilizer", "Independent: sunlight; Dependent: amount of fertilizer", "Independent: plant growth; Dependent: soil type"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Variables & Controls' AND point_value = 500;

END $$;

-- Verify all 35 questions now have mc_options
DO $$
DECLARE
  v_nulls INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_nulls
  FROM public.questions q
  JOIN public.question_banks b ON q.bank_id = b.id
  WHERE b.title = 'Scientific Method & Lab Skills'
    AND q.mc_options IS NULL;

  IF v_nulls > 0 THEN
    RAISE EXCEPTION 'mc_options seed incomplete: % questions still NULL in Scientific Method & Lab Skills', v_nulls;
  END IF;

  RAISE NOTICE 'OK: all questions in Scientific Method & Lab Skills now have mc_options';
END $$;
