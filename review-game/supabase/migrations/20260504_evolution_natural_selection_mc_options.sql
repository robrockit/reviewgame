-- Migration: mc_options for "Evolution & Natural Selection" bank
-- Purpose: Seeds 3 wrong-answer options for all 35 questions so this bank
--          can be used in Quick Fire (pub_trivia) mode.
-- Depends on: 20260426_questions_mc_options.sql (mc_options column)
-- Date: 2026-05-04

DO $$
DECLARE
  v_bank_id UUID;
BEGIN

  SELECT id INTO v_bank_id
  FROM public.question_banks
  WHERE title = 'Evolution & Natural Selection'
    AND is_public = true;

  IF v_bank_id IS NULL THEN
    RAISE EXCEPTION 'Evolution & Natural Selection bank not found';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.questions
    WHERE bank_id = v_bank_id
      AND mc_options IS NOT NULL
  ) THEN
    RAISE NOTICE 'Evolution & Natural Selection mc_options already seeded -- skipping';
    RETURN;
  END IF;

  -- ── Adaptation & Fitness ─────────────────────────────────────────────────

  -- 100: correct = "Adaptation"
  -- Errors: mutation (random change, not inherited for survival), instinct (behavioral not structural), variation (natural differences, not survival-specific)
  UPDATE public.questions SET mc_options = '["Mutation", "Instinct", "Variation"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Adaptation & Fitness' AND point_value = 100;

  -- 200: correct = "Reproductive success"
  -- Errors: physical strength (common misconception), lifespan (longevity ≠ fitness), speed or agility (trait, not fitness measure)
  UPDATE public.questions SET mc_options = '["Physical strength", "Lifespan", "Speed or agility"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Adaptation & Fitness' AND point_value = 200;

  -- 300: correct = "Camouflage"
  -- Errors: mimicry (resembling another species, not blending in), warning coloration (opposite — makes organism visible), bioluminescence (produces light, opposite of blending in)
  UPDATE public.questions SET mc_options = '["Mimicry", "Warning coloration", "Bioluminescence"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Adaptation & Fitness' AND point_value = 300;

  -- 400: correct = "When one species resembles another species for protection or advantage"
  -- Errors: color-matching background (camouflage, not mimicry), producing toxins (chemical defense), warning coloration (aposematism — distinct mechanism)
  UPDATE public.questions SET mc_options = '["When an organism changes color to match its background", "When an organism produces toxins to deter predators", "When an organism uses warning coloration to signal danger"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Adaptation & Fitness' AND point_value = 400;

  -- 500: correct = "Individuals don't evolve; populations evolve over many generations through natural selection"
  -- Errors: organisms choose mutations (Lamarckist misconception), environment alters DNA (wrong mechanism), adaptations within one generation (conflates learning with evolution)
  UPDATE public.questions SET mc_options = '["Organisms can consciously choose beneficial mutations", "Environmental changes directly alter DNA sequences", "Adaptations occur within a single generation through learning"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Adaptation & Fitness' AND point_value = 500;

  -- ── Darwin & Theory of Evolution ─────────────────────────────────────────

  -- 100: correct = "Charles Darwin"
  -- Errors: Gregor Mendel (genetics, not evolution), Jean-Baptiste Lamarck (different evolution theory), Carl Linnaeus (taxonomy)
  UPDATE public.questions SET mc_options = '["Gregor Mendel", "Jean-Baptiste Lamarck", "Carl Linnaeus"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Darwin & Theory of Evolution' AND point_value = 100;

  -- 200: correct = "HMS Beagle"
  -- Errors: HMS Endeavour (Captain Cook's ship), HMS Bounty (Bligh's ship), HMS Victory (Nelson's flagship)
  UPDATE public.questions SET mc_options = '["HMS Endeavour", "HMS Bounty", "HMS Victory"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Darwin & Theory of Evolution' AND point_value = 200;

  -- 300: correct = "On the Origin of Species"
  -- Errors: The Descent of Man (Darwin's 1871 book — wrong title/year), The Selfish Gene (Richard Dawkins), Principles of Geology (Charles Lyell)
  UPDATE public.questions SET mc_options = '["The Descent of Man", "The Selfish Gene", "Principles of Geology"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Darwin & Theory of Evolution' AND point_value = 300;

  -- 400: correct = "Finches"
  -- Errors: iguanas (Galápagos but not the adaptation narrative), sea turtles (not the example), blue-footed boobies (present but not the example)
  UPDATE public.questions SET mc_options = '["Iguanas", "Sea turtles", "Blue-footed boobies"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Darwin & Theory of Evolution' AND point_value = 400;

  -- 500: correct = "Populations grow faster than their food supply"
  -- Errors: all species equally fit (contradicts natural selection), Lamarckism (acquired traits inherited), uniformitarianism (Lyell's geology, not Malthus)
  UPDATE public.questions SET mc_options = '["All species are equally fit for survival", "Organisms pass on traits acquired during life", "Geological changes occur slowly and uniformly"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Darwin & Theory of Evolution' AND point_value = 500;

  -- ── Evidence for Evolution ────────────────────────────────────────────────

  -- 100: correct = "Fossils"
  -- Errors: artifacts (human-made objects), specimens (living or fresh samples), relics (cultural/religious objects)
  UPDATE public.questions SET mc_options = '["Artifacts", "Specimens", "Relics"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Evidence for Evolution' AND point_value = 100;

  -- 200: correct = "Homologous structures"
  -- Errors: analogous structures (similar function, different origin — classic reversal error), vestigial structures (reduced remnants), derived structures (not a standard term)
  UPDATE public.questions SET mc_options = '["Analogous structures", "Vestigial structures", "Derived structures"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Evidence for Evolution' AND point_value = 200;

  -- 300: correct = "Remnants of structures that had functions in ancestors but are reduced or no longer functional"
  -- Errors: convergent evolution (structures evolving independently), homologous structures (shared anatomy from common ancestor), analogous structures (similar function, different origin)
  UPDATE public.questions SET mc_options = '["Structures that evolved independently in unrelated species", "Shared body parts inherited from a common ancestor", "Structures with similar function but different evolutionary origin"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Evidence for Evolution' AND point_value = 300;

  -- 400: correct = "Molecular evidence"
  -- Errors: fossil evidence (physical remains, not DNA), anatomical evidence (body structures), behavioral evidence (actions)
  UPDATE public.questions SET mc_options = '["Fossil evidence", "Anatomical evidence", "Behavioral evidence"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Evidence for Evolution' AND point_value = 400;

  -- 500: correct = "They share a common ancestor"
  -- Errors: similar aquatic environments (environment doesn't cause embryo similarity), no early specialization needed (doesn't explain it), similar environmental pressures (wrong causal logic)
  UPDATE public.questions SET mc_options = '["They all live in similar aquatic environments", "Embryos require no specialized features early in development", "They experience similar environmental pressures during development"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Evidence for Evolution' AND point_value = 500;

  -- ── Mechanisms of Evolution ───────────────────────────────────────────────

  -- 100: correct = "Mutation"
  -- Errors: recombination (shuffles existing genes, not a new change), replication (copying DNA unchanged), transcription (DNA to RNA, not a DNA change)
  UPDATE public.questions SET mc_options = '["Recombination", "Replication", "Transcription"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Mechanisms of Evolution' AND point_value = 100;

  -- 200: correct = "Random changes in allele frequencies in a population"
  -- Errors: gene flow (movement between populations), natural selection (fitness-based, not random), directional selection (favors one extreme — also not random drift)
  UPDATE public.questions SET mc_options = '["Movement of genes between populations through migration", "Selection of beneficial traits by the environment", "Increase in allele frequency due to reproductive advantage"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Mechanisms of Evolution' AND point_value = 200;

  -- 300: correct = "A drastic reduction in population size due to environmental events, reducing genetic diversity"
  -- Errors: founder effect (small group colonizes new area — classic swap), random mating changes (not a mechanism name), directional selection (different mechanism entirely)
  UPDATE public.questions SET mc_options = '["When a small group of individuals colonizes a new area", "When allele frequencies change due to random mating", "When natural selection strongly favors one extreme phenotype"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Mechanisms of Evolution' AND point_value = 300;

  -- 400: correct = "Movement of genes between populations through migration, which increases genetic diversity"
  -- Errors: genetic drift (random allele changes), heredity (parent-to-offspring, not between populations), mutation (new alleles, not movement of existing alleles)
  UPDATE public.questions SET mc_options = '["Random changes in allele frequencies due to chance events", "Transfer of genetic information from parent to offspring", "The process by which new alleles arise through DNA changes"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Mechanisms of Evolution' AND point_value = 400;

  -- 500: correct = "Founder effect occurs when a small group establishes a new population with limited genetic diversity; bottleneck effect is caused by environmental disaster in existing population"
  -- Errors: definitions swapped (classic reversal), both affect large populations (wrong — both affect small), mechanisms reversed (wrong causal logic for each)
  UPDATE public.questions SET mc_options = '["Founder effect is caused by environmental disasters; bottleneck occurs when a small group colonizes a new area", "Both effects describe reduced genetic variation in large populations", "Founder effect reduces diversity through selection; bottleneck effect reduces diversity through isolation"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Mechanisms of Evolution' AND point_value = 500;

  -- ── Natural Selection ─────────────────────────────────────────────────────

  -- 100: correct = "Natural selection"
  -- Errors: artificial selection (human-directed), genetic drift (random, not fitness-based), speciation (result of evolution, not the mechanism)
  UPDATE public.questions SET mc_options = '["Artificial selection", "Genetic drift", "Speciation"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Natural Selection' AND point_value = 100;

  -- 200: correct = "Variation"
  -- Errors: geographic isolation (drives speciation, not natural selection itself), stable environment (actually change often drives selection), large population size (small populations can still have natural selection)
  UPDATE public.questions SET mc_options = '["Geographic isolation", "Stable environment", "Large population size"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Natural Selection' AND point_value = 200;

  -- 300: correct = "Variation, inheritance, overproduction of offspring, and differential survival/reproduction"
  -- Errors: four forces of evolution (different concept entirely), selection pressures (causes of selection, not its conditions), variation + wrong others
  UPDATE public.questions SET mc_options = '["Mutation, gene flow, genetic drift, and natural selection", "Competition, predation, disease, and climate change", "Variation, isolation, time, and reproductive success"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Natural Selection' AND point_value = 300;

  -- 400: correct = "Natural selection acts on individuals, but evolution occurs in populations"
  -- Errors: levels swapped (classic reversal), both at population level (natural selection acts on individuals, not populations), both at individual level (evolution occurs in populations)
  UPDATE public.questions SET mc_options = '["Natural selection acts on populations, but evolution occurs in individuals", "Both natural selection and evolution occur at the level of populations", "Both natural selection and evolution occur at the level of individuals"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Natural Selection' AND point_value = 400;

  -- 500: correct = "Directional selection"
  -- Errors: stabilizing selection (favors intermediate phenotypes), disruptive selection (favors both extremes over intermediate), balancing selection (maintains multiple alleles)
  UPDATE public.questions SET mc_options = '["Stabilizing selection", "Disruptive selection", "Balancing selection"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Natural Selection' AND point_value = 500;

  -- ── Patterns & Tempo of Evolution ────────────────────────────────────────

  -- 100: correct = "Analogous structures"
  -- Errors: homologous structures (similar anatomy, shared origin — classic reversal), vestigial structures (reduced remnants), primitive structures (not a standard term)
  UPDATE public.questions SET mc_options = '["Homologous structures", "Vestigial structures", "Primitive structures"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Patterns & Tempo of Evolution' AND point_value = 100;

  -- 200: correct = "When two or more species evolve together in response to each other"
  -- Errors: adaptive radiation after extinction (different concept), general natural selection (not specific to interspecies response), divergent evolution (populations of same species, not different species responding)
  UPDATE public.questions SET mc_options = '["When a species rapidly evolves after a mass extinction event", "When a population changes gene frequencies due to natural selection", "When two isolated populations of the same species evolve separately"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Patterns & Tempo of Evolution' AND point_value = 200;

  -- 300: correct = "Punctuated equilibrium"
  -- Errors: phyletic gradualism (slow steady change — the opposing model), adaptive radiation (diversification, not a tempo model), parallel evolution (related species, different concept)
  UPDATE public.questions SET mc_options = '["Phyletic gradualism", "Adaptive radiation", "Parallel evolution"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Patterns & Tempo of Evolution' AND point_value = 300;

  -- 400: correct = "Species are groups that can interbreed and produce fertile offspring; limitation is it cannot be applied to extinct or asexual organisms"
  -- Errors: morphological species concept, genetic/phylogenetic concept, ecological concept — all legitimate alternative species concepts
  UPDATE public.questions SET mc_options = '["Species defined by morphological similarity; limitation is that appearance can be deceiving", "Species defined by shared DNA sequences; limitation is that DNA data is unavailable for most organisms", "Species that share an ecological niche; limitation is that niches change over time"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Patterns & Tempo of Evolution' AND point_value = 400;

  -- 500: correct = "Earth is about 4.6 billion years old; first life appeared about 3.5-3.8 billion years ago"
  -- Errors: correct Earth age but first life only ~1 bya, wrong Earth age (2 bya), correct Earth age but Cambrian explosion (~542 mya) confused for first life
  UPDATE public.questions SET mc_options = '["Earth is ~4.6 billion years old; first life appeared ~1 billion years ago", "Earth is ~2 billion years old; first life appeared ~500 million years ago", "Earth is ~4.6 billion years old; first life appeared ~542 million years ago"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Patterns & Tempo of Evolution' AND point_value = 500;

  -- ── Speciation & Diversity ────────────────────────────────────────────────

  -- 100: correct = "Speciation"
  -- Errors: adaptation (adjustment to environment, not new species), extinction (death of a species — opposite), evolution (broader term, not specifically species formation)
  UPDATE public.questions SET mc_options = '["Adaptation", "Extinction", "Evolution"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Speciation & Diversity' AND point_value = 100;

  -- 200: correct = "Reproductive isolation"
  -- Errors: geographic isolation (a cause of isolation, not the barrier mechanism itself), genetic drift (random allele changes), natural selection (survival advantage, not a reproductive barrier)
  UPDATE public.questions SET mc_options = '["Geographic isolation", "Genetic drift", "Natural selection"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Speciation & Diversity' AND point_value = 200;

  -- 300: correct = "Allopatric speciation"
  -- Errors: sympatric speciation (without geographic separation — direct opposite), parapatric speciation (adjacent populations with some contact), artificial selection (human-directed, not a speciation type)
  UPDATE public.questions SET mc_options = '["Sympatric speciation", "Parapatric speciation", "Artificial selection"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Speciation & Diversity' AND point_value = 300;

  -- 400: correct = "Adaptive radiation"
  -- Errors: convergent evolution (unrelated species converge on similar traits), coevolution (species evolving in response to each other), parallel evolution (related species evolving similar traits independently)
  UPDATE public.questions SET mc_options = '["Convergent evolution", "Coevolution", "Parallel evolution"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Speciation & Diversity' AND point_value = 400;

  -- 500: correct = "Convergent evolution produces similar traits in unrelated species; divergent evolution produces different traits in related species"
  -- Errors: definitions reversed (classic swap), rate claim is wrong and irrelevant, wrong species-level effects for each
  UPDATE public.questions SET mc_options = '["Convergent evolution produces different traits in related species; divergent evolution produces similar traits in unrelated species", "Convergent evolution occurs faster than divergent evolution due to environmental pressure", "Convergent evolution produces new species; divergent evolution produces only variation within a species"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Speciation & Diversity' AND point_value = 500;

END $$;

-- Verify all 35 questions now have mc_options
DO $$
DECLARE
  v_nulls INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_nulls
  FROM public.questions q
  JOIN public.question_banks b ON q.bank_id = b.id
  WHERE b.title = 'Evolution & Natural Selection'
    AND q.mc_options IS NULL;

  IF v_nulls > 0 THEN
    RAISE EXCEPTION 'mc_options seed incomplete: % questions still NULL in Evolution & Natural Selection', v_nulls;
  END IF;

  RAISE NOTICE 'OK: all questions in Evolution & Natural Selection now have mc_options';
END $$;
