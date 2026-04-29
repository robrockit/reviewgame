-- Migration: mc_options for "Early Republic & Westward Expansion" bank
-- Purpose: Seeds 3 wrong-answer options for all 35 questions so this bank
--          can be used in Quick Fire (pub_trivia) mode.
-- Depends on: 20260426_questions_mc_options.sql (mc_options column)
-- Date: 2026-05-13

DO $$
DECLARE
  v_bank_id UUID;
BEGIN

  SELECT id INTO v_bank_id
  FROM public.question_banks
  WHERE title = 'Early Republic & Westward Expansion'
    AND is_public = true;

  IF v_bank_id IS NULL THEN
    RAISE EXCEPTION 'Early Republic & Westward Expansion bank not found';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.questions
    WHERE bank_id = v_bank_id
      AND mc_options IS NOT NULL
  ) THEN
    RAISE NOTICE 'Early Republic & Westward Expansion mc_options already seeded -- skipping';
    RETURN;
  END IF;

  -- ── Growing Sectional Tensions ───────────────────────────────────────────

  -- 100: correct = "Slavery extension"
  UPDATE public.questions SET mc_options = '["Tariff dispute", "States'' rights debate", "Western land ownership"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Growing Sectional Tensions' AND point_value = 100;

  -- 200: correct = "Missouri Compromise"
  UPDATE public.questions SET mc_options = '["Compromise of 1850", "Kansas-Nebraska Act", "Three-Fifths Compromise"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Growing Sectional Tensions' AND point_value = 200;

  -- 300: correct = "Fugitive Slave Act"
  UPDATE public.questions SET mc_options = '["Kansas-Nebraska Act", "Personal Liberty Laws", "Compromise of 1850"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Growing Sectional Tensions' AND point_value = 300;

  -- 400: correct = "Kansas-Nebraska Act"
  UPDATE public.questions SET mc_options = '["Missouri Compromise", "Compromise of 1850", "Crittenden Compromise"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Growing Sectional Tensions' AND point_value = 400;

  -- 500: correct = "Bleeding Kansas"
  UPDATE public.questions SET mc_options = '["Bloody Sunday", "Bloody Kansas Raid", "Burning of Lawrence"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Growing Sectional Tensions' AND point_value = 500;

  -- ── Jacksonian Democracy ─────────────────────────────────────────────────

  -- 100: correct = "Andrew Jackson"
  UPDATE public.questions SET mc_options = '["John Quincy Adams", "James K. Polk", "Martin Van Buren"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Jacksonian Democracy' AND point_value = 100;

  -- 200: correct = "Second Bank of the United States"
  UPDATE public.questions SET mc_options = '["First Bank of the United States", "Bank of England", "Federal Reserve"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Jacksonian Democracy' AND point_value = 200;

  -- 300: correct = "Indian Removal Act"
  UPDATE public.questions SET mc_options = '["Dawes Severalty Act", "Indian Appropriations Act", "Homestead Act"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Jacksonian Democracy' AND point_value = 300;

  -- 400: correct = "Trail of Tears"
  UPDATE public.questions SET mc_options = '["Long Walk", "Wounded Knee March", "Sand Creek Exodus"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Jacksonian Democracy' AND point_value = 400;

  -- 500: correct = "Nullification Crisis"
  UPDATE public.questions SET mc_options = '["Bank War", "Tariff of Abominations", "Spoils System controversy"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Jacksonian Democracy' AND point_value = 500;

  -- ── Jefferson & Louisiana Purchase ──────────────────────────────────────

  -- 100: correct = "Thomas Jefferson"
  UPDATE public.questions SET mc_options = '["John Adams", "James Madison", "James Monroe"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Jefferson & Louisiana Purchase' AND point_value = 100;

  -- 200: correct = "France"
  UPDATE public.questions SET mc_options = '["Spain", "Great Britain", "Mexico"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Jefferson & Louisiana Purchase' AND point_value = 200;

  -- 300: correct = "1803"
  UPDATE public.questions SET mc_options = '["1800", "1812", "1807"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Jefferson & Louisiana Purchase' AND point_value = 300;

  -- 400: correct = "Lewis and Clark"
  UPDATE public.questions SET mc_options = '["Zebulon Pike and Stephen Long", "John Fremont and Kit Carson", "John Wesley Powell and Clarence King"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Jefferson & Louisiana Purchase' AND point_value = 400;

  -- 500: correct = "Sacagawea"
  UPDATE public.questions SET mc_options = '["Pocahontas", "Squanto", "Sitting Bull"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Jefferson & Louisiana Purchase' AND point_value = 500;

  -- ── Manifest Destiny & Westward Expansion ───────────────────────────────

  -- 100: correct = "Manifest Destiny"
  UPDATE public.questions SET mc_options = '["American Exceptionalism", "Continental Expansion", "God-Given Right"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Manifest Destiny & Westward Expansion' AND point_value = 100;

  -- 200: correct = "Oregon Trail"
  UPDATE public.questions SET mc_options = '["Santa Fe Trail", "California Trail", "Mormon Trail"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Manifest Destiny & Westward Expansion' AND point_value = 200;

  -- 300: correct = "California Gold Rush"
  UPDATE public.questions SET mc_options = '["Comstock Lode silver discovery", "Oklahoma Land Rush", "Pikes Peak gold rush"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Manifest Destiny & Westward Expansion' AND point_value = 300;

  -- 400: correct = "Mormons"
  UPDATE public.questions SET mc_options = '["Quakers", "Mennonites", "Puritans"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Manifest Destiny & Westward Expansion' AND point_value = 400;

  -- 500: correct = "Disease, starvation, harsh weather, and conflicts with Native Americans"
  UPDATE public.questions SET mc_options = '["High costs of wagon trains and lack of government support", "Attacks by British soldiers and bandits along the trail", "Dense forests, lack of roads, and no maps of the terrain"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Manifest Destiny & Westward Expansion' AND point_value = 500;

  -- ── Mexican-American War & Texas ─────────────────────────────────────────

  -- 100: correct = "1836"
  UPDATE public.questions SET mc_options = '["1821", "1845", "1848"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Mexican-American War & Texas' AND point_value = 100;

  -- 200: correct = "The Alamo"
  UPDATE public.questions SET mc_options = '["Battle of San Jacinto", "Battle of Goliad", "Battle of Gonzales"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Mexican-American War & Texas' AND point_value = 200;

  -- 300: correct = "Sam Houston"
  UPDATE public.questions SET mc_options = '["Stephen F. Austin", "Jim Bowie", "William Barret Travis"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Mexican-American War & Texas' AND point_value = 300;

  -- 400: correct = "Treaty of Guadalupe Hidalgo"
  UPDATE public.questions SET mc_options = '["Adams-Onis Treaty", "Gadsden Purchase Treaty", "Treaty of Cahuenga"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Mexican-American War & Texas' AND point_value = 400;

  -- 500: correct = "California, Nevada, Utah, Arizona, New Mexico, parts of Colorado and Wyoming"
  UPDATE public.questions SET mc_options = '["Texas, Louisiana, and Florida only", "Oregon, Washington, and Idaho", "California and Texas only"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Mexican-American War & Texas' AND point_value = 500;

  -- ── Reform Movements ─────────────────────────────────────────────────────

  -- 100: correct = "Abolition movement"
  UPDATE public.questions SET mc_options = '["Temperance movement", "Suffrage movement", "Labor movement"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Reform Movements' AND point_value = 100;

  -- 200: correct = "Frederick Douglass"
  UPDATE public.questions SET mc_options = '["Harriet Tubman", "Nat Turner", "Sojourner Truth"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Reform Movements' AND point_value = 200;

  -- 300: correct = "Underground Railroad"
  UPDATE public.questions SET mc_options = '["Freedom Trail", "Liberty Road", "Abolitionist Network"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Reform Movements' AND point_value = 300;

  -- 400: correct = "Seneca Falls Convention"
  UPDATE public.questions SET mc_options = '["Hartford Convention", "Philadelphia Convention", "National Women''s Rights Convention"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Reform Movements' AND point_value = 400;

  -- 500: correct = "Harriet Tubman"
  UPDATE public.questions SET mc_options = '["Sojourner Truth", "Frederick Douglass", "William Still"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Reform Movements' AND point_value = 500;

  -- ── War of 1812 ──────────────────────────────────────────────────────────

  -- 100: correct = "Great Britain"
  UPDATE public.questions SET mc_options = '["France", "Spain", "Canada"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'War of 1812' AND point_value = 100;

  -- 200: correct = "Impressment"
  UPDATE public.questions SET mc_options = '["Blockade", "Conscription", "Privateering"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'War of 1812' AND point_value = 200;

  -- 300: correct = "The White House"
  UPDATE public.questions SET mc_options = '["Library of Congress", "Monticello", "Philadelphia State House"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'War of 1812' AND point_value = 300;

  -- 400: correct = "Battle of New Orleans"
  UPDATE public.questions SET mc_options = '["Battle of Lake Erie", "Battle of Tippecanoe", "Battle of Plattsburgh"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'War of 1812' AND point_value = 400;

  -- 500: correct = "The Star-Spangled Banner"
  UPDATE public.questions SET mc_options = '["America the Beautiful", "My Country ''Tis of Thee", "Yankee Doodle"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'War of 1812' AND point_value = 500;

END $$;

-- Verify all 35 questions now have mc_options
DO $$
DECLARE
  v_nulls INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_nulls
  FROM public.questions q
  JOIN public.question_banks b ON q.bank_id = b.id
  WHERE b.title = 'Early Republic & Westward Expansion'
    AND q.mc_options IS NULL;

  IF v_nulls > 0 THEN
    RAISE EXCEPTION 'mc_options seed incomplete: % questions still NULL in Early Republic & Westward Expansion', v_nulls;
  END IF;

  RAISE NOTICE 'OK: all questions in Early Republic & Westward Expansion now have mc_options';
END $$;
