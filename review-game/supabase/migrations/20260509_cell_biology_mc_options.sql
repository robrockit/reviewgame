-- Migration: mc_options for "Cell Biology Basics" bank
-- Purpose: Seeds 3 wrong-answer options for all 35 questions so this bank
--          can be used in Quick Fire (pub_trivia) mode.
-- Depends on: 20260426_questions_mc_options.sql (mc_options column)
-- Date: 2026-05-09

DO $$
DECLARE
  v_bank_id UUID;
BEGIN

  SELECT id INTO v_bank_id
  FROM public.question_banks
  WHERE title = 'Cell Biology Basics'
    AND is_public = true;

  IF v_bank_id IS NULL THEN
    RAISE EXCEPTION 'Cell Biology Basics bank not found';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.questions
    WHERE bank_id = v_bank_id
      AND mc_options IS NOT NULL
  ) THEN
    RAISE NOTICE 'Cell Biology Basics mc_options already seeded -- skipping';
    RETURN;
  END IF;

  -- ── Cell Division ────────────────────────────────────────────────────────

  -- 100: correct = "Mitosis"
  UPDATE public.questions SET mc_options = '["Meiosis", "Binary fission", "Cytokinesis"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Cell Division' AND point_value = 100;

  -- 200: correct = "Anaphase"
  UPDATE public.questions SET mc_options = '["Metaphase", "Telophase", "Prophase"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Cell Division' AND point_value = 200;

  -- 300: correct = "Meiosis"
  UPDATE public.questions SET mc_options = '["Mitosis", "Cytokinesis", "Binary fission"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Cell Division' AND point_value = 300;

  -- 400: correct = "It helps separate chromosomes during mitosis and meiosis"
  UPDATE public.questions SET mc_options = '["It copies DNA before cell division begins", "It forms the nuclear envelope during telophase", "It breaks down the cell membrane for cytokinesis"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Cell Division' AND point_value = 400;

  -- 500: correct = "In animal cells, the cytoplasm pinches in; in plant cells, a cell plate forms"
  UPDATE public.questions SET mc_options = '["In animal cells, a cell plate forms; in plant cells, the cytoplasm pinches in", "Both animal and plant cells use a cleavage furrow to divide", "Both animal and plant cells form a cell plate between daughter cells"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Cell Division' AND point_value = 500;

  -- ── Cell Structure ───────────────────────────────────────────────────────

  -- 100: correct = "The cell"
  UPDATE public.questions SET mc_options = '["The nucleus", "The atom", "The organelle"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Cell Structure' AND point_value = 100;

  -- 200: correct = "Mitochondria"
  UPDATE public.questions SET mc_options = '["Chloroplast", "Ribosome", "Nucleus"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Cell Structure' AND point_value = 200;

  -- 300: correct = "Nucleus"
  UPDATE public.questions SET mc_options = '["Mitochondria", "Golgi apparatus", "Endoplasmic reticulum"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Cell Structure' AND point_value = 300;

  -- 400: correct = "Cell membrane"
  UPDATE public.questions SET mc_options = '["Cell wall", "Nuclear envelope", "Vacuole"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Cell Structure' AND point_value = 400;

  -- 500: correct = "It synthesizes proteins and transports them to the Golgi apparatus"
  UPDATE public.questions SET mc_options = '["It synthesizes lipids and transports them to the cell membrane", "It breaks down damaged proteins and recycles amino acids", "It stores proteins until they are needed by the cell"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Cell Structure' AND point_value = 500;

  -- ── Cell Transport ───────────────────────────────────────────────────────

  -- 100: correct = "Diffusion"
  UPDATE public.questions SET mc_options = '["Osmosis", "Active transport", "Facilitated diffusion"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Cell Transport' AND point_value = 100;

  -- 200: correct = "Osmosis"
  UPDATE public.questions SET mc_options = '["Diffusion", "Active transport", "Endocytosis"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Cell Transport' AND point_value = 200;

  -- 300: correct = "Endocytosis or exocytosis"
  UPDATE public.questions SET mc_options = '["Osmosis", "Facilitated diffusion", "The sodium-potassium pump"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Cell Transport' AND point_value = 300;

  -- 400: correct = "Maintains membrane potential by pumping 3 Na+ out and 2 K+ in using ATP"
  UPDATE public.questions SET mc_options = '["Pumps glucose into the cell using ATP energy", "Pumps 2 Na+ out and 3 K+ in to maintain resting potential", "Allows Na+ and K+ to diffuse freely along their gradients"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Cell Transport' AND point_value = 400;

  -- 500: correct = "Passive does not require energy and moves with the gradient; active requires energy and moves against the gradient"
  UPDATE public.questions SET mc_options = '["Passive requires energy and moves against the gradient; active moves with the gradient without energy", "Both passive and active transport require ATP and move molecules against the gradient", "Passive transport uses vesicles; active transport uses protein channels"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Cell Transport' AND point_value = 500;

  -- ── Cellular Respiration ─────────────────────────────────────────────────

  -- 100: correct = "ATP"
  UPDATE public.questions SET mc_options = '["ADP", "NADH", "Glucose"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Cellular Respiration' AND point_value = 100;

  -- 200: correct = "Cytoplasm"
  UPDATE public.questions SET mc_options = '["Mitochondria", "Nucleus", "Endoplasmic reticulum"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Cellular Respiration' AND point_value = 200;

  -- 300: correct = "Mitochondria"
  UPDATE public.questions SET mc_options = '["Cytoplasm", "Nucleus", "Chloroplast"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Cellular Respiration' AND point_value = 300;

  -- 400: correct = "It transfers electrons and pumps protons to generate a proton gradient for ATP synthase"
  UPDATE public.questions SET mc_options = '["It breaks down glucose directly into ATP molecules", "It converts pyruvate into acetyl-CoA for the Krebs cycle", "It uses CO2 to build glucose in the inner mitochondrial membrane"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Cellular Respiration' AND point_value = 400;

  -- 500: correct = "Aerobic uses oxygen to produce more ATP; anaerobic produces less ATP without oxygen"
  UPDATE public.questions SET mc_options = '["Aerobic occurs without oxygen; anaerobic requires oxygen and produces more ATP", "Both aerobic and anaerobic require oxygen but differ in ATP yield", "Anaerobic produces more ATP than aerobic because it uses fermentation"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Cellular Respiration' AND point_value = 500;

  -- ── DNA & Genetics ───────────────────────────────────────────────────────

  -- 100: correct = "DNA"
  UPDATE public.questions SET mc_options = '["RNA", "Protein", "ATP"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'DNA & Genetics' AND point_value = 100;

  -- 200: correct = "Transcription"
  UPDATE public.questions SET mc_options = '["Translation", "Replication", "Transduction"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'DNA & Genetics' AND point_value = 200;

  -- 300: correct = "UACG"
  UPDATE public.questions SET mc_options = '["TACG", "AUGC", "ATCG"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'DNA & Genetics' AND point_value = 300;

  -- 400: correct = "A change in the nucleotide sequence of DNA"
  UPDATE public.questions SET mc_options = '["A change in the amino acid sequence of a protein", "A deletion of an entire chromosome during meiosis", "An error in RNA splicing during transcription"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'DNA & Genetics' AND point_value = 400;

  -- 500: correct = "Mitosis produces identical cells; meiosis produces gametes with half the chromosome number"
  UPDATE public.questions SET mc_options = '["Meiosis produces identical cells; mitosis produces gametes with half the chromosome number", "Both mitosis and meiosis produce identical daughter cells with the same chromosome number", "Mitosis produces four genetically diverse cells; meiosis produces two identical cells"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'DNA & Genetics' AND point_value = 500;

  -- ── Photosynthesis ───────────────────────────────────────────────────────

  -- 100: correct = "Chloroplast"
  UPDATE public.questions SET mc_options = '["Mitochondria", "Nucleus", "Vacuole"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Photosynthesis' AND point_value = 100;

  -- 200: correct = "Glucose and oxygen"
  UPDATE public.questions SET mc_options = '["Carbon dioxide and water", "ATP and NADPH", "Starch and carbon dioxide"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Photosynthesis' AND point_value = 200;

  -- 300: correct = "6CO2 + 6H2O → C6H12O6 + 6O2"
  UPDATE public.questions SET mc_options = '["C6H12O6 + 6O2 → 6CO2 + 6H2O", "6CO2 + 6O2 → C6H12O6 + 6H2O", "6H2O + 6O2 → C6H12O6 + 6CO2"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Photosynthesis' AND point_value = 300;

  -- 400: correct = "Chlorophyll absorbs light energy for the light-dependent reactions"
  UPDATE public.questions SET mc_options = '["Chlorophyll reflects all wavelengths of visible light equally", "Chlorophyll directly synthesizes glucose from carbon dioxide", "Chlorophyll releases oxygen as a byproduct of light absorption"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Photosynthesis' AND point_value = 400;

  -- 500: correct = "Light-dependent reactions produce ATP/NADPH; Calvin cycle uses them to make glucose"
  UPDATE public.questions SET mc_options = '["Calvin cycle produces ATP and NADPH; light-dependent reactions use them to fix carbon", "Both stages occur in the stroma and both directly produce glucose", "Light-dependent reactions occur in the stroma; Calvin cycle occurs in the thylakoid"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Photosynthesis' AND point_value = 500;

  -- ── Proteins ─────────────────────────────────────────────────────────────

  -- 100: correct = "Amino acids"
  UPDATE public.questions SET mc_options = '["Nucleotides", "Fatty acids", "Monosaccharides"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Proteins' AND point_value = 100;

  -- 200: correct = "Peptide bond"
  UPDATE public.questions SET mc_options = '["Hydrogen bond", "Phosphodiester bond", "Glycosidic bond"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Proteins' AND point_value = 200;

  -- 300: correct = "Primary = sequence; secondary = alpha/beta structures; tertiary = 3D folding; quaternary = multiple polypeptides"
  UPDATE public.questions SET mc_options = '["Primary = 3D folding; secondary = sequence; tertiary = alpha/beta structures; quaternary = two polypeptides", "Primary = amino acid count; secondary = 3D shape; tertiary = two polypeptide chains; quaternary = disulfide bonds", "Primary = single amino acid; secondary = two amino acids; tertiary = a chain; quaternary = a protein"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Proteins' AND point_value = 300;

  -- 400: correct = "Enzymes catalyze biochemical reactions"
  UPDATE public.questions SET mc_options = '["Enzymes carry oxygen through the bloodstream", "Enzymes store energy for cellular processes", "Enzymes form the structural backbone of cell membranes"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Proteins' AND point_value = 400;

  -- 500: correct = "Misfolded proteins can aggregate, causing diseases like Alzheimer's or prion disorders"
  UPDATE public.questions SET mc_options = '["Misfolded proteins are immediately broken down and cannot cause disease", "Misfolded proteins are exported from the cell before they can cause harm", "Misfolded proteins always activate the immune system to repair the damage"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Proteins' AND point_value = 500;

END $$;

-- Verify all 35 questions now have mc_options
DO $$
DECLARE
  v_nulls INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_nulls
  FROM public.questions q
  JOIN public.question_banks b ON q.bank_id = b.id
  WHERE b.title = 'Cell Biology Basics'
    AND q.mc_options IS NULL;

  IF v_nulls > 0 THEN
    RAISE EXCEPTION 'mc_options seed incomplete: % questions still NULL in Cell Biology Basics', v_nulls;
  END IF;

  RAISE NOTICE 'OK: all questions in Cell Biology Basics now have mc_options';
END $$;
