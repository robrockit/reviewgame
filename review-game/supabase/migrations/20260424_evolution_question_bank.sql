-- Migration: High School Biology -- Evolution Question Bank
-- Purpose: Seed a public prebuilt question bank covering the HS-LS4 evolution unit
-- Topics: Fossil Record, Dating Methods, Evidence for Evolution, Natural Selection,
--         Hardy-Weinberg Equilibrium, Speciation, and Phylogenetics & Vocabulary
-- Standards: HS-LS4-1 through HS-LS4-5 (NGSS)
-- Date: 2026-04-24

DO $$
DECLARE
  bank_id UUID;
BEGIN

-- =========================================================
-- 1. Insert the question bank (prebuilt, public, no owner)
-- =========================================================

INSERT INTO public.question_banks (
  owner_id,
  title,
  subject,
  description,
  difficulty,
  is_public,
  is_custom
) VALUES (
  NULL,
  'Evolution: High School Biology',
  'Biology',
  'A 35-question Jeopardy-style review bank covering the HS-LS4 evolution unit: '
  'fossil record and dating methods, anatomical and molecular evidence for evolution, '
  'natural selection and its three modes, Hardy-Weinberg equilibrium, speciation, '
  'and phylogenetics. Aligned to NGSS HS-LS4-1 through HS-LS4-5.',
  'medium',
  true,
  false
)
RETURNING id INTO bank_id;

-- =========================================================
-- 2. Insert all 35 questions (7 categories x 5 point values)
--    position 1-35 preserves category/point-value order
-- =========================================================

INSERT INTO public.questions
  (bank_id, category, point_value, question_text, answer_text, position)
VALUES

-- ---------------------------------------------------------
-- CATEGORY 1: Fossil Record
-- ---------------------------------------------------------

(bank_id, 'Fossil Record', 100,
  'This term describes the complete collection of all known fossils and provides a timeline of life on Earth.',
  'The fossil record',
  1),

(bank_id, 'Fossil Record', 200,
  'The principle stating that in undisturbed rock layers, deeper layers are older and shallower layers are younger.',
  'The Law of Superposition',
  2),

(bank_id, 'Fossil Record', 300,
  'This method of dating determines whether one fossil is older or younger than another based on its position in rock layers, without giving an exact age.',
  'Relative dating',
  3),

(bank_id, 'Fossil Record', 400,
  'Tiktaalik (features of both fish and tetrapods) and Archaeopteryx (features of both dinosaurs and birds) are classic examples of this type of fossil.',
  'Transitional fossils',
  4),

(bank_id, 'Fossil Record', 500,
  'A student argues: "Gaps in the fossil record disprove evolution." Explain why this is incorrect.',
  'Fossilization requires specific conditions and is rare. Gaps reflect preservation bias, not the absence of evolutionary change. The overall pattern across thousands of sites worldwide is consistent with evolution.',
  5),

-- ---------------------------------------------------------
-- CATEGORY 2: Dating Methods
-- ---------------------------------------------------------

(bank_id, 'Dating Methods', 100,
  'The time it takes for exactly half of a radioactive isotope to decay into its daughter product.',
  'A half-life',
  6),

(bank_id, 'Dating Methods', 200,
  'After 3 half-lives, what percentage of the original radioactive isotope remains?',
  '12.5%',
  7),

(bank_id, 'Dating Methods', 300,
  'A sample retains 25% of its original carbon-14. Carbon-14 has a half-life of approximately 5,730 years. How old is the sample?',
  '2 half-lives have passed: 2 x 5,730 = approximately 11,460 years old',
  8),

(bank_id, 'Dating Methods', 400,
  'A rock retains 12.5% of its original uranium. Uranium-lead has a half-life of ~4.5 billion years. How old is the rock, and how many half-lives have passed?',
  '3 half-lives have passed: 3 x 4.5 billion = approximately 13.5 billion years old',
  9),

(bank_id, 'Dating Methods', 500,
  'A scientist wants to date a 200-million-year-old dinosaur bone and a 10,000-year-old piece of charcoal. Which dating method is appropriate for each, and why?',
  'Uranium-lead for the dinosaur bone (half-life ~4.5 billion years; C-14 decays completely by ~50,000 years). Carbon-14 for the charcoal (half-life ~5,730 years; effective up to ~50,000 years). Match the half-life to the age range of the sample.',
  10),

