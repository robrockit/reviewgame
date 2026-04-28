-- Migration: mc_options for "Civil War & Reconstruction" bank
-- Purpose: Seeds 3 wrong-answer options for all 35 questions so this bank
--          can be used in Quick Fire (pub_trivia) mode.
-- Depends on: 20260426_questions_mc_options.sql (mc_options column)
-- Date: 2026-05-10

DO $$
DECLARE
  v_bank_id UUID;
BEGIN

  SELECT id INTO v_bank_id
  FROM public.question_banks
  WHERE title = 'Civil War & Reconstruction'
    AND is_public = true;

  IF v_bank_id IS NULL THEN
    RAISE EXCEPTION 'Civil War & Reconstruction bank not found';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.questions
    WHERE bank_id = v_bank_id
      AND mc_options IS NOT NULL
  ) THEN
    RAISE NOTICE 'Civil War & Reconstruction mc_options already seeded -- skipping';
    RETURN;
  END IF;

  -- ── Causes of the Civil War ──────────────────────────────────────────────

  -- 100: correct = "Slavery"
  UPDATE public.questions SET mc_options = '["Tariffs", "Westward expansion", "Foreign immigration"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Causes of the Civil War' AND point_value = 100;

  -- 200: correct = "Election of Abraham Lincoln"
  UPDATE public.questions SET mc_options = '["Passage of the Kansas-Nebraska Act", "Publication of Uncle Tom''s Cabin", "John Brown''s raid on Harpers Ferry"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Causes of the Civil War' AND point_value = 200;

  -- 300: correct = "South Carolina"
  UPDATE public.questions SET mc_options = '["Virginia", "Mississippi", "Georgia"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Causes of the Civil War' AND point_value = 300;

  -- 400: correct = "States'' rights"
  UPDATE public.questions SET mc_options = '["Popular sovereignty", "Nullification", "Manifest Destiny"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Causes of the Civil War' AND point_value = 400;

  -- 500: correct = "Confederate States of America"
  UPDATE public.questions SET mc_options = '["Southern Republic of America", "United States of the South", "Confederate Union of States"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Causes of the Civil War' AND point_value = 500;

  -- ── Civil War Leaders ────────────────────────────────────────────────────

  -- 100: correct = "Abraham Lincoln"
  UPDATE public.questions SET mc_options = '["Ulysses S. Grant", "James Buchanan", "Andrew Johnson"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Civil War Leaders' AND point_value = 100;

  -- 200: correct = "Jefferson Davis"
  UPDATE public.questions SET mc_options = '["Robert E. Lee", "Alexander Stephens", "Stonewall Jackson"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Civil War Leaders' AND point_value = 200;

  -- 300: correct = "Robert E. Lee"
  UPDATE public.questions SET mc_options = '["Stonewall Jackson", "Jefferson Davis", "James Longstreet"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Civil War Leaders' AND point_value = 300;

  -- 400: correct = "Ulysses S. Grant"
  UPDATE public.questions SET mc_options = '["William Tecumseh Sherman", "George McClellan", "Philip Sheridan"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Civil War Leaders' AND point_value = 400;

  -- 500: correct = "William Tecumseh Sherman"
  UPDATE public.questions SET mc_options = '["Ulysses S. Grant", "Philip Sheridan", "George Thomas"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Civil War Leaders' AND point_value = 500;

  -- ── End of Reconstruction ────────────────────────────────────────────────

  -- 100: correct = "Jim Crow laws"
  UPDATE public.questions SET mc_options = '["Freedmen''s Bureau regulations", "Reconstruction Acts", "Carpetbagger laws"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'End of Reconstruction' AND point_value = 100;

  -- 200: correct = "Ku Klux Klan"
  UPDATE public.questions SET mc_options = '["Red Shirts", "White League", "Knights of the White Camelia"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'End of Reconstruction' AND point_value = 200;

  -- 300: correct = "Poll tax"
  UPDATE public.questions SET mc_options = '["Literacy test", "Grandfather clause", "Property requirement"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'End of Reconstruction' AND point_value = 300;

  -- 400: correct = "Compromise of 1877"
  UPDATE public.questions SET mc_options = '["Compromise of 1850", "Missouri Compromise", "Kansas-Nebraska Act"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'End of Reconstruction' AND point_value = 400;

  -- 500: correct = "Sharecropping"
  UPDATE public.questions SET mc_options = '["Tenant farming", "Indentured servitude", "The crop-lien system"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'End of Reconstruction' AND point_value = 500;

  -- ── End of the War ───────────────────────────────────────────────────────

  -- 100: correct = "Appomattox Court House"
  UPDATE public.questions SET mc_options = '["Gettysburg, Pennsylvania", "Richmond, Virginia", "Ford''s Theatre, Washington DC"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'End of the War' AND point_value = 100;

  -- 200: correct = "1865"
  UPDATE public.questions SET mc_options = '["1863", "1864", "1866"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'End of the War' AND point_value = 200;

  -- 300: correct = "Gettysburg Address"
  UPDATE public.questions SET mc_options = '["Emancipation Proclamation", "Second Inaugural Address", "House Divided speech"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'End of the War' AND point_value = 300;

  -- 400: correct = "John Wilkes Booth at Ford''s Theatre"
  UPDATE public.questions SET mc_options = '["Charles Guiteau at the White House", "Leon Czolgosz at the Pan-American Exposition", "John Wilkes Booth at the Capitol Building"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'End of the War' AND point_value = 400;

  -- 500: correct = "Over 600,000"
  UPDATE public.questions SET mc_options = '["Over 200,000", "Over 400,000", "Over 1,000,000"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'End of the War' AND point_value = 500;

  -- ── Key Battles & Military Strategy ─────────────────────────────────────

  -- 100: correct = "Fort Sumter"
  UPDATE public.questions SET mc_options = '["Fort McHenry", "Fort Wagner", "Fort Donelson"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Key Battles & Military Strategy' AND point_value = 100;

  -- 200: correct = "Battle of Bull Run"
  UPDATE public.questions SET mc_options = '["Battle of Antietam", "Battle of Shiloh", "Battle of Fort Sumter"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Key Battles & Military Strategy' AND point_value = 200;

  -- 300: correct = "Battle of Antietam"
  UPDATE public.questions SET mc_options = '["Battle of Gettysburg", "Battle of Cold Harbor", "Battle of Chickamauga"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Key Battles & Military Strategy' AND point_value = 300;

  -- 400: correct = "Battle of Gettysburg"
  UPDATE public.questions SET mc_options = '["Battle of Vicksburg", "Battle of Antietam", "Battle of Chancellorsville"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Key Battles & Military Strategy' AND point_value = 400;

  -- 500: correct = "Anaconda Plan"
  UPDATE public.questions SET mc_options = '["Total War Strategy", "March to the Sea", "Cordon Defense"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Key Battles & Military Strategy' AND point_value = 500;

  -- ── Life During the War ──────────────────────────────────────────────────

  -- 100: correct = "Emancipation Proclamation"
  UPDATE public.questions SET mc_options = '["13th Amendment", "Confiscation Act", "Homestead Act"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Life During the War' AND point_value = 100;

  -- 200: correct = "1863"
  UPDATE public.questions SET mc_options = '["1861", "1862", "1864"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Life During the War' AND point_value = 200;

  -- 300: correct = "54th Massachusetts Regiment"
  UPDATE public.questions SET mc_options = '["1st Kansas Colored Infantry", "United States Colored Troops", "Buffalo Soldiers"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Life During the War' AND point_value = 300;

  -- 400: correct = "Nurses, spies, factory workers, running farms"
  UPDATE public.questions SET mc_options = '["Women were not permitted to serve in any capacity during the war", "Women served only as camp followers providing food and clothing", "Women served exclusively as nurses in field hospitals"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Life During the War' AND point_value = 400;

  -- 500: correct = "Mandatory military service; riots because wealthy men could pay to avoid service"
  UPDATE public.questions SET mc_options = '["Voluntary enlistment; riots occurred because soldiers were not paid on time", "Mandatory military service; riots occurred because of poor food and living conditions", "Conscription of immigrants; riots occurred because recent arrivals opposed the war"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Life During the War' AND point_value = 500;

  -- ── Reconstruction Plans & Amendments ───────────────────────────────────

  -- 100: correct = "Reconstruction"
  UPDATE public.questions SET mc_options = '["Restoration", "Redemption", "Reconciliation"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Reconstruction Plans & Amendments' AND point_value = 100;

  -- 200: correct = "13th Amendment"
  UPDATE public.questions SET mc_options = '["14th Amendment", "15th Amendment", "12th Amendment"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Reconstruction Plans & Amendments' AND point_value = 200;

  -- 300: correct = "14th Amendment"
  UPDATE public.questions SET mc_options = '["13th Amendment", "15th Amendment", "16th Amendment"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Reconstruction Plans & Amendments' AND point_value = 300;

  -- 400: correct = "15th Amendment"
  UPDATE public.questions SET mc_options = '["13th Amendment", "14th Amendment", "19th Amendment"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Reconstruction Plans & Amendments' AND point_value = 400;

  -- 500: correct = "Freedmen''s Bureau"
  UPDATE public.questions SET mc_options = '["Bureau of Indian Affairs", "Department of Reconstruction", "Freedmen''s Aid Society"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Reconstruction Plans & Amendments' AND point_value = 500;

END $$;

-- Verify all 35 questions now have mc_options
DO $$
DECLARE
  v_nulls INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_nulls
  FROM public.questions q
  JOIN public.question_banks b ON q.bank_id = b.id
  WHERE b.title = 'Civil War & Reconstruction'
    AND q.mc_options IS NULL;

  IF v_nulls > 0 THEN
    RAISE EXCEPTION 'mc_options seed incomplete: % questions still NULL in Civil War & Reconstruction', v_nulls;
  END IF;

  RAISE NOTICE 'OK: all questions in Civil War & Reconstruction now have mc_options';
END $$;
