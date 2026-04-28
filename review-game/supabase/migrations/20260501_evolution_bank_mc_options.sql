-- Migration: Seed mc_options (wrong answers) for Evolution question bank
-- Purpose: Enables the Evolution: High School Biology prebuilt bank for pub trivia mode.
--          Each question receives exactly 3 plausible wrong answers stored in mc_options.
--          At runtime, mc_options + answer_text are shuffled into 4 choices for players.
-- Depends on: 20260424_evolution_question_bank.sql, 20260426_questions_mc_options.sql
-- Date: 2026-05-01

DO $$
DECLARE
  v_bank_id UUID;
BEGIN

  -- Idempotency guard: skip if mc_options already seeded for this bank
  SELECT q.bank_id INTO v_bank_id
  FROM public.questions q
  JOIN public.question_banks b ON q.bank_id = b.id
  WHERE b.title = 'Evolution: High School Biology'
    AND q.mc_options IS NOT NULL
  LIMIT 1;

  IF v_bank_id IS NOT NULL THEN
    RAISE NOTICE 'mc_options already seeded for Evolution bank -- skipping.';
    RETURN;
  END IF;

  SELECT id INTO v_bank_id
  FROM public.question_banks
  WHERE title = 'Evolution: High School Biology'
    AND is_public = true;

  IF v_bank_id IS NULL THEN
    RAISE EXCEPTION 'Evolution question bank not found -- run 20260424_evolution_question_bank.sql first';
  END IF;

  -- =========================================================
  -- CATEGORY 1: Fossil Record
  -- =========================================================

  -- 100: correct = "The fossil record"
  UPDATE public.questions SET mc_options = '["The stratigraphic index", "The paleontological archive", "The geological timeline"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Fossil Record' AND point_value = 100;

  -- 200: correct = "The Law of Superposition"
  UPDATE public.questions SET mc_options = '["The Law of Original Horizontality", "The Principle of Cross-Cutting Relationships", "The Law of Uniformitarianism"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Fossil Record' AND point_value = 200;

  -- 300: correct = "Relative dating"
  UPDATE public.questions SET mc_options = '["Absolute dating", "Radiometric dating", "Index fossil dating"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Fossil Record' AND point_value = 300;

  -- 400: correct = "Transitional fossils"
  UPDATE public.questions SET mc_options = '["Index fossils", "Living fossils", "Trace fossils"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Fossil Record' AND point_value = 400;

  -- 500: correct = "Fossilization requires specific conditions and is rare..."
  UPDATE public.questions SET mc_options = '[
    "The student is correct -- gaps in the fossil record are a genuine problem for evolutionary theory. Scientists address this with punctuated equilibrium, which proposes rapid bursts of change that leave no fossils.",
    "Gaps exist because paleontologists have not yet excavated enough sites. Given enough time and funding, the fossil record will eventually be complete and gap-free.",
    "The fossil record is actually considered complete for the major animal groups. The gaps the student refers to are in plant and microbial lineages, which do not challenge animal evolution."
  ]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Fossil Record' AND point_value = 500;

  -- =========================================================
  -- CATEGORY 2: Dating Methods
  -- =========================================================

  -- 100: correct = "A half-life"
  UPDATE public.questions SET mc_options = '["A decay rate", "A nuclear period", "A radioactive interval"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Dating Methods' AND point_value = 100;

  -- 200: correct = "12.5%"
  UPDATE public.questions SET mc_options = '["25%", "6.25%", "37.5%"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Dating Methods' AND point_value = 200;

  -- 300: correct = "2 half-lives have passed: 2 x 5,730 = approximately 11,460 years old"
  UPDATE public.questions SET mc_options = '[
    "1 half-life has passed: 1 x 5,730 = approximately 5,730 years old",
    "3 half-lives have passed: 3 x 5,730 = approximately 17,190 years old",
    "4 half-lives have passed: 4 x 5,730 = approximately 22,920 years old"
  ]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Dating Methods' AND point_value = 300;

  -- 400: correct = "3 half-lives have passed: 3 x 4.5 billion = approximately 13.5 billion years old"
  UPDATE public.questions SET mc_options = '[
    "2 half-lives have passed: 2 x 4.5 billion = approximately 9 billion years old",
    "4 half-lives have passed: 4 x 4.5 billion = approximately 18 billion years old",
    "1 half-life has passed: 1 x 4.5 billion = approximately 4.5 billion years old"
  ]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Dating Methods' AND point_value = 400;

  -- 500: correct = "Uranium-lead for the dinosaur bone... Carbon-14 for the charcoal..."
  UPDATE public.questions SET mc_options = '[
    "Carbon-14 for both samples -- it is the most precise radiometric method, and its short half-life provides higher resolution dates regardless of sample age.",
    "Carbon-14 for the dinosaur bone (bones preserve organic carbon); uranium-lead for the charcoal (charcoal lacks uranium and must be dated by its lead content).",
    "Uranium-lead for both samples -- its 4.5-billion-year half-life provides a wide enough range to accurately date anything from 10,000 years to billions of years."
  ]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Dating Methods' AND point_value = 500;

  -- =========================================================
  -- CATEGORY 3: Evidence for Evolution
  -- =========================================================

  -- 100: correct = "Homologous structures -- they indicate common ancestry"
  UPDATE public.questions SET mc_options = '[
    "Analogous structures -- they indicate convergent evolution toward similar functions",
    "Vestigial structures -- they are non-functional remnants of ancestral limbs",
    "Conserved structures -- they indicate that the same function has been preserved across lineages"
  ]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Evidence for Evolution' AND point_value = 100;

  -- 200: correct = "Analogous structures"
  UPDATE public.questions SET mc_options = '["Homologous structures", "Vestigial structures", "Conserved structures"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Evidence for Evolution' AND point_value = 200;

  -- 300: correct = "Vestigial structures"
  UPDATE public.questions SET mc_options = '["Homologous structures", "Analogous structures", "Atavistic structures"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Evidence for Evolution' AND point_value = 300;

  -- 400: correct = "It indicates conserved developmental genetic programs inherited from a common ancestor..."
  UPDATE public.questions SET mc_options = '[
    "It proves that all vertebrates pass through the same evolutionary stages during development, literally replaying their evolutionary history in the womb (ontogeny recapitulates phylogeny).",
    "It shows that gill slits and tails are vestigial structures in mammals, meaning they once had full function and are slowly being eliminated by stabilizing selection.",
    "It indicates that environmental factors during early development trigger expression of ancient genes, causing embryos to temporarily resemble their ancestors."
  ]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Evidence for Evolution' AND point_value = 400;

  -- 500: correct = "Fewer molecular differences indicate a more recent common ancestor..."
  UPDATE public.questions SET mc_options = '[
    "More molecular differences indicate a more recent common ancestor. Humans and yeast are more closely related than they appear because cytochrome c performs the same function across eukaryotes.",
    "The 44 amino acid difference reveals that yeast accumulates mutations 44 times faster than chimpanzees per generation, not that the lineages diverged at different times.",
    "Cytochrome c differences reflect ecological distance rather than evolutionary relatedness. Humans and chimps occupy similar ecological niches, which explains their near-identical protein sequences."
  ]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Evidence for Evolution' AND point_value = 500;

  -- =========================================================
  -- CATEGORY 4: Natural Selection
  -- =========================================================

  -- 100: correct = "Overproduction, heritable variation, competition for limited resources, and differential survival and reproduction"
  UPDATE public.questions SET mc_options = '[
    "Mutation, genetic drift, gene flow, and natural selection -- the four evolutionary forces",
    "Random variation, environmental pressure, genetic recombination, and reproductive isolation",
    "Overproduction, random mutation, geographic isolation, and differential reproduction"
  ]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Natural Selection' AND point_value = 100;

  -- 200: correct = "Stabilizing selection"
  UPDATE public.questions SET mc_options = '["Directional selection", "Disruptive selection", "Balancing selection"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Natural Selection' AND point_value = 200;

  -- 300: correct = "Directional selection"
  UPDATE public.questions SET mc_options = '["Stabilizing selection", "Disruptive selection", "Artificial selection"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Natural Selection' AND point_value = 300;

  -- 400: correct = "Disruptive selection"
  UPDATE public.questions SET mc_options = '["Directional selection", "Balancing selection", "Stabilizing selection"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Natural Selection' AND point_value = 400;

  -- 500: correct = "The antibiotic is a selective filter, not a mutagen..."
  UPDATE public.questions SET mc_options = '[
    "The statement is correct -- antibiotics chemically interact with bacterial DNA, triggering point mutations that disable the antibiotic target. This is why resistance develops specifically to the antibiotic being used.",
    "The statement is partially correct: the antibiotic causes resistance in bacteria with weaker defenses, while those with stronger immune responses survive. Resistance is therefore environmentally induced.",
    "The antibiotic causes resistance indirectly by damaging bacterial cell walls, forcing surviving cells to produce new structural proteins that also happen to block the antibiotic."
  ]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Natural Selection' AND point_value = 500;

  -- =========================================================
  -- CATEGORY 5: Hardy-Weinberg
  -- =========================================================

  -- 100: correct = "p = frequency of the dominant allele (A); q = frequency of the recessive allele (a); p + q = 1"
  UPDATE public.questions SET mc_options = '[
    "p = frequency of the recessive allele (a); q = frequency of the dominant allele (A); p + q = 1",
    "p = frequency of the homozygous dominant genotype (AA); q = frequency of the homozygous recessive genotype (aa); p + q = 1",
    "p = frequency of the dominant phenotype; q = frequency of the recessive phenotype; p + q must equal 0.5 in equilibrium"
  ]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Hardy-Weinberg' AND point_value = 100;

  -- 200: correct = "Mutation, genetic drift, gene flow, non-random mating, and natural selection"
  UPDATE public.questions SET mc_options = '[
    "Mutation, genetic drift, geographic isolation, inbreeding, and artificial selection",
    "Natural selection, sexual selection, migration, founder effect, and bottleneck effect",
    "Mutation, recombination, gene flow, population growth, and random mating"
  ]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Hardy-Weinberg' AND point_value = 200;

  -- 300: correct = "q^2 = 0.09 -> q = 0.3; p = 1 - 0.3 = 0.7; 2pq = 2(0.7)(0.3) = 0.42"
  UPDATE public.questions SET mc_options = '[
    "q^2 = 0.09 -> q = 0.09; p = 0.91; 2pq = 2(0.91)(0.09) = 0.164",
    "q^2 = 0.09 -> q = 0.3; p = 0.7; 2pq = 2(0.7)(0.3)^2 = 0.063",
    "q^2 = 0.09 -> q = 0.45; p = 0.55; 2pq = 2(0.55)(0.45) = 0.495"
  ]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Hardy-Weinberg' AND point_value = 300;

  -- 400: correct = "q^2 = 64/400 = 0.16 -> q = 0.4 -> p = 0.6 -> 2pq = 0.48 -> 192 heterozygous individuals"
  UPDATE public.questions SET mc_options = '[
    "q^2 = 64/400 = 0.16 -> q = 0.4 -> p = 0.6 -> 2pq = 0.48 -> 0.48 x 400 = 96 heterozygous individuals",
    "q^2 = 64/400 = 0.16 -> q = 0.16 -> p = 0.84 -> 2pq = 2(0.84)(0.16) = 0.269 -> 0.269 x 400 = 108 heterozygous individuals",
    "q^2 = 64/400 = 0.16 -> q = 0.4 -> p = 0.6 -> 2pq = 2(0.6)(0.4) = 0.48 -> 0.48 x 64 = 31 heterozygous individuals"
  ]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Hardy-Weinberg' AND point_value = 400;

  -- 500: correct = "Natural selection is the only non-random force -- it systematically favors alleles..."
  UPDATE public.questions SET mc_options = '[
    "Genetic drift is the only non-random force -- it systematically removes the least-fit alleles from a population over time, while natural selection acts randomly on which individuals happen to reproduce.",
    "Gene flow is the only non-random force -- it predictably introduces new alleles from outside the population in a direction determined by migration patterns and geographic proximity.",
    "Mutation is the only non-random force -- it introduces new alleles in a predictable direction based on the chemical structure of DNA and the cell''s repair machinery."
  ]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Hardy-Weinberg' AND point_value = 500;

  -- =========================================================
  -- CATEGORY 6: Speciation
  -- =========================================================

  -- 100: correct = "A species is a group that can interbreed and produce fertile offspring..."
  UPDATE public.questions SET mc_options = '[
    "A species is a group that shares the same ecological niche and body plan. Two groups are separate species when their morphology differs enough that taxonomists classify them separately.",
    "A species is defined by a unique DNA sequence distinguishing it from all other organisms. Two groups are separate species when their genomes differ by more than 2%.",
    "A species is a group that shares a common ancestor. Two groups are considered separate species when they have not shared a common ancestor for more than 10,000 generations."
  ]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Speciation' AND point_value = 100;

  -- 200: correct = "Allopatric: a geographic barrier separates populations... Sympatric: within the same geographic range..."
  UPDATE public.questions SET mc_options = '[
    "Allopatric: speciation within the same geographic range through polyploidy or niche partitioning. Sympatric: a physical barrier such as a mountain range or river separates two populations.",
    "Allopatric and sympatric speciation are essentially identical -- both require reproductive isolation, and whether or not a geographic barrier is present does not affect the evolutionary outcome.",
    "Allopatric: two formerly separate populations merge after a barrier is removed, creating a new hybrid species. Sympatric: competition within the same habitat drives two populations apart until they cannot interbreed."
  ]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Speciation' AND point_value = 200;

  -- 300: correct = "Prezygotic isolating mechanisms (they act before the zygote is formed)"
  UPDATE public.questions SET mc_options = '[
    "Postzygotic isolating mechanisms (they act after fertilization has occurred)",
    "Behavioral isolating mechanisms (they act exclusively on mate choice and courtship signals)",
    "Geographic isolating mechanisms (they act by separating populations in physical space)"
  ]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Speciation' AND point_value = 300;

  -- 400: correct = "Postzygotic isolation -- specifically hybrid sterility. It acts after fertilization..."
  UPDATE public.questions SET mc_options = '[
    "Prezygotic isolation -- specifically mechanical isolation. It acts before fertilization because horse and donkey gametes are structurally incompatible and cannot fuse.",
    "Prezygotic isolation -- specifically behavioral isolation. Horses and donkeys have incompatible courtship displays and would not mate without human intervention.",
    "Postzygotic isolation -- specifically hybrid inviability. The mule cannot survive past early development due to an incompatible chromosome count from both parents."
  ]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Speciation' AND point_value = 400;

  -- 500: correct = "Sympatric because no geographic barrier separated them. The chromosome mismatch causes prezygotic isolation..."
  UPDATE public.questions SET mc_options = '[
    "Allopatric because the genome duplication event creates a chromosomal barrier as effective as any geographic barrier. The isolation is postzygotic -- sterile triploid hybrids are produced after fertilization, not before.",
    "Sympatric because they share a geographic range. The isolation is postzygotic -- triploid hybrids are produced but are sterile, so the new tetraploid is isolated by hybrid sterility acting after fertilization.",
    "Allopatric because the tetraploid occupies a different microhabitat. The isolation is both pre- and postzygotic equally, since gametic incompatibility and hybrid sterility both contribute to the barrier."
  ]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Speciation' AND point_value = 500;

  -- =========================================================
  -- CATEGORY 7: Phylogenetics & Vocab
  -- =========================================================

  -- 100: correct = "A common ancestor shared by all lineages that branch from that node"
  UPDATE public.questions SET mc_options = '[
    "An extinction event that caused two lineages to diverge at that point in time",
    "The most recent species to appear in that lineage before the next branching event",
    "A mutation event that introduced a new shared derived character into the lineage"
  ]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Phylogenetics & Vocab' AND point_value = 100;

  -- 200: correct = "A clade"
  UPDATE public.questions SET mc_options = '["A grade", "A paraphyletic group", "A taxon"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Phylogenetics & Vocab' AND point_value = 200;

  -- 300: correct = "Reproductive success -- the number of offspring an individual contributes to the next generation"
  UPDATE public.questions SET mc_options = '[
    "Survival ability -- the capacity to resist disease, predation, and environmental stress over a lifetime",
    "Physical strength -- the ability to outcompete rivals in direct contests for resources and mates",
    "Metabolic efficiency -- the ability to extract maximum energy from available food resources"
  ]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Phylogenetics & Vocab' AND point_value = 300;

  -- 400: correct = "Bottleneck: a population crash randomly kills most individuals... Founder effect: a small group colonizes a new area..."
  UPDATE public.questions SET mc_options = '[
    "Bottleneck: a small group colonizes a new area carrying only a subset of the original alleles. Founder effect: a population crash randomly eliminates most individuals. The two terms describe opposite scenarios.",
    "Bottleneck and founder effect are identical -- both describe allele loss due to small population size, and the two terms are used interchangeably in population genetics.",
    "Bottleneck: selective pressure causes rapid adaptation, reducing genetic variation to the best-fit alleles. Founder effect: geographic isolation creates a separate lineage that diverges via natural selection."
  ]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Phylogenetics & Vocab' AND point_value = 400;

  -- 500: correct = "Evolution is measured in generations, not years. Each generation is an opportunity for selection and mutation to act..."
  UPDATE public.questions SET mc_options = '[
    "Evolution is measured in calendar years, not generations. Bacteria appear to evolve faster because their mutation rate per year is higher than that of large mammals, not because they reproduce more quickly.",
    "Bacteria evolve faster because they lack a nucleus, allowing mutations to directly alter protein production without the delays introduced by transcription, splicing, and nuclear transport.",
    "Large body size requires more energy to maintain, leaving fewer metabolic resources for reproduction. This energetic constraint -- not generation time -- is the primary driver of slower evolution in large mammals."
  ]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Phylogenetics & Vocab' AND point_value = 500;

END $$;

-- =========================================================
-- Verify all 35 questions now have mc_options
-- =========================================================
DO $$
DECLARE
  v_null_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_null_count
  FROM public.questions q
  JOIN public.question_banks b ON q.bank_id = b.id
  WHERE b.title = 'Evolution: High School Biology'
    AND q.mc_options IS NULL;

  IF v_null_count > 0 THEN
    RAISE EXCEPTION 'mc_options seed incomplete: % questions still have NULL mc_options', v_null_count;
  END IF;

  RAISE NOTICE 'Evolution bank mc_options seeded successfully -- all 35 questions ready for pub trivia.';
END $$;
