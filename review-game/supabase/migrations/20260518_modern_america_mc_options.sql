-- Migration: mc_options for "Modern America" bank
-- Purpose: Seeds 3 wrong-answer options for all 35 questions so this bank
--          can be used in Quick Fire (pub_trivia) mode.
-- Depends on: 20260426_questions_mc_options.sql (mc_options column)
-- Date: 2026-05-18

DO $$
DECLARE
  v_bank_id UUID;
BEGIN

  SELECT id INTO v_bank_id
  FROM public.question_banks
  WHERE title = 'Modern America'
    AND is_public = true;

  IF v_bank_id IS NULL THEN
    RAISE EXCEPTION 'Modern America bank not found';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.questions
    WHERE bank_id = v_bank_id
      AND mc_options IS NOT NULL
  ) THEN
    RAISE NOTICE 'Modern America mc_options already seeded -- skipping';
    RETURN;
  END IF;

  -- ── 1990s ────────────────────────────────────────────────────────────────

  -- 100: correct = "Bill Clinton"
  UPDATE public.questions SET mc_options = '["George H.W. Bush", "George W. Bush", "Al Gore"]'::jsonb
  WHERE bank_id = v_bank_id AND category = '1990s' AND point_value = 100;

  -- 200: correct = "Gulf War"
  UPDATE public.questions SET mc_options = '["Iraq War", "Afghanistan War", "Iran-Iraq War"]'::jsonb
  WHERE bank_id = v_bank_id AND category = '1990s' AND point_value = 200;

  -- 300: correct = "Internet"
  UPDATE public.questions SET mc_options = '["Fax machine", "Cable television", "Satellite communication"]'::jsonb
  WHERE bank_id = v_bank_id AND category = '1990s' AND point_value = 300;

  -- 400: correct = "NAFTA"
  UPDATE public.questions SET mc_options = '["WTO", "GATT", "Trans-Pacific Partnership"]'::jsonb
  WHERE bank_id = v_bank_id AND category = '1990s' AND point_value = 400;

  -- 500: correct = "Monica Lewinsky scandal"
  UPDATE public.questions SET mc_options = '["Iran-Contra Affair", "Whitewater real estate scandal", "Travel Office controversy"]'::jsonb
  WHERE bank_id = v_bank_id AND category = '1990s' AND point_value = 500;

  -- ── 9/11 & War on Terror ─────────────────────────────────────────────────

  -- 100: correct = "September 11, 2001"
  UPDATE public.questions SET mc_options = '["September 11, 2000", "October 7, 2001", "September 12, 2001"]'::jsonb
  WHERE bank_id = v_bank_id AND category = '9/11 & War on Terror' AND point_value = 100;

  -- 200: correct = "Al-Qaeda"
  UPDATE public.questions SET mc_options = '["Taliban", "ISIS", "Hamas"]'::jsonb
  WHERE bank_id = v_bank_id AND category = '9/11 & War on Terror' AND point_value = 200;

  -- 300: correct = "George W. Bush"
  UPDATE public.questions SET mc_options = '["Bill Clinton", "Dick Cheney", "Condoleezza Rice"]'::jsonb
  WHERE bank_id = v_bank_id AND category = '9/11 & War on Terror' AND point_value = 300;

  -- 400: correct = "Patriot Act"
  UPDATE public.questions SET mc_options = '["Homeland Security Act", "Authorization for Use of Military Force", "Intelligence Reform Act"]'::jsonb
  WHERE bank_id = v_bank_id AND category = '9/11 & War on Terror' AND point_value = 400;

  -- 500: correct = "Department of Homeland Security"
  UPDATE public.questions SET mc_options = '["Central Intelligence Agency", "National Security Agency", "Transportation Security Administration"]'::jsonb
  WHERE bank_id = v_bank_id AND category = '9/11 & War on Terror' AND point_value = 500;

  -- ── Afghanistan & Iraq Wars ──────────────────────────────────────────────

  -- 100: correct = "Afghanistan"
  UPDATE public.questions SET mc_options = '["Iraq", "Pakistan", "Iran"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Afghanistan & Iraq Wars' AND point_value = 100;

  -- 200: correct = "Saddam Hussein"
  UPDATE public.questions SET mc_options = '["Muammar Gaddafi", "Mahmoud Ahmadinejad", "Bashar al-Assad"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Afghanistan & Iraq Wars' AND point_value = 200;

  -- 300: correct = "Weapons of Mass Destruction"
  UPDATE public.questions SET mc_options = '["Nuclear weapons program", "Al-Qaeda connections", "Human rights violations"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Afghanistan & Iraq Wars' AND point_value = 300;

  -- 400: correct = "2011"
  UPDATE public.questions SET mc_options = '["2009", "2013", "2007"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Afghanistan & Iraq Wars' AND point_value = 400;

  -- 500: correct = "ISIS"
  UPDATE public.questions SET mc_options = '["Al-Qaeda", "Taliban", "Hamas"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Afghanistan & Iraq Wars' AND point_value = 500;

  -- ── Contemporary Issues ──────────────────────────────────────────────────

  -- 100: correct = "Globalization"
  UPDATE public.questions SET mc_options = '["Internationalism", "Free trade", "Westernization"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Contemporary Issues' AND point_value = 100;

  -- 200: correct = "Climate change"
  UPDATE public.questions SET mc_options = '["Deforestation", "Ozone depletion", "Ocean acidification"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Contemporary Issues' AND point_value = 200;

  -- 300: correct = "China"
  UPDATE public.questions SET mc_options = '["Japan", "India", "Germany"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Contemporary Issues' AND point_value = 300;

  -- 400: correct = "Cybersecurity"
  UPDATE public.questions SET mc_options = '["Voter suppression", "Campaign finance", "Gerrymandering"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Contemporary Issues' AND point_value = 400;

  -- 500: correct = "Immigration"
  UPDATE public.questions SET mc_options = '["Affirmative action", "Gun control", "Healthcare access"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Contemporary Issues' AND point_value = 500;

  -- ── Reagan Era ───────────────────────────────────────────────────────────

  -- 100: correct = "Ronald Reagan"
  UPDATE public.questions SET mc_options = '["Jimmy Carter", "George H.W. Bush", "Gerald Ford"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Reagan Era' AND point_value = 100;

  -- 200: correct = "Reaganomics"
  UPDATE public.questions SET mc_options = '["Keynesian economics", "New Deal economics", "Demand-side economics"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Reagan Era' AND point_value = 200;

  -- 300: correct = "Berlin Wall"
  UPDATE public.questions SET mc_options = '["Iron Curtain", "Checkpoint Charlie", "Brandenburg Gate"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Reagan Era' AND point_value = 300;

  -- 400: correct = "Mikhail Gorbachev"
  UPDATE public.questions SET mc_options = '["Boris Yeltsin", "Leonid Brezhnev", "Nikita Khrushchev"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Reagan Era' AND point_value = 400;

  -- 500: correct = "1991"
  UPDATE public.questions SET mc_options = '["1989", "1993", "1985"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Reagan Era' AND point_value = 500;

  -- ── Recent Presidents ────────────────────────────────────────────────────

  -- 100: correct = "Barack Obama"
  UPDATE public.questions SET mc_options = '["Colin Powell", "Jesse Jackson", "Al Sharpton"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Recent Presidents' AND point_value = 100;

  -- 200: correct = "Affordable Care Act"
  UPDATE public.questions SET mc_options = '["Medicare Expansion Act", "National Health Insurance Act", "Patient Protection Act"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Recent Presidents' AND point_value = 200;

  -- 300: correct = "Donald Trump"
  UPDATE public.questions SET mc_options = '["Mitt Romney", "Marco Rubio", "Hillary Clinton"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Recent Presidents' AND point_value = 300;

  -- 400: correct = "Joe Biden"
  UPDATE public.questions SET mc_options = '["Kamala Harris", "Pete Buttigieg", "Bernie Sanders"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Recent Presidents' AND point_value = 400;

  -- 500: correct = "COVID-19"
  UPDATE public.questions SET mc_options = '["SARS", "H1N1 flu pandemic", "Ebola outbreak"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Recent Presidents' AND point_value = 500;

  -- ── Social & Political Changes ───────────────────────────────────────────

  -- 100: correct = "Great Recession"
  UPDATE public.questions SET mc_options = '["Dot-com crash", "Savings and Loan Crisis", "Black Monday"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Social & Political Changes' AND point_value = 100;

  -- 200: correct = "Tea Party movement"
  UPDATE public.questions SET mc_options = '["Occupy Wall Street movement", "Contract with America", "Moral Majority movement"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Social & Political Changes' AND point_value = 200;

  -- 300: correct = "Obergefell v. Hodges"
  UPDATE public.questions SET mc_options = '["Lawrence v. Texas", "United States v. Windsor", "Romer v. Evans"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Social & Political Changes' AND point_value = 300;

  -- 400: correct = "Black Lives Matter"
  UPDATE public.questions SET mc_options = '["Civil Rights Movement", "Rainbow Coalition", "Million Man March"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Social & Political Changes' AND point_value = 400;

  -- 500: correct = "Twitter, Facebook, Instagram"
  UPDATE public.questions SET mc_options = '["Television, radio, and newspapers", "Email, texting, and phone calls", "YouTube, Netflix, and streaming platforms"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Social & Political Changes' AND point_value = 500;

END $$;

-- Verify all 35 questions now have mc_options
DO $$
DECLARE
  v_nulls INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_nulls
  FROM public.questions q
  JOIN public.question_banks b ON q.bank_id = b.id
  WHERE b.title = 'Modern America'
    AND q.mc_options IS NULL;

  IF v_nulls > 0 THEN
    RAISE EXCEPTION 'mc_options seed incomplete: % questions still NULL in Modern America', v_nulls;
  END IF;

  RAISE NOTICE 'OK: all questions in Modern America now have mc_options';
END $$;