-- ---------------------------------------------------------
-- CATEGORY 3: Evidence for Evolution
-- ---------------------------------------------------------

(bank_id, 'Evidence for Evolution', 100,
  'The human arm, bat wing, whale flipper, and horse leg share the same underlying bone arrangement but serve different functions. What type of structures are these, and what do they indicate?',
  'Homologous structures -- they indicate common ancestry',
  11),

(bank_id, 'Evidence for Evolution', 200,
  'A bird wing and a butterfly wing both enable flight but have completely different underlying structures. These indicate convergent evolution, NOT common ancestry. What are they called?',
  'Analogous structures',
  12),

(bank_id, 'Evidence for Evolution', 300,
  'The human coccyx and whale pelvic bones are reduced, non-functional remnants of structures that served a purpose in ancestors. What are they called?',
  'Vestigial structures',
  13),

(bank_id, 'Evidence for Evolution', 400,
  'All vertebrate embryos develop gill slits and tails during early development, even in species that lack these structures as adults. What does this embryological evidence suggest?',
  'It indicates conserved developmental genetic programs inherited from a common ancestor -- evidence of shared ancestry among all vertebrates.',
  14),

(bank_id, 'Evidence for Evolution', 500,
  'Humans and chimpanzees differ by 0 amino acids in the cytochrome c protein; humans and yeast differ by 44 amino acids. What does this molecular evidence reveal about evolutionary relationships?',
  'Fewer molecular differences indicate a more recent common ancestor. Humans and chimps share a very recent common ancestor. The human and yeast lineages diverged far earlier. Molecular similarity tracks evolutionary relatedness.',
  15),

-- ---------------------------------------------------------
-- CATEGORY 4: Natural Selection
-- ---------------------------------------------------------

(bank_id, 'Natural Selection', 100,
  'Name the four conditions that must ALL be present for natural selection to occur.',
  'Overproduction (more offspring than the environment supports), heritable variation, competition for limited resources, and differential survival and reproduction',
  16),

(bank_id, 'Natural Selection', 200,
  'In this mode of selection, intermediate phenotypes are favored and both extremes are eliminated. The mean stays the same but variance decreases. Human birth weight is an example.',
  'Stabilizing selection',
  17),

(bank_id, 'Natural Selection', 300,
  'In this mode of selection, one extreme phenotype is favored and the mean shifts in that direction. Dark moths surviving better on dark bark is an example.',
  'Directional selection',
  18),

(bank_id, 'Natural Selection', 400,
  'In this mode of selection, both extreme phenotypes are favored while the intermediate is eliminated, potentially producing a bimodal distribution. Finch beaks adapted to two distinct food types is an example.',
  'Disruptive selection',
  19),

(bank_id, 'Natural Selection', 500,
  'Correct this misconception: "The antibiotic caused the bacteria to become resistant."',
  'The antibiotic is a selective filter, not a mutagen. Resistant variants already existed before the antibiotic was introduced. The antibiotic determined which variants survived and reproduced -- it revealed pre-existing variation, not create new mutations.',
  20),

-- ---------------------------------------------------------
-- CATEGORY 5: Hardy-Weinberg
-- ---------------------------------------------------------

(bank_id, 'Hardy-Weinberg', 100,
  'In Hardy-Weinberg equations, what do p and q each represent, and what must p + q equal?',
  'p = frequency of the dominant allele (A); q = frequency of the recessive allele (a); p + q = 1',
  21),

(bank_id, 'Hardy-Weinberg', 200,
  'Name the five forces that disrupt Hardy-Weinberg equilibrium.',
  'Mutation, genetic drift, gene flow, non-random mating, and natural selection',
  22),

(bank_id, 'Hardy-Weinberg', 300,
  '9% of a population shows the recessive phenotype (aa). Calculate q, p, and the expected frequency of heterozygotes (2pq).',
  'q^2 = 0.09 -> q = 0.3; p = 1 - 0.3 = 0.7; 2pq = 2(0.7)(0.3) = 0.42',
  23),

(bank_id, 'Hardy-Weinberg', 400,
  'In a population of 400 individuals, 64 show the recessive phenotype. How many individuals are expected to be heterozygous (Aa)? Show your work.',
  'q^2 = 64/400 = 0.16 -> q = 0.4 -> p = 0.6 -> 2pq = 2(0.6)(0.4) = 0.48 -> 0.48 x 400 = 192 heterozygous individuals',
  24),

