-- Migration: mc_options for "Human Body Systems" bank
-- Purpose: Seeds 3 wrong-answer options for all 35 questions so this bank
--          can be used in Quick Fire (pub_trivia) mode.
-- Depends on: 20260426_questions_mc_options.sql (mc_options column)
-- Date: 2026-05-16

DO $$
DECLARE
  v_bank_id UUID;
BEGIN

  SELECT id INTO v_bank_id
  FROM public.question_banks
  WHERE title = 'Human Body Systems'
    AND is_public = true;

  IF v_bank_id IS NULL THEN
    RAISE EXCEPTION 'Human Body Systems bank not found';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.questions
    WHERE bank_id = v_bank_id
      AND mc_options IS NOT NULL
  ) THEN
    RAISE NOTICE 'Human Body Systems mc_options already seeded -- skipping';
    RETURN;
  END IF;

  -- ── Circulatory System ───────────────────────────────────────────────────

  -- 100: correct = "Heart"
  UPDATE public.questions SET mc_options = '["Lungs", "Liver", "Kidneys"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Circulatory System' AND point_value = 100;

  -- 200: correct = "Arteries, veins, and capillaries"
  UPDATE public.questions SET mc_options = '["Arteries, lymph vessels, and veins", "Capillaries, venules, and arterioles only", "Veins, lymph nodes, and arteries"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Circulatory System' AND point_value = 200;

  -- 300: correct = "Red blood cells"
  UPDATE public.questions SET mc_options = '["White blood cells", "Platelets", "Plasma"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Circulatory System' AND point_value = 300;

  -- 400: correct = "Pulmonary circulation carries blood between heart and lungs; systemic carries blood to rest of body"
  UPDATE public.questions SET mc_options = '["Pulmonary circulation carries oxygenated blood to the body; systemic carries deoxygenated blood to the lungs", "Systemic circulation pumps blood between heart and lungs; pulmonary circulation serves the body", "Both pulmonary and systemic circulation carry blood to the lungs in sequence"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Circulatory System' AND point_value = 400;

  -- 500: correct = "Valves"
  UPDATE public.questions SET mc_options = '["Sphincters", "The heartbeat pressure", "Smooth muscle contractions"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Circulatory System' AND point_value = 500;

  -- ── Digestive System ─────────────────────────────────────────────────────

  -- 100: correct = "Esophagus"
  UPDATE public.questions SET mc_options = '["Trachea", "Pharynx", "Duodenum"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Digestive System' AND point_value = 100;

  -- 200: correct = "Small intestine"
  UPDATE public.questions SET mc_options = '["Large intestine", "Stomach", "Liver"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Digestive System' AND point_value = 200;

  -- 300: correct = "Amylase"
  UPDATE public.questions SET mc_options = '["Pepsin", "Lipase", "Protease"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Digestive System' AND point_value = 300;

  -- 400: correct = "Liver"
  UPDATE public.questions SET mc_options = '["Pancreas", "Gallbladder", "Stomach"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Digestive System' AND point_value = 400;

  -- 500: correct = "Villi"
  UPDATE public.questions SET mc_options = '["Microvilli", "Lacteals", "Cilia"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Digestive System' AND point_value = 500;

  -- ── Endocrine System ─────────────────────────────────────────────────────

  -- 100: correct = "Hormones"
  UPDATE public.questions SET mc_options = '["Enzymes", "Neurotransmitters", "Antibodies"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Endocrine System' AND point_value = 100;

  -- 200: correct = "Pituitary gland"
  UPDATE public.questions SET mc_options = '["Hypothalamus", "Adrenal gland", "Thyroid gland"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Endocrine System' AND point_value = 200;

  -- 300: correct = "Insulin"
  UPDATE public.questions SET mc_options = '["Glucagon", "Cortisol", "Epinephrine"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Endocrine System' AND point_value = 300;

  -- 400: correct = "Adrenal glands"
  UPDATE public.questions SET mc_options = '["Thyroid gland", "Pituitary gland", "Pancreas"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Endocrine System' AND point_value = 400;

  -- 500: correct = "Nervous system is fast and short-lived; endocrine is slower and longer-lasting"
  UPDATE public.questions SET mc_options = '["Endocrine system is fast and short-lived; nervous system is slower and longer-lasting", "Both systems use the same chemical messengers but deliver them differently", "The nervous system controls involuntary functions; the endocrine system controls voluntary functions"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Endocrine System' AND point_value = 500;

  -- ── Immune System ────────────────────────────────────────────────────────

  -- 100: correct = "Immunity"
  UPDATE public.questions SET mc_options = '["Inflammation", "Resistance", "Defense"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Immune System' AND point_value = 100;

  -- 200: correct = "White blood cells"
  UPDATE public.questions SET mc_options = '["Red blood cells", "Platelets", "Antibodies"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Immune System' AND point_value = 200;

  -- 300: correct = "Antibodies"
  UPDATE public.questions SET mc_options = '["Antigens", "T cells", "Lymphocytes"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Immune System' AND point_value = 300;

  -- 400: correct = "Active immunity is when the body produces its own antibodies; passive is when antibodies come from another source"
  UPDATE public.questions SET mc_options = '["Active immunity lasts only a few days; passive immunity lasts a lifetime", "Passive immunity requires a vaccine; active immunity comes from breast milk", "Both types require the body to produce its own antibodies through different triggers"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Immune System' AND point_value = 400;

  -- 500: correct = "A foreign substance that triggers an immune response"
  UPDATE public.questions SET mc_options = '["A protein produced by white blood cells to fight pathogens", "A type of white blood cell that engulfs pathogens", "A chemical released by mast cells during an allergic reaction"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Immune System' AND point_value = 500;

  -- ── Nervous System ───────────────────────────────────────────────────────

  -- 100: correct = "Neuron"
  UPDATE public.questions SET mc_options = '["Synapse", "Axon", "Dendrite"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Nervous System' AND point_value = 100;

  -- 200: correct = "Central nervous system and peripheral nervous system"
  UPDATE public.questions SET mc_options = '["Somatic nervous system and autonomic nervous system", "Sensory nervous system and motor nervous system", "Sympathetic nervous system and parasympathetic nervous system"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Nervous System' AND point_value = 200;

  -- 300: correct = "Synapse"
  UPDATE public.questions SET mc_options = '["Node of Ranvier", "Axon terminal", "Dendrite junction"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Nervous System' AND point_value = 300;

  -- 400: correct = "Cerebellum"
  UPDATE public.questions SET mc_options = '["Cerebrum", "Brain stem", "Medulla oblongata"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Nervous System' AND point_value = 400;

  -- 500: correct = "An automatic response that bypasses the brain for faster reaction"
  UPDATE public.questions SET mc_options = '["A learned behavior stored in the cerebellum that speeds up reactions", "A voluntary response initiated by the cerebral cortex for rapid decisions", "A chemical signal released by the endocrine system to trigger muscle movement"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Nervous System' AND point_value = 500;

  -- ── Respiratory System ───────────────────────────────────────────────────

  -- 100: correct = "Gas exchange or bringing in oxygen and removing carbon dioxide"
  UPDATE public.questions SET mc_options = '["Producing red blood cells for oxygen transport", "Filtering toxins from inhaled air before they reach the bloodstream", "Regulating body temperature through exhaled air"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Respiratory System' AND point_value = 100;

  -- 200: correct = "Trachea"
  UPDATE public.questions SET mc_options = '["Esophagus", "Larynx", "Bronchus"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Respiratory System' AND point_value = 200;

  -- 300: correct = "Alveoli"
  UPDATE public.questions SET mc_options = '["Bronchioles", "Capillaries", "Pleura"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Respiratory System' AND point_value = 300;

  -- 400: correct = "Diaphragm"
  UPDATE public.questions SET mc_options = '["Intercostal muscles", "Pleura", "Bronchial muscles"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Respiratory System' AND point_value = 400;

  -- 500: correct = "Diffusion from high to low concentration"
  UPDATE public.questions SET mc_options = '["Active transport using ATP from alveolar cells", "Osmosis driven by blood pressure in the capillaries", "Facilitated diffusion using protein pumps in the alveolar membrane"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Respiratory System' AND point_value = 500;

  -- ── Skeletal & Muscular Systems ──────────────────────────────────────────

  -- 100: correct = "206"
  UPDATE public.questions SET mc_options = '["212", "196", "186"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Skeletal & Muscular Systems' AND point_value = 100;

  -- 200: correct = "Joint"
  UPDATE public.questions SET mc_options = '["Ligament", "Tendon", "Cartilage"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Skeletal & Muscular Systems' AND point_value = 200;

  -- 300: correct = "Cardiac muscle"
  UPDATE public.questions SET mc_options = '["Smooth muscle", "Skeletal muscle", "Striated voluntary muscle"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Skeletal & Muscular Systems' AND point_value = 300;

  -- 400: correct = "Ligaments"
  UPDATE public.questions SET mc_options = '["Tendons", "Cartilage", "Fascia"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Skeletal & Muscular Systems' AND point_value = 400;

  -- 500: correct = "Tendons; Achilles tendon"
  UPDATE public.questions SET mc_options = '["Ligaments; anterior cruciate ligament", "Cartilage; meniscus", "Fascia; plantar fascia"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Skeletal & Muscular Systems' AND point_value = 500;

END $$;

-- Verify all 35 questions now have mc_options
DO $$
DECLARE
  v_nulls INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_nulls
  FROM public.questions q
  JOIN public.question_banks b ON q.bank_id = b.id
  WHERE b.title = 'Human Body Systems'
    AND q.mc_options IS NULL;

  IF v_nulls > 0 THEN
    RAISE EXCEPTION 'mc_options seed incomplete: % questions still NULL in Human Body Systems', v_nulls;
  END IF;

  RAISE NOTICE 'OK: all questions in Human Body Systems now have mc_options';
END $$;
