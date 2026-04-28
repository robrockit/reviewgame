-- Migration: mc_options for "Colonial America & Revolution" bank
-- Purpose: Seeds 3 wrong-answer options for all 35 questions so this bank
--          can be used in Quick Fire (pub_trivia) mode.
-- Depends on: 20260426_questions_mc_options.sql (mc_options column)
-- Date: 2026-05-12

DO $$
DECLARE
  v_bank_id UUID;
BEGIN

  SELECT id INTO v_bank_id
  FROM public.question_banks
  WHERE title = 'Colonial America & Revolution'
    AND is_public = true;

  IF v_bank_id IS NULL THEN
    RAISE EXCEPTION 'Colonial America & Revolution bank not found';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.questions
    WHERE bank_id = v_bank_id
      AND mc_options IS NOT NULL
  ) THEN
    RAISE NOTICE 'Colonial America & Revolution mc_options already seeded -- skipping';
    RETURN;
  END IF;

  -- ── Causes of the Revolution ─────────────────────────────────────────────

  -- 100: correct = "No taxation without representation"
  UPDATE public.questions SET mc_options = '["Give me liberty or give me death", "Don''t tread on me", "Unite or die"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Causes of the Revolution' AND point_value = 100;

  -- 200: correct = "The Stamp Act"
  UPDATE public.questions SET mc_options = '["The Townshend Acts", "The Sugar Act", "The Quartering Act"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Causes of the Revolution' AND point_value = 200;

  -- 300: correct = "The Boston Massacre"
  UPDATE public.questions SET mc_options = '["The Boston Tea Party", "The Battle of Lexington", "The Stamp Act riots"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Causes of the Revolution' AND point_value = 300;

  -- 400: correct = "The Tea Act"
  UPDATE public.questions SET mc_options = '["The Townshend Acts", "The Navigation Acts", "The Declaratory Act"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Causes of the Revolution' AND point_value = 400;

  -- 500: correct = "Punitive laws passed to punish Massachusetts for the Boston Tea Party"
  UPDATE public.questions SET mc_options = '["Laws passed to reorganize colonial governments under British control", "Trade restrictions designed to protect British merchants from colonial competition", "Acts that banned colonial assemblies from meeting without royal approval"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Causes of the Revolution' AND point_value = 500;

  -- ── Colonial Life & Economy ──────────────────────────────────────────────

  -- 100: correct = "Tobacco"
  UPDATE public.questions SET mc_options = '["Cotton", "Indigo", "Rice"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Colonial Life & Economy' AND point_value = 100;

  -- 200: correct = "Triangular Trade"
  UPDATE public.questions SET mc_options = '["Atlantic Trade System", "Middle Passage", "Mercantile Exchange"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Colonial Life & Economy' AND point_value = 200;

  -- 300: correct = "Mercantilism"
  UPDATE public.questions SET mc_options = '["Capitalism", "Free trade", "Salutary neglect"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Colonial Life & Economy' AND point_value = 300;

  -- 400: correct = "The voyage that brought enslaved Africans to the Americas"
  UPDATE public.questions SET mc_options = '["The route from England to the Caribbean for sugar trade", "The journey European explorers took to reach North America", "The shipping lane from West Africa to Europe carrying trade goods"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Colonial Life & Economy' AND point_value = 400;

  -- 500: correct = "The Great Awakening"
  UPDATE public.questions SET mc_options = '["The Enlightenment", "The Second Great Awakening", "The Puritan Revival"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Colonial Life & Economy' AND point_value = 500;

  -- ── Exploration & Early Settlements ──────────────────────────────────────

  -- 100: correct = "1492"
  UPDATE public.questions SET mc_options = '["1607", "1587", "1520"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Exploration & Early Settlements' AND point_value = 100;

  -- 200: correct = "Jamestown"
  UPDATE public.questions SET mc_options = '["Plymouth", "Roanoke", "St. Augustine"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Exploration & Early Settlements' AND point_value = 200;

  -- 300: correct = "Pocahontas"
  UPDATE public.questions SET mc_options = '["Sacagawea", "Squanto", "Massasoit"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Exploration & Early Settlements' AND point_value = 300;

  -- 400: correct = "The Mayflower"
  UPDATE public.questions SET mc_options = '["The Susan Constant", "The Speedwell", "The Arbella"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Exploration & Early Settlements' AND point_value = 400;

  -- 500: correct = "The Mayflower Compact"
  UPDATE public.questions SET mc_options = '["The Fundamental Orders of Connecticut", "The Virginia House of Burgesses charter", "The Articles of Agreement"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Exploration & Early Settlements' AND point_value = 500;

  -- ── Founding Documents ───────────────────────────────────────────────────

  -- 100: correct = "1776"
  UPDATE public.questions SET mc_options = '["1775", "1781", "1783"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Founding Documents' AND point_value = 100;

  -- 200: correct = "Thomas Jefferson"
  UPDATE public.questions SET mc_options = '["Benjamin Franklin", "John Adams", "James Madison"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Founding Documents' AND point_value = 200;

  -- 300: correct = "Articles of Confederation"
  UPDATE public.questions SET mc_options = '["Constitution", "Mayflower Compact", "Declaration of Independence"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Founding Documents' AND point_value = 300;

  -- 400: correct = "No power to tax and no executive branch"
  UPDATE public.questions SET mc_options = '["No bill of rights and no legislative branch", "Too much power given to a central government with no checks", "States had no power and the president had too much authority"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Founding Documents' AND point_value = 400;

  -- 500: correct = "Shays'' Rebellion"
  UPDATE public.questions SET mc_options = '["Whiskey Rebellion", "Bacon''s Rebellion", "Fries''s Rebellion"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Founding Documents' AND point_value = 500;

  -- ── Revolutionary War ────────────────────────────────────────────────────

  -- 100: correct = "Lexington and Concord"
  UPDATE public.questions SET mc_options = '["Bunker Hill and Breed''s Hill", "Trenton and Princeton", "Yorktown and Saratoga"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Revolutionary War' AND point_value = 100;

  -- 200: correct = "George Washington"
  UPDATE public.questions SET mc_options = '["Benjamin Franklin", "Nathanael Greene", "Henry Knox"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Revolutionary War' AND point_value = 200;

  -- 300: correct = "Battle of Saratoga"
  UPDATE public.questions SET mc_options = '["Battle of Yorktown", "Battle of Bunker Hill", "Battle of Trenton"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Revolutionary War' AND point_value = 300;

  -- 400: correct = "Valley Forge"
  UPDATE public.questions SET mc_options = '["Morristown", "Trenton", "Brandywine Creek"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Revolutionary War' AND point_value = 400;

  -- 500: correct = "Battle of Yorktown"
  UPDATE public.questions SET mc_options = '["Battle of Saratoga", "Battle of Guilford Court House", "Battle of Camden"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Revolutionary War' AND point_value = 500;

  -- ── The 13 Colonies ──────────────────────────────────────────────────────

  -- 100: correct = "13"
  UPDATE public.questions SET mc_options = '["12", "14", "15"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'The 13 Colonies' AND point_value = 100;

  -- 200: correct = "Pennsylvania"
  UPDATE public.questions SET mc_options = '["Rhode Island", "Maryland", "New Jersey"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'The 13 Colonies' AND point_value = 200;

  -- 300: correct = "Southern colonies"
  UPDATE public.questions SET mc_options = '["New England colonies", "Middle colonies", "Chesapeake colonies"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'The 13 Colonies' AND point_value = 300;

  -- 400: correct = "Maryland"
  UPDATE public.questions SET mc_options = '["Pennsylvania", "Rhode Island", "Virginia"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'The 13 Colonies' AND point_value = 400;

  -- 500: correct = "Fishing, shipbuilding, and trade"
  UPDATE public.questions SET mc_options = '["Large plantation agriculture and tobacco farming", "Subsistence farming and fur trading only", "Mining, manufacturing, and textile production"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'The 13 Colonies' AND point_value = 500;

  -- ── The Constitution ─────────────────────────────────────────────────────

  -- 100: correct = "1787"
  UPDATE public.questions SET mc_options = '["1776", "1783", "1789"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'The Constitution' AND point_value = 100;

  -- 200: correct = "Philadelphia"
  UPDATE public.questions SET mc_options = '["New York City", "Boston", "Richmond"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'The Constitution' AND point_value = 200;

  -- 300: correct = "The Great Compromise"
  UPDATE public.questions SET mc_options = '["Three-Fifths Compromise", "Northwest Ordinance", "Missouri Compromise"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'The Constitution' AND point_value = 300;

  -- 400: correct = "Three-Fifths Compromise"
  UPDATE public.questions SET mc_options = '["The Great Compromise", "The Commerce Compromise", "The Slave Trade Compromise"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'The Constitution' AND point_value = 400;

  -- 500: correct = "The Bill of Rights"
  UPDATE public.questions SET mc_options = '["The Articles of Confederation", "The Preamble", "The Declaration of Independence"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'The Constitution' AND point_value = 500;

END $$;

-- Verify all 35 questions now have mc_options
DO $$
DECLARE
  v_nulls INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_nulls
  FROM public.questions q
  JOIN public.question_banks b ON q.bank_id = b.id
  WHERE b.title = 'Colonial America & Revolution'
    AND q.mc_options IS NULL;

  IF v_nulls > 0 THEN
    RAISE EXCEPTION 'mc_options seed incomplete: % questions still NULL in Colonial America & Revolution', v_nulls;
  END IF;

  RAISE NOTICE 'OK: all questions in Colonial America & Revolution now have mc_options';
END $$;
