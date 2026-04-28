-- Migration: mc_options for "Biochemistry & Protein Synthesis" bank
-- Purpose: Seeds 3 wrong-answer options for all 35 questions so this bank
--          can be used in Quick Fire (pub_trivia) mode.
-- Depends on: 20260426_questions_mc_options.sql (mc_options column)
-- Date: 2026-05-08

DO $$
DECLARE
  v_bank_id UUID;
BEGIN

  SELECT id INTO v_bank_id
  FROM public.question_banks
  WHERE title = 'Biochemistry & Protein Synthesis'
    AND is_public = true;

  IF v_bank_id IS NULL THEN
    RAISE EXCEPTION 'Biochemistry & Protein Synthesis bank not found';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.questions
    WHERE bank_id = v_bank_id
      AND mc_options IS NOT NULL
  ) THEN
    RAISE NOTICE 'Biochemistry & Protein Synthesis mc_options already seeded -- skipping';
    RETURN;
  END IF;

  -- ── Carbohydrates ────────────────────────────────────────────────────────

  -- 100: correct = "Provide energy"
  UPDATE public.questions SET mc_options = '["Provide structural support", "Carry genetic information", "Regulate hormone production"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Carbohydrates' AND point_value = 100;

  -- 200: correct = "Monosaccharide"
  UPDATE public.questions SET mc_options = '["Polysaccharide", "Disaccharide", "Amino acid"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Carbohydrates' AND point_value = 200;

  -- 300: correct = "Glucose, fructose, and galactose"
  UPDATE public.questions SET mc_options = '["Starch, sucrose, and lactose", "Glycogen, cellulose, and starch", "Sucrose, maltose, and lactose"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Carbohydrates' AND point_value = 300;

  -- 400: correct = "Glycogen, stored in liver and muscles"
  UPDATE public.questions SET mc_options = '["Starch, stored in fat tissue", "Cellulose, stored in cell walls", "Glucose, stored in the bloodstream"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Carbohydrates' AND point_value = 400;

  -- 500: correct = "Cellulose; humans lack the enzyme cellulase"
  UPDATE public.questions SET mc_options = '["Starch; humans lack the enzyme amylase to break it down", "Glycogen; humans cannot convert plant glycogen to glucose", "Chitin; humans lack the enzyme chitinase to digest it"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Carbohydrates' AND point_value = 500;

  -- ── Enzymes & Catalysis ──────────────────────────────────────────────────

  -- 100: correct = "Enzymes"
  UPDATE public.questions SET mc_options = '["Hormones", "Cofactors", "Substrates"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Enzymes & Catalysis' AND point_value = 100;

  -- 200: correct = "Substrate"
  UPDATE public.questions SET mc_options = '["Product", "Cofactor", "Inhibitor"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Enzymes & Catalysis' AND point_value = 200;

  -- 300: correct = "Active site"
  UPDATE public.questions SET mc_options = '["Allosteric site", "Binding domain", "Catalytic core"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Enzymes & Catalysis' AND point_value = 300;

  -- 400: correct = "They stabilize the transition state or bind to substrates to strain bonds"
  UPDATE public.questions SET mc_options = '["They increase the activation energy needed for reactions", "They add heat energy to the reaction mixture", "They replace the substrate with a more reactive molecule"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Enzymes & Catalysis' AND point_value = 400;

  -- 500: correct = "Temperature, pH, and substrate concentration"
  UPDATE public.questions SET mc_options = '["Light intensity, water availability, and temperature", "Oxygen level, salinity, and pressure only", "Membrane potential, lipid concentration, and ions"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Enzymes & Catalysis' AND point_value = 500;

  -- ── Lipids ───────────────────────────────────────────────────────────────

  -- 100: correct = "Nonpolar; they are hydrophobic"
  UPDATE public.questions SET mc_options = '["Polar; they dissolve easily in water", "Ionic; they form charged bonds in water", "Amphipathic; they are fully soluble in water"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Lipids' AND point_value = 100;

  -- 200: correct = "Energy storage, cell membranes, and signaling/hormones"
  UPDATE public.questions SET mc_options = '["Enzymatic reactions, structural support, and DNA replication", "Oxygen transport, immune defense, and genetic storage", "Protein synthesis, energy storage, and cell signaling only"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Lipids' AND point_value = 200;

  -- 300: correct = "Phospholipid; has a hydrophilic head and two hydrophobic tails"
  UPDATE public.questions SET mc_options = '["Glycolipid; has a sugar group attached to a fatty acid chain", "Triglyceride; has three fatty acid chains and one glycerol head", "Steroid; has a four-ring carbon structure and a polar group"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Lipids' AND point_value = 300;

  -- 400: correct = "Saturated have no double bonds and are solid; unsaturated have double bonds and are liquid"
  UPDATE public.questions SET mc_options = '["Saturated have double bonds and are liquid; unsaturated have no double bonds and are solid", "Saturated contain oxygen; unsaturated contain only carbon and hydrogen", "Saturated are found only in plants; unsaturated are found only in animals"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Lipids' AND point_value = 400;

  -- 500: correct = "Steroids"
  UPDATE public.questions SET mc_options = '["Phospholipids", "Triglycerides", "Waxes"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Lipids' AND point_value = 500;

  -- ── Macromolecules & Organic Compounds ──────────────────────────────────

  -- 100: correct = "Carbon"
  UPDATE public.questions SET mc_options = '["Nitrogen", "Hydrogen", "Oxygen"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Macromolecules & Organic Compounds' AND point_value = 100;

  -- 200: correct = "Carbohydrates, lipids, proteins, and nucleic acids"
  UPDATE public.questions SET mc_options = '["Carbohydrates, vitamins, minerals, and water", "Glucose, fatty acids, amino acids, and nucleotides", "Enzymes, hormones, antibodies, and steroids"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Macromolecules & Organic Compounds' AND point_value = 200;

  -- 300: correct = "Dehydration synthesis"
  UPDATE public.questions SET mc_options = '["Hydrolysis", "Condensation reversal", "Oxidative phosphorylation"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Macromolecules & Organic Compounds' AND point_value = 300;

  -- 400: correct = "Hydrolysis"
  UPDATE public.questions SET mc_options = '["Dehydration synthesis", "Catabolism reversal", "Oxidation"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Macromolecules & Organic Compounds' AND point_value = 400;

  -- 500: correct = "Carbon, hydrogen, and oxygen in a 1:2:1 ratio"
  UPDATE public.questions SET mc_options = '["Carbon, hydrogen, and nitrogen in a 2:1:1 ratio", "Carbon, oxygen, and phosphorus in a 1:1:1 ratio", "Carbon, hydrogen, oxygen, and nitrogen in equal parts"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Macromolecules & Organic Compounds' AND point_value = 500;

  -- ── Proteins & Amino Acids ───────────────────────────────────────────────

  -- 100: correct = "Amino acid"
  UPDATE public.questions SET mc_options = '["Nucleotide", "Monosaccharide", "Fatty acid"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Proteins & Amino Acids' AND point_value = 100;

  -- 200: correct = "Peptide bond"
  UPDATE public.questions SET mc_options = '["Hydrogen bond", "Ionic bond", "Glycosidic bond"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Proteins & Amino Acids' AND point_value = 200;

  -- 300: correct = "Enzymes, structure/support, transport, defense/antibodies, movement, signaling"
  UPDATE public.questions SET mc_options = '["Energy storage, genetic information, and cell wall formation", "Photosynthesis, glycolysis, and DNA replication only", "Lipid digestion, carbohydrate synthesis, and oxygen transport"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Proteins & Amino Acids' AND point_value = 300;

  -- 400: correct = "Its shape or structure"
  UPDATE public.questions SET mc_options = '["Its molecular weight", "The number of amino acids it contains", "The presence of sulfur atoms"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Proteins & Amino Acids' AND point_value = 400;

  -- 500: correct = "Loss of protein shape/function; caused by extreme temperature, pH changes, or chemicals"
  UPDATE public.questions SET mc_options = '["Breakdown of a protein into amino acids by hydrolysis during digestion", "Synthesis of a protein from mRNA at the ribosome", "Folding of a protein into its final three-dimensional shape"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Proteins & Amino Acids' AND point_value = 500;

  -- ── Transcription ────────────────────────────────────────────────────────

  -- 100: correct = "Transcription"
  UPDATE public.questions SET mc_options = '["Translation", "Replication", "Transduction"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Transcription' AND point_value = 100;

  -- 200: correct = "Uracil"
  UPDATE public.questions SET mc_options = '["Cytosine", "Adenine", "Guanine"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Transcription' AND point_value = 200;

  -- 300: correct = "RNA polymerase"
  UPDATE public.questions SET mc_options = '["DNA polymerase", "Helicase", "Ligase"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Transcription' AND point_value = 300;

  -- 400: correct = "Nucleus"
  UPDATE public.questions SET mc_options = '["Ribosome", "Mitochondria", "Endoplasmic reticulum"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Transcription' AND point_value = 400;

  -- 500: correct = "RNA splicing"
  UPDATE public.questions SET mc_options = '["DNA methylation", "Reverse transcription", "Translocation"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Transcription' AND point_value = 500;

  -- ── Translation ──────────────────────────────────────────────────────────

  -- 100: correct = "Translation"
  UPDATE public.questions SET mc_options = '["Transcription", "Replication", "Transduction"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Translation' AND point_value = 100;

  -- 200: correct = "Ribosome"
  UPDATE public.questions SET mc_options = '["Nucleus", "Mitochondria", "Golgi apparatus"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Translation' AND point_value = 200;

  -- 300: correct = "Transfer RNA (tRNA)"
  UPDATE public.questions SET mc_options = '["Messenger RNA (mRNA)", "Ribosomal RNA (rRNA)", "Small nuclear RNA (snRNA)"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Translation' AND point_value = 300;

  -- 400: correct = "Codon"
  UPDATE public.questions SET mc_options = '["Anticodon", "Exon", "Reading frame"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Translation' AND point_value = 400;

  -- 500: correct = "UAA, UAG, and UGA"
  UPDATE public.questions SET mc_options = '["AUG, UGA, and UAA", "UAC, UAG, and UGA", "UAA, UAG, and UCA"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Translation' AND point_value = 500;

END $$;

-- Verify all 35 questions now have mc_options
DO $$
DECLARE
  v_nulls INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_nulls
  FROM public.questions q
  JOIN public.question_banks b ON q.bank_id = b.id
  WHERE b.title = 'Biochemistry & Protein Synthesis'
    AND q.mc_options IS NULL;

  IF v_nulls > 0 THEN
    RAISE EXCEPTION 'mc_options seed incomplete: % questions still NULL in Biochemistry & Protein Synthesis', v_nulls;
  END IF;

  RAISE NOTICE 'OK: all questions in Biochemistry & Protein Synthesis now have mc_options';
END $$;
