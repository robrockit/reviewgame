-- Migration: mc_options for "Roaring Twenties through WWII" bank
-- Purpose: Seeds 3 wrong-answer options for all 35 questions so this bank
--          can be used in Quick Fire (pub_trivia) mode.
-- Depends on: 20260426_questions_mc_options.sql (mc_options column)
-- Date: 2026-05-20

DO $$
DECLARE
  v_bank_id UUID;
BEGIN

  SELECT id INTO v_bank_id
  FROM public.question_banks
  WHERE title = 'Roaring Twenties through WWII'
    AND is_public = true;

  IF v_bank_id IS NULL THEN
    RAISE EXCEPTION 'Roaring Twenties through WWII bank not found';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.questions
    WHERE bank_id = v_bank_id
      AND mc_options IS NOT NULL
  ) THEN
    RAISE NOTICE 'Roaring Twenties through WWII mc_options already seeded -- skipping';
    RETURN;
  END IF;

  -- ── Causes of the Great Depression ──────────────────────────────────────

  -- 100: correct = "1929"
  UPDATE public.questions SET mc_options = '["1927", "1931", "1932"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Causes of the Great Depression' AND point_value = 100;

  -- 200: correct = "Black Tuesday"
  UPDATE public.questions SET mc_options = '["Black Monday", "Black Thursday", "Black Friday"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Causes of the Great Depression' AND point_value = 200;

  -- 300: correct = "Buying on margin"
  UPDATE public.questions SET mc_options = '["Short selling", "Day trading", "Diversification"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Causes of the Great Depression' AND point_value = 300;

  -- 400: correct = "They failed or closed"
  UPDATE public.questions SET mc_options = '["They merged into larger national banks", "They were nationalized by the federal government", "They raised interest rates to protect deposits"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Causes of the Great Depression' AND point_value = 400;

  -- 500: correct = "Stock market crash, bank failures, overproduction, unequal distribution of wealth"
  UPDATE public.questions SET mc_options = '["World War I debt, tariffs, and immigration restrictions only", "Drought, lack of gold reserves, and government overspending only", "Stock market crash, New Deal failures, and foreign competition only"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Causes of the Great Depression' AND point_value = 500;

  -- ── Causes of WWII ───────────────────────────────────────────────────────

  -- 100: correct = "Adolf Hitler"
  UPDATE public.questions SET mc_options = '["Benito Mussolini", "Heinrich Himmler", "Hermann Goering"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Causes of WWII' AND point_value = 100;

  -- 200: correct = "Poland"
  UPDATE public.questions SET mc_options = '["France", "Czechoslovakia", "Austria"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Causes of WWII' AND point_value = 200;

  -- 300: correct = "Appeasement"
  UPDATE public.questions SET mc_options = '["Isolationism", "Neutrality", "Containment"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Causes of WWII' AND point_value = 300;

  -- 400: correct = "Germany, Italy, and Japan"
  UPDATE public.questions SET mc_options = '["Germany, Austria, and Hungary", "Germany, Japan, and Spain", "Germany, Italy, and the Soviet Union"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Causes of WWII' AND point_value = 400;

  -- 500: correct = "Treaty of Versailles"
  UPDATE public.questions SET mc_options = '["Treaty of Paris", "League of Nations Covenant", "Treaty of Brest-Litovsk"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Causes of WWII' AND point_value = 500;

  -- ── FDR & The New Deal ───────────────────────────────────────────────────

  -- 100: correct = "Franklin D. Roosevelt"
  UPDATE public.questions SET mc_options = '["Herbert Hoover", "Harry S. Truman", "Woodrow Wilson"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'FDR & The New Deal' AND point_value = 100;

  -- 200: correct = "The New Deal"
  UPDATE public.questions SET mc_options = '["The Fair Deal", "The Square Deal", "The Great Society"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'FDR & The New Deal' AND point_value = 200;

  -- 300: correct = "Works Progress Administration"
  UPDATE public.questions SET mc_options = '["Civilian Conservation Corps", "Tennessee Valley Authority", "National Recovery Administration"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'FDR & The New Deal' AND point_value = 300;

  -- 400: correct = "Social Security"
  UPDATE public.questions SET mc_options = '["Medicare", "Unemployment Insurance", "Federal Deposit Insurance"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'FDR & The New Deal' AND point_value = 400;

  -- 500: correct = "Fireside chats"
  UPDATE public.questions SET mc_options = '["State of the Union addresses", "Campaign speeches", "Press conferences"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'FDR & The New Deal' AND point_value = 500;

  -- ── The Great Depression ─────────────────────────────────────────────────

  -- 100: correct = "Herbert Hoover"
  UPDATE public.questions SET mc_options = '["Calvin Coolidge", "Franklin D. Roosevelt", "Warren G. Harding"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'The Great Depression' AND point_value = 100;

  -- 200: correct = "Hoovervilles"
  UPDATE public.questions SET mc_options = '["Shanty towns", "Tent cities", "Breadlines"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'The Great Depression' AND point_value = 200;

  -- 300: correct = "Dust Bowl"
  UPDATE public.questions SET mc_options = '["Black Blizzard", "Great Drought", "Dirty Thirties"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'The Great Depression' AND point_value = 300;

  -- 400: correct = "Okies"
  UPDATE public.questions SET mc_options = '["Grapes of Wrath migrants", "Dust Bowl refugees", "Joads"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'The Great Depression' AND point_value = 400;

  -- 500: correct = "About 25%"
  UPDATE public.questions SET mc_options = '["About 10%", "About 40%", "About 15%"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'The Great Depression' AND point_value = 500;

  -- ── The Roaring Twenties ─────────────────────────────────────────────────

  -- 100: correct = "1920s"
  UPDATE public.questions SET mc_options = '["1910s", "1930s", "1900s"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'The Roaring Twenties' AND point_value = 100;

  -- 200: correct = "Flappers"
  UPDATE public.questions SET mc_options = '["Suffragettes", "Gibson Girls", "Bluestockings"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'The Roaring Twenties' AND point_value = 200;

  -- 300: correct = "Harlem Renaissance"
  UPDATE public.questions SET mc_options = '["Great Migration", "Black Arts Movement", "Civil Rights Movement"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'The Roaring Twenties' AND point_value = 300;

  -- 400: correct = "Charles Lindbergh"
  UPDATE public.questions SET mc_options = '["Amelia Earhart", "Eddie Rickenbacker", "Wiley Post"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'The Roaring Twenties' AND point_value = 400;

  -- 500: correct = "18th Amendment"
  UPDATE public.questions SET mc_options = '["17th Amendment", "19th Amendment", "21st Amendment"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'The Roaring Twenties' AND point_value = 500;

  -- ── World War II - Major Events ──────────────────────────────────────────

  -- 100: correct = "Pearl Harbor"
  UPDATE public.questions SET mc_options = '["Midway", "Bataan", "Wake Island"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'World War II - Major Events' AND point_value = 100;

  -- 200: correct = "D-Day"
  UPDATE public.questions SET mc_options = '["Operation Market Garden", "Battle of the Bulge", "Operation Torch"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'World War II - Major Events' AND point_value = 200;

  -- 300: correct = "Auschwitz"
  UPDATE public.questions SET mc_options = '["Treblinka", "Dachau", "Sobibor"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'World War II - Major Events' AND point_value = 300;

  -- 400: correct = "Hiroshima and Nagasaki"
  UPDATE public.questions SET mc_options = '["Tokyo and Osaka", "Hiroshima and Osaka", "Nagasaki and Kyoto"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'World War II - Major Events' AND point_value = 400;

  -- 500: correct = "August 15, 1945"
  UPDATE public.questions SET mc_options = '["September 2, 1944", "May 8, 1945", "August 6, 1945"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'World War II - Major Events' AND point_value = 500;

  -- ── WWII Home Front & Holocaust ──────────────────────────────────────────

  -- 100: correct = "The Holocaust"
  UPDATE public.questions SET mc_options = '["The Final Solution", "The Genocide", "The Nuremberg atrocities"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'WWII Home Front & Holocaust' AND point_value = 100;

  -- 200: correct = "Internment camps"
  UPDATE public.questions SET mc_options = '["Concentration camps", "Prisoner of war camps", "Detention centers"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'WWII Home Front & Holocaust' AND point_value = 200;

  -- 300: correct = "Rosie the Riveter"
  UPDATE public.questions SET mc_options = '["We Can Do It poster", "Liberty Girl", "Victory Woman"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'WWII Home Front & Holocaust' AND point_value = 300;

  -- 400: correct = "Limiting consumption of goods like food and gasoline to support the war effort"
  UPDATE public.questions SET mc_options = '["Voluntary collection of scrap metal for weapons manufacturing", "Mandatory purchase of war bonds to fund the military", "The government''s control over all factory production during wartime"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'WWII Home Front & Holocaust' AND point_value = 400;

  -- 500: correct = "Tuskegee Airmen"
  UPDATE public.questions SET mc_options = '["Buffalo Soldiers", "Harlem Hellfighters", "369th Infantry Regiment"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'WWII Home Front & Holocaust' AND point_value = 500;

END $$;

-- Verify all 35 questions now have mc_options
DO $$
DECLARE
  v_nulls INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_nulls
  FROM public.questions q
  JOIN public.question_banks b ON q.bank_id = b.id
  WHERE b.title = 'Roaring Twenties through WWII'
    AND q.mc_options IS NULL;

  IF v_nulls > 0 THEN
    RAISE EXCEPTION 'mc_options seed incomplete: % questions still NULL in Roaring Twenties through WWII', v_nulls;
  END IF;

  RAISE NOTICE 'OK: all questions in Roaring Twenties through WWII now have mc_options';
END $$;
