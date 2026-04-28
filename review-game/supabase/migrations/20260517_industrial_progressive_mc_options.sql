-- Migration: mc_options for "Industrial America & Progressive Era" bank
-- Purpose: Seeds 3 wrong-answer options for all 35 questions so this bank
--          can be used in Quick Fire (pub_trivia) mode.
-- Depends on: 20260426_questions_mc_options.sql (mc_options column)
-- Date: 2026-05-17

DO $$
DECLARE
  v_bank_id UUID;
BEGIN

  SELECT id INTO v_bank_id
  FROM public.question_banks
  WHERE title = 'Industrial America & Progressive Era'
    AND is_public = true;

  IF v_bank_id IS NULL THEN
    RAISE EXCEPTION 'Industrial America & Progressive Era bank not found';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.questions
    WHERE bank_id = v_bank_id
      AND mc_options IS NOT NULL
  ) THEN
    RAISE NOTICE 'Industrial America & Progressive Era mc_options already seeded -- skipping';
    RETURN;
  END IF;

  -- ── Immigration & Urbanization ───────────────────────────────────────────

  -- 100: correct = "Ellis Island"
  UPDATE public.questions SET mc_options = '["Angel Island", "Liberty Island", "Governor''s Island"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Immigration & Urbanization' AND point_value = 100;

  -- 200: correct = "Angel Island"
  UPDATE public.questions SET mc_options = '["Ellis Island", "Alcatraz Island", "Mare Island"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Immigration & Urbanization' AND point_value = 200;

  -- 300: correct = "Tenements"
  UPDATE public.questions SET mc_options = '["Shanty towns", "Boarding houses", "Brownstones"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Immigration & Urbanization' AND point_value = 300;

  -- 400: correct = "Chinese Exclusion Act"
  UPDATE public.questions SET mc_options = '["Immigration Act of 1924", "Gentleman''s Agreement", "Emergency Quota Act"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Immigration & Urbanization' AND point_value = 400;

  -- 500: correct = "Urbanization"
  UPDATE public.questions SET mc_options = '["Industrialization", "Migration", "Suburbanization"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Immigration & Urbanization' AND point_value = 500;

  -- ── Imperialism ──────────────────────────────────────────────────────────

  -- 100: correct = "Imperialism"
  UPDATE public.questions SET mc_options = '["Colonialism", "Expansionism", "Nationalism"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Imperialism' AND point_value = 100;

  -- 200: correct = "Spanish-American War"
  UPDATE public.questions SET mc_options = '["Mexican-American War", "Philippine-American War", "Panama Canal War"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Imperialism' AND point_value = 200;

  -- 300: correct = "USS Maine"
  UPDATE public.questions SET mc_options = '["USS Arizona", "USS Olympia", "USS Indiana"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Imperialism' AND point_value = 300;

  -- 400: correct = "Roosevelt Corollary"
  UPDATE public.questions SET mc_options = '["Monroe Doctrine", "Platt Amendment", "Open Door Policy"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Imperialism' AND point_value = 400;

  -- 500: correct = "Panama Canal"
  UPDATE public.questions SET mc_options = '["Suez Canal", "Erie Canal", "Nicaragua Canal"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Imperialism' AND point_value = 500;

  -- ── Industrialization & Innovation ───────────────────────────────────────

  -- 100: correct = "Light bulb"
  UPDATE public.questions SET mc_options = '["Telephone", "Steam engine", "Phonograph"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Industrialization & Innovation' AND point_value = 100;

  -- 200: correct = "Andrew Carnegie"
  UPDATE public.questions SET mc_options = '["John D. Rockefeller", "J.P. Morgan", "Cornelius Vanderbilt"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Industrialization & Innovation' AND point_value = 200;

  -- 300: correct = "John D. Rockefeller"
  UPDATE public.questions SET mc_options = '["Andrew Carnegie", "J.P. Morgan", "Cornelius Vanderbilt"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Industrialization & Innovation' AND point_value = 300;

  -- 400: correct = "Vertical integration"
  UPDATE public.questions SET mc_options = '["Horizontal integration", "Monopoly", "Trust formation"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Industrialization & Innovation' AND point_value = 400;

  -- 500: correct = "Robber barons"
  UPDATE public.questions SET mc_options = '["Industrialists", "Monopolists", "Tycoons"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Industrialization & Innovation' AND point_value = 500;

  -- ── Labor Movement ───────────────────────────────────────────────────────

  -- 100: correct = "Labor union"
  UPDATE public.questions SET mc_options = '["Corporation", "Political party", "Guild"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Labor Movement' AND point_value = 100;

  -- 200: correct = "Strike"
  UPDATE public.questions SET mc_options = '["Boycott", "Lockout", "Picketing"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Labor Movement' AND point_value = 200;

  -- 300: correct = "Knights of Labor"
  UPDATE public.questions SET mc_options = '["American Federation of Labor", "Industrial Workers of the World", "Congress of Industrial Organizations"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Labor Movement' AND point_value = 300;

  -- 400: correct = "Haymarket Affair"
  UPDATE public.questions SET mc_options = '["Pullman Strike", "Homestead Strike", "Triangle Shirtwaist Fire"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Labor Movement' AND point_value = 400;

  -- 500: correct = "American Federation of Labor"
  UPDATE public.questions SET mc_options = '["Knights of Labor", "Industrial Workers of the World", "Congress of Industrial Organizations"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Labor Movement' AND point_value = 500;

  -- ── Progressive Reforms ──────────────────────────────────────────────────

  -- 100: correct = "Muckrakers"
  UPDATE public.questions SET mc_options = '["Progressives", "Reformers", "Trustbusters"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Progressive Reforms' AND point_value = 100;

  -- 200: correct = "Upton Sinclair"
  UPDATE public.questions SET mc_options = '["Jacob Riis", "Ida Tarbell", "Lincoln Steffens"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Progressive Reforms' AND point_value = 200;

  -- 300: correct = "19th Amendment"
  UPDATE public.questions SET mc_options = '["18th Amendment", "17th Amendment", "16th Amendment"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Progressive Reforms' AND point_value = 300;

  -- 400: correct = "16th Amendment"
  UPDATE public.questions SET mc_options = '["17th Amendment", "19th Amendment", "15th Amendment"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Progressive Reforms' AND point_value = 400;

  -- 500: correct = "18th Amendment"
  UPDATE public.questions SET mc_options = '["19th Amendment", "17th Amendment", "16th Amendment"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Progressive Reforms' AND point_value = 500;

  -- ── The Gilded Age ───────────────────────────────────────────────────────

  -- 100: correct = "The Gilded Age"
  UPDATE public.questions SET mc_options = '["The Progressive Era", "The Reconstruction Era", "The Industrial Age"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'The Gilded Age' AND point_value = 100;

  -- 200: correct = "Tammany Hall"
  UPDATE public.questions SET mc_options = '["Tammany Ring", "Political Machine", "Boss Tweed Ring"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'The Gilded Age' AND point_value = 200;

  -- 300: correct = "William Tweed"
  UPDATE public.questions SET mc_options = '["Fernando Wood", "William Marcy", "Richard Croker"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'The Gilded Age' AND point_value = 300;

  -- 400: correct = "Spoils system"
  UPDATE public.questions SET mc_options = '["Merit system", "Civil service", "Patronage reform"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'The Gilded Age' AND point_value = 400;

  -- 500: correct = "Pendleton Civil Service Act"
  UPDATE public.questions SET mc_options = '["Sherman Antitrust Act", "Interstate Commerce Act", "Clayton Antitrust Act"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'The Gilded Age' AND point_value = 500;

  -- ── World War I ──────────────────────────────────────────────────────────

  -- 100: correct = "1914"
  UPDATE public.questions SET mc_options = '["1912", "1916", "1917"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'World War I' AND point_value = 100;

  -- 200: correct = "Woodrow Wilson"
  UPDATE public.questions SET mc_options = '["William Howard Taft", "Theodore Roosevelt", "Warren G. Harding"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'World War I' AND point_value = 200;

  -- 300: correct = "Zimmermann Telegram and unrestricted submarine warfare"
  UPDATE public.questions SET mc_options = '["Assassination of Archduke Franz Ferdinand", "Sinking of the Lusitania in 1915", "German invasion of Belgium"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'World War I' AND point_value = 300;

  -- 400: correct = "Fourteen Points"
  UPDATE public.questions SET mc_options = '["New Freedom", "League of Nations Charter", "Peace Without Victory plan"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'World War I' AND point_value = 400;

  -- 500: correct = "Treaty of Versailles"
  UPDATE public.questions SET mc_options = '["Treaty of Paris", "Armistice Agreement", "Treaty of Brest-Litovsk"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'World War I' AND point_value = 500;

END $$;

-- Verify all 35 questions now have mc_options
DO $$
DECLARE
  v_nulls INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_nulls
  FROM public.questions q
  JOIN public.question_banks b ON q.bank_id = b.id
  WHERE b.title = 'Industrial America & Progressive Era'
    AND q.mc_options IS NULL;

  IF v_nulls > 0 THEN
    RAISE EXCEPTION 'mc_options seed incomplete: % questions still NULL in Industrial America & Progressive Era', v_nulls;
  END IF;

  RAISE NOTICE 'OK: all questions in Industrial America & Progressive Era now have mc_options';
END $$;
