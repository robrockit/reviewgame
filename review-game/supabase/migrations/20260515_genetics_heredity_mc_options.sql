-- Migration: mc_options for "Genetics & Heredity" bank
-- Purpose: Seeds 3 wrong-answer options for all 35 questions so this bank
--          can be used in Quick Fire (pub_trivia) mode.
-- Depends on: 20260426_questions_mc_options.sql (mc_options column)
-- Date: 2026-05-15

DO $$
DECLARE
  v_bank_id UUID;
BEGIN

  SELECT id INTO v_bank_id
  FROM public.question_banks
  WHERE title = 'Genetics & Heredity'
    AND is_public = true;

  IF v_bank_id IS NULL THEN
    RAISE EXCEPTION 'Genetics & Heredity bank not found';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.questions
    WHERE bank_id = v_bank_id
      AND mc_options IS NOT NULL
  ) THEN
    RAISE NOTICE 'Genetics & Heredity mc_options already seeded -- skipping';
    RETURN;
  END IF;

  -- ── Chromosomes & Cell Division ──────────────────────────────────────────

  -- 100: correct = "46 chromosomes"
  UPDATE public.questions SET mc_options = '["23 chromosomes", "48 chromosomes", "92 chromosomes"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Chromosomes & Cell Division' AND point_value = 100;

  -- 200: correct = "Meiosis"
  UPDATE public.questions SET mc_options = '["Mitosis", "Binary fission", "Cytokinesis"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Chromosomes & Cell Division' AND point_value = 200;

  -- 300: correct = "Frameshift mutation"
  UPDATE public.questions SET mc_options = '["Point mutation", "Substitution mutation", "Silent mutation"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Chromosomes & Cell Division' AND point_value = 300;

  -- 400: correct = "Chromosome 21"
  UPDATE public.questions SET mc_options = '["Chromosome 18", "Chromosome 13", "Chromosome X"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Chromosomes & Cell Division' AND point_value = 400;

  -- 500: correct = "Prophase I"
  UPDATE public.questions SET mc_options = '["Metaphase I", "Anaphase I", "Prophase II"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Chromosomes & Cell Division' AND point_value = 500;

  -- ── DNA Structure & Replication ──────────────────────────────────────────

  -- 100: correct = "Deoxyribonucleic Acid"
  UPDATE public.questions SET mc_options = '["Deoxyribose Nucleotide Acid", "Deoxyribonucleoside Acid", "Diribonucleic Acid"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'DNA Structure & Replication' AND point_value = 100;

  -- 200: correct = "Thymine"
  UPDATE public.questions SET mc_options = '["Uracil", "Guanine", "Cytosine"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'DNA Structure & Replication' AND point_value = 200;

  -- 300: correct = "Watson and Crick"
  UPDATE public.questions SET mc_options = '["Franklin and Wilkins", "Pauling and Corey", "Chargaff and Avery"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'DNA Structure & Replication' AND point_value = 300;

  -- 400: correct = "Helicase"
  UPDATE public.questions SET mc_options = '["DNA polymerase", "Ligase", "Primase"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'DNA Structure & Replication' AND point_value = 400;

  -- 500: correct = "Each new DNA molecule contains one original strand and one newly synthesized strand"
  UPDATE public.questions SET mc_options = '["Both strands of the original DNA are preserved in one daughter molecule", "Both daughter molecules contain entirely new DNA strands", "One daughter molecule has both original strands; the other has both new strands"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'DNA Structure & Replication' AND point_value = 500;

  -- ── Genetic Technology ───────────────────────────────────────────────────

  -- 100: correct = "Genetically Modified Organism"
  UPDATE public.questions SET mc_options = '["Genomically Modified Organism", "Genetically Mutated Organism", "Gene-Mapped Organism"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Genetic Technology' AND point_value = 100;

  -- 200: correct = "PCR or Polymerase Chain Reaction"
  UPDATE public.questions SET mc_options = '["Gel electrophoresis", "DNA sequencing", "Southern blotting"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Genetic Technology' AND point_value = 200;

  -- 300: correct = "Cloning"
  UPDATE public.questions SET mc_options = '["Genetic engineering", "Selective breeding", "Transgenesis"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Genetic Technology' AND point_value = 300;

  -- 400: correct = "CRISPR"
  UPDATE public.questions SET mc_options = '["PCR", "Restriction enzymes", "Gel electrophoresis"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Genetic Technology' AND point_value = 400;

  -- 500: correct = "Inserting healthy genes into cells to treat or cure genetic diseases"
  UPDATE public.questions SET mc_options = '["Using CRISPR to delete harmful genes from reproductive cells only", "Cloning healthy individuals to create disease-resistant populations", "Replacing entire chromosomes with synthetic DNA to eliminate mutations"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Genetic Technology' AND point_value = 500;

  -- ── Inheritance Patterns ─────────────────────────────────────────────────

  -- 100: correct = "Codominance"
  UPDATE public.questions SET mc_options = '["Incomplete dominance", "Complete dominance", "Multiple alleles"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Inheritance Patterns' AND point_value = 100;

  -- 200: correct = "Type A or Type B"
  UPDATE public.questions SET mc_options = '["Type AB or Type O", "Type O only", "Type A, B, AB, or O"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Inheritance Patterns' AND point_value = 200;

  -- 300: correct = "Incomplete dominance"
  UPDATE public.questions SET mc_options = '["Codominance", "Complete dominance", "Multiple alleles"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Inheritance Patterns' AND point_value = 300;

  -- 400: correct = "Sex-linked traits"
  UPDATE public.questions SET mc_options = '["Autosomal dominant traits", "Autosomal recessive traits", "Y-linked traits"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Inheritance Patterns' AND point_value = 400;

  -- 500: correct = "Males have only one X chromosome, so they cannot be carriers"
  UPDATE public.questions SET mc_options = '["Males have two X chromosomes so both must be affected to show the trait", "Males express X-linked traits more because their Y chromosome activates recessive alleles", "Males are more susceptible due to higher testosterone levels"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Inheritance Patterns' AND point_value = 500;

  -- ── Mendelian Genetics ───────────────────────────────────────────────────

  -- 100: correct = "Phenotype"
  UPDATE public.questions SET mc_options = '["Genotype", "Allele", "Trait"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Mendelian Genetics' AND point_value = 100;

  -- 200: correct = "Tt"
  UPDATE public.questions SET mc_options = '["TT", "tt", "Ttt"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Mendelian Genetics' AND point_value = 200;

  -- 300: correct = "25%"
  UPDATE public.questions SET mc_options = '["50%", "75%", "0%"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Mendelian Genetics' AND point_value = 300;

  -- 400: correct = "Pea plants"
  UPDATE public.questions SET mc_options = '["Fruit flies", "Corn plants", "Mice"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Mendelian Genetics' AND point_value = 400;

  -- 500: correct = "Genes for different traits are inherited independently of each other"
  UPDATE public.questions SET mc_options = '["Dominant alleles always mask recessive alleles in heterozygotes", "Traits are always inherited together on the same chromosome", "An organism inherits one allele for each trait from each parent in a linked fashion"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Mendelian Genetics' AND point_value = 500;

  -- ── Pedigrees & Probability ──────────────────────────────────────────────

  -- 100: correct = "Square"
  UPDATE public.questions SET mc_options = '["Circle", "Triangle", "Diamond"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Pedigrees & Probability' AND point_value = 100;

  -- 200: correct = "Carrier"
  UPDATE public.questions SET mc_options = '["Homozygous dominant", "Homozygous recessive", "Affected individual"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Pedigrees & Probability' AND point_value = 200;

  -- 300: correct = "50%"
  UPDATE public.questions SET mc_options = '["25%", "75%", "100%"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Pedigrees & Probability' AND point_value = 300;

  -- 400: correct = "X-linked recessive"
  UPDATE public.questions SET mc_options = '["Autosomal recessive", "Autosomal dominant", "Y-linked"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Pedigrees & Probability' AND point_value = 400;

  -- 500: correct = "25%"
  UPDATE public.questions SET mc_options = '["50%", "12.5%", "6.25%"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Pedigrees & Probability' AND point_value = 500;

  -- ── Protein Synthesis ────────────────────────────────────────────────────

  -- 100: correct = "Transcription"
  UPDATE public.questions SET mc_options = '["Translation", "Replication", "Transduction"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Protein Synthesis' AND point_value = 100;

  -- 200: correct = "Transfer RNA (tRNA)"
  UPDATE public.questions SET mc_options = '["Messenger RNA (mRNA)", "Ribosomal RNA (rRNA)", "Micro RNA (miRNA)"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Protein Synthesis' AND point_value = 200;

  -- 300: correct = "Three"
  UPDATE public.questions SET mc_options = '["Two", "Four", "Six"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Protein Synthesis' AND point_value = 300;

  -- 400: correct = "Ribosome"
  UPDATE public.questions SET mc_options = '["Nucleus", "Golgi apparatus", "Endoplasmic reticulum"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Protein Synthesis' AND point_value = 400;

  -- 500: correct = "RNA polymerase"
  UPDATE public.questions SET mc_options = '["DNA polymerase", "Helicase", "Ligase"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Protein Synthesis' AND point_value = 500;

END $$;

-- Verify all 35 questions now have mc_options
DO $$
DECLARE
  v_nulls INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_nulls
  FROM public.questions q
  JOIN public.question_banks b ON q.bank_id = b.id
  WHERE b.title = 'Genetics & Heredity'
    AND q.mc_options IS NULL;

  IF v_nulls > 0 THEN
    RAISE EXCEPTION 'mc_options seed incomplete: % questions still NULL in Genetics & Heredity', v_nulls;
  END IF;

  RAISE NOTICE 'OK: all questions in Genetics & Heredity now have mc_options';
END $$;
