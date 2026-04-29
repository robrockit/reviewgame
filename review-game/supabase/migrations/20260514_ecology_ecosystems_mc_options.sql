-- Migration: mc_options for "Ecology & Ecosystems" bank
-- Purpose: Seeds 3 wrong-answer options for all 35 questions so this bank
--          can be used in Quick Fire (pub_trivia) mode.
-- Depends on: 20260426_questions_mc_options.sql (mc_options column)
-- Date: 2026-05-14

DO $$
DECLARE
  v_bank_id UUID;
BEGIN

  SELECT id INTO v_bank_id
  FROM public.question_banks
  WHERE title = 'Ecology & Ecosystems'
    AND is_public = true;

  IF v_bank_id IS NULL THEN
    RAISE EXCEPTION 'Ecology & Ecosystems bank not found';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.questions
    WHERE bank_id = v_bank_id
      AND mc_options IS NOT NULL
  ) THEN
    RAISE NOTICE 'Ecology & Ecosystems mc_options already seeded -- skipping';
    RETURN;
  END IF;

  -- ── Cycles of Matter ─────────────────────────────────────────────────────

  -- 100: correct = "Photosynthesis"
  UPDATE public.questions SET mc_options = '["Cellular respiration", "Transpiration", "Decomposition"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Cycles of Matter' AND point_value = 100;

  -- 200: correct = "Transpiration"
  UPDATE public.questions SET mc_options = '["Evaporation", "Precipitation", "Condensation"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Cycles of Matter' AND point_value = 200;

  -- 300: correct = "Nitrogen-fixing bacteria"
  UPDATE public.questions SET mc_options = '["Denitrifying bacteria", "Nitrifying bacteria", "Decomposers"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Cycles of Matter' AND point_value = 300;

  -- 400: correct = "Cellular respiration"
  UPDATE public.questions SET mc_options = '["Photosynthesis", "Transpiration", "Decomposition"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Cycles of Matter' AND point_value = 400;

  -- 500: correct = "Nitrification"
  UPDATE public.questions SET mc_options = '["Denitrification", "Nitrogen fixation", "Ammonification"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Cycles of Matter' AND point_value = 500;

  -- ── Ecological Succession ────────────────────────────────────────────────

  -- 100: correct = "Ecological succession"
  UPDATE public.questions SET mc_options = '["Population dynamics", "Community turnover", "Habitat fragmentation"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Ecological Succession' AND point_value = 100;

  -- 200: correct = "Primary succession"
  UPDATE public.questions SET mc_options = '["Secondary succession", "Climax succession", "Ecological recovery"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Ecological Succession' AND point_value = 200;

  -- 300: correct = "Pioneer species"
  UPDATE public.questions SET mc_options = '["Climax species", "Keystone species", "Indicator species"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Ecological Succession' AND point_value = 300;

  -- 400: correct = "Climax community"
  UPDATE public.questions SET mc_options = '["Pioneer community", "Intermediate community", "Transitional community"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Ecological Succession' AND point_value = 400;

  -- 500: correct = "Secondary succession occurs where soil already exists"
  UPDATE public.questions SET mc_options = '["Secondary succession occurs on bare rock; primary succession follows disturbance in established ecosystems", "Both types occur on bare rock but at different rates", "Primary succession is faster because pioneer species are already present"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Ecological Succession' AND point_value = 500;

  -- ── Ecosystems & Biomes ──────────────────────────────────────────────────

  -- 100: correct = "Ecosystem"
  UPDATE public.questions SET mc_options = '["Biome", "Community", "Habitat"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Ecosystems & Biomes' AND point_value = 100;

  -- 200: correct = "Desert"
  UPDATE public.questions SET mc_options = '["Tundra", "Grassland", "Chaparral"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Ecosystems & Biomes' AND point_value = 200;

  -- 300: correct = "Temperature and precipitation"
  UPDATE public.questions SET mc_options = '["Soil type and elevation only", "Sunlight and wind speed", "Latitude and longitude"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Ecosystems & Biomes' AND point_value = 300;

  -- 400: correct = "Biodiversity"
  UPDATE public.questions SET mc_options = '["Species richness", "Carrying capacity", "Ecological productivity"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Ecosystems & Biomes' AND point_value = 400;

  -- 500: correct = "Permafrost"
  UPDATE public.questions SET mc_options = '["Tundra soil", "Frozen subsoil", "Arctic bedrock"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Ecosystems & Biomes' AND point_value = 500;

  -- ── Food Webs & Energy Flow ──────────────────────────────────────────────

  -- 100: correct = "Producers"
  UPDATE public.questions SET mc_options = '["Consumers", "Decomposers", "Herbivores"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Food Webs & Energy Flow' AND point_value = 100;

  -- 200: correct = "10%"
  UPDATE public.questions SET mc_options = '["50%", "25%", "1%"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Food Webs & Energy Flow' AND point_value = 200;

  -- 300: correct = "Decomposers"
  UPDATE public.questions SET mc_options = '["Scavengers", "Herbivores", "Primary consumers"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Food Webs & Energy Flow' AND point_value = 300;

  -- 400: correct = "Not enough energy remains to support higher levels"
  UPDATE public.questions SET mc_options = '["There are not enough prey species to support more predators", "Toxins accumulate at higher levels making survival impossible", "Larger predators need too much space to coexist"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Food Webs & Energy Flow' AND point_value = 400;

  -- 500: correct = "Omnivore"
  UPDATE public.questions SET mc_options = '["Herbivore", "Carnivore", "Scavenger"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Food Webs & Energy Flow' AND point_value = 500;

  -- ── Human Impact & Conservation ──────────────────────────────────────────

  -- 100: correct = "Biodiversity"
  UPDATE public.questions SET mc_options = '["Species richness", "Ecosystem stability", "Carrying capacity"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Human Impact & Conservation' AND point_value = 100;

  -- 200: correct = "Extinction"
  UPDATE public.questions SET mc_options = '["Extirpation", "Endangerment", "Decline"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Human Impact & Conservation' AND point_value = 200;

  -- 300: correct = "Carbon dioxide"
  UPDATE public.questions SET mc_options = '["Methane", "Water vapor", "Nitrous oxide"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Human Impact & Conservation' AND point_value = 300;

  -- 400: correct = "Eutrophication"
  UPDATE public.questions SET mc_options = '["Acid deposition", "Bioaccumulation", "Sedimentation"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Human Impact & Conservation' AND point_value = 400;

  -- 500: correct = "A species that has a disproportionately large effect on its ecosystem relative to its abundance"
  UPDATE public.questions SET mc_options = '["A species that is the most abundant organism in an ecosystem", "A species that produces the most biomass in its food web", "A species that can only survive in one specific habitat type"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Human Impact & Conservation' AND point_value = 500;

  -- ── Population Dynamics ──────────────────────────────────────────────────

  -- 100: correct = "Carrying capacity"
  UPDATE public.questions SET mc_options = '["Population size", "Biotic potential", "Limiting factor"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Population Dynamics' AND point_value = 100;

  -- 200: correct = "Density-dependent factors"
  UPDATE public.questions SET mc_options = '["Density-independent factors", "Abiotic limiting factors", "Environmental resistance"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Population Dynamics' AND point_value = 200;

  -- 300: correct = "Exponential growth"
  UPDATE public.questions SET mc_options = '["Logistic growth", "Linear growth", "S-shaped growth"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Population Dynamics' AND point_value = 300;

  -- 400: correct = "Density-independent factors"
  UPDATE public.questions SET mc_options = '["Density-dependent factors", "Biotic limiting factors", "Intraspecific competition"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Population Dynamics' AND point_value = 400;

  -- 500: correct = "Immigration is individuals moving into a population; emigration is individuals leaving a population"
  UPDATE public.questions SET mc_options = '["Immigration is individuals leaving a population; emigration is individuals moving into a population", "Both immigration and emigration refer to seasonal movement within the same population", "Immigration increases death rate; emigration increases birth rate"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Population Dynamics' AND point_value = 500;

  -- ── Symbiotic Relationships ──────────────────────────────────────────────

  -- 100: correct = "Mutualism"
  UPDATE public.questions SET mc_options = '["Commensalism", "Parasitism", "Competition"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Symbiotic Relationships' AND point_value = 100;

  -- 200: correct = "The parasite benefits and the host is harmed"
  UPDATE public.questions SET mc_options = '["The host benefits and the parasite is harmed", "Both organisms are harmed equally", "Neither organism is significantly affected"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Symbiotic Relationships' AND point_value = 200;

  -- 300: correct = "Commensalism"
  UPDATE public.questions SET mc_options = '["Mutualism", "Parasitism", "Predation"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Symbiotic Relationships' AND point_value = 300;

  -- 400: correct = "Mutualism"
  UPDATE public.questions SET mc_options = '["Commensalism", "Parasitism", "Competition"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Symbiotic Relationships' AND point_value = 400;

  -- 500: correct = "Competition"
  UPDATE public.questions SET mc_options = '["Predation", "Parasitism", "Mutualism"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Symbiotic Relationships' AND point_value = 500;

END $$;

-- Verify all 35 questions now have mc_options
DO $$
DECLARE
  v_nulls INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_nulls
  FROM public.questions q
  JOIN public.question_banks b ON q.bank_id = b.id
  WHERE b.title = 'Ecology & Ecosystems'
    AND q.mc_options IS NULL;

  IF v_nulls > 0 THEN
    RAISE EXCEPTION 'mc_options seed incomplete: % questions still NULL in Ecology & Ecosystems', v_nulls;
  END IF;

  RAISE NOTICE 'OK: all questions in Ecology & Ecosystems now have mc_options';
END $$;