(bank_id, 'Hardy-Weinberg', 500,
  'Which of the five forces of evolution is the ONLY non-random force? Distinguish it from genetic drift and explain why this distinction matters.',
  'Natural selection is the only non-random force -- it systematically favors alleles that increase fitness, with a predictable direction. Genetic drift is random chance, most powerful in small populations. Selection produces adaptive directional change; drift can accidentally fix harmful alleles or eliminate beneficial ones.',
  25),

-- ---------------------------------------------------------
-- CATEGORY 6: Speciation
-- ---------------------------------------------------------

(bank_id, 'Speciation', 100,
  'According to the biological species concept, what defines a species, and when are two groups considered separate species?',
  'A species is a group that can interbreed and produce fertile offspring. Two groups are separate species when they are reproductively isolated.',
  26),

(bank_id, 'Speciation', 200,
  'What is the key difference between allopatric and sympatric speciation?',
  'Allopatric: a geographic barrier separates populations, preventing gene flow. Sympatric: speciation within the same geographic range -- most commonly via polyploidy in plants, producing instant reproductive isolation without any geographic barrier.',
  27),

(bank_id, 'Speciation', 300,
  'Reproductive isolating mechanisms that prevent fertilization -- such as temporal isolation (different breeding seasons) or behavioral isolation (different courtship signals) -- are classified as this type.',
  'Prezygotic isolating mechanisms (they act before the zygote is formed)',
  28),

(bank_id, 'Speciation', 400,
  'Mules are the healthy offspring of a horse and a donkey, but mules are sterile. Which type of reproductive isolating mechanism does this represent, and when does it act?',
  'Postzygotic isolation -- specifically hybrid sterility. It acts after fertilization. The hybrid survives but cannot produce offspring.',
  29),

(bank_id, 'Speciation', 500,
  'A tetraploid plant arises through genome duplication within the same geographic area as its diploid parent. Why is this sympatric speciation, and what type of reproductive isolation prevents interbreeding?',
  'Sympatric because no geographic barrier separated them. The chromosome mismatch causes prezygotic (gametic/mechanical) isolation: tetraploid x diploid crosses produce sterile triploid offspring, giving the new polyploid instant reproductive isolation.',
  30),

-- ---------------------------------------------------------
-- CATEGORY 7: Phylogenetics & Vocab
-- ---------------------------------------------------------

(bank_id, 'Phylogenetics & Vocab', 100,
  'On a phylogenetic tree, what does each branch point (node) represent?',
  'A common ancestor shared by all lineages that branch from that node',
  31),

(bank_id, 'Phylogenetics & Vocab', 200,
  'A group that includes a common ancestor and ALL of its descendants is called this.',
  'A clade',
  32),

(bank_id, 'Phylogenetics & Vocab', 300,
  'In evolutionary biology, "fitness" does NOT mean physical strength. What does it actually mean?',
  'Reproductive success -- the number of offspring an individual contributes to the next generation',
  33),

(bank_id, 'Phylogenetics & Vocab', 400,
  'Both the bottleneck effect and the founder effect are examples of genetic drift. Explain the key difference between them.',
  'Bottleneck: a population crash randomly kills most individuals, reducing genetic variation by chance. Founder effect: a small group colonizes a new area, carrying only a subset of the original population''s alleles. Both reduce diversity by chance, but their triggers differ.',
  34),

(bank_id, 'Phylogenetics & Vocab', 500,
  'Bacteria evolve antibiotic resistance in days; large mammals take thousands of generations for comparable change. Explain why generation time -- not time itself -- determines the pace of evolution.',
  'Evolution is measured in generations, not years. Each generation is an opportunity for selection and mutation to act. Bacteria reproduce in minutes to hours -- thousands of generations in days. Shorter generation time = more selection cycles per unit of time = faster evolution.',
  35);

END $$;

-- =========================================================
-- Verify the import
-- =========================================================
SELECT 'Bank inserted: ' || title AS result
FROM public.question_banks
WHERE title = 'Evolution: High School Biology' AND is_public = true;

SELECT 'Questions inserted: ' || COUNT(*) AS result
FROM public.questions q
JOIN public.question_banks b ON q.bank_id = b.id
WHERE b.title = 'Evolution: High School Biology';
