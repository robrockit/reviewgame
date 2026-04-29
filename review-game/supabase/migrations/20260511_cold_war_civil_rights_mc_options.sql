-- Migration: mc_options for "Cold War & Civil Rights" bank
-- Purpose: Seeds 3 wrong-answer options for all 35 questions so this bank
--          can be used in Quick Fire (pub_trivia) mode.
-- Depends on: 20260426_questions_mc_options.sql (mc_options column)
-- Date: 2026-05-11

DO $$
DECLARE
  v_bank_id UUID;
BEGIN

  SELECT id INTO v_bank_id
  FROM public.question_banks
  WHERE title = 'Cold War & Civil Rights'
    AND is_public = true;

  IF v_bank_id IS NULL THEN
    RAISE EXCEPTION 'Cold War & Civil Rights bank not found';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.questions
    WHERE bank_id = v_bank_id
      AND mc_options IS NOT NULL
  ) THEN
    RAISE NOTICE 'Cold War & Civil Rights mc_options already seeded -- skipping';
    RETURN;
  END IF;

  -- ── 1950s America ────────────────────────────────────────────────────────

  -- 100: correct = "Dwight D. Eisenhower"
  UPDATE public.questions SET mc_options = '["Harry S. Truman", "Richard Nixon", "John F. Kennedy"]'::jsonb
  WHERE bank_id = v_bank_id AND category = '1950s America' AND point_value = 100;

  -- 200: correct = "Joseph McCarthy"
  UPDATE public.questions SET mc_options = '["J. Edgar Hoover", "Richard Nixon", "Barry Goldwater"]'::jsonb
  WHERE bank_id = v_bank_id AND category = '1950s America' AND point_value = 200;

  -- 300: correct = "Red Scare"
  UPDATE public.questions SET mc_options = '["Yellow Peril", "Lavender Scare", "Domino Theory"]'::jsonb
  WHERE bank_id = v_bank_id AND category = '1950s America' AND point_value = 300;

  -- 400: correct = "Levittowns"
  UPDATE public.questions SET mc_options = '["Hoovervilles", "Shanty towns", "Planned cities"]'::jsonb
  WHERE bank_id = v_bank_id AND category = '1950s America' AND point_value = 400;

  -- 500: correct = "Interstate Highway System"
  UPDATE public.questions SET mc_options = '["National Road System", "Federal Turnpike System", "Transcontinental Railroad System"]'::jsonb
  WHERE bank_id = v_bank_id AND category = '1950s America' AND point_value = 500;

  -- ── 1970s ────────────────────────────────────────────────────────────────

  -- 100: correct = "Watergate"
  UPDATE public.questions SET mc_options = '["Iran-Contra Affair", "Teapot Dome Scandal", "Whitewater Scandal"]'::jsonb
  WHERE bank_id = v_bank_id AND category = '1970s' AND point_value = 100;

  -- 200: correct = "Gerald Ford"
  UPDATE public.questions SET mc_options = '["Spiro Agnew", "Jimmy Carter", "Nelson Rockefeller"]'::jsonb
  WHERE bank_id = v_bank_id AND category = '1970s' AND point_value = 200;

  -- 300: correct = "Detente"
  UPDATE public.questions SET mc_options = '["Containment", "Brinksmanship", "Massive Retaliation"]'::jsonb
  WHERE bank_id = v_bank_id AND category = '1970s' AND point_value = 300;

  -- 400: correct = "Oil Crisis"
  UPDATE public.questions SET mc_options = '["Stagflation", "Recession of 1973", "Currency Crisis"]'::jsonb
  WHERE bank_id = v_bank_id AND category = '1970s' AND point_value = 400;

  -- 500: correct = "Iran Hostage Crisis"
  UPDATE public.questions SET mc_options = '["Beirut Hostage Crisis", "Lebanon Embassy bombing", "Tehran Embassy siege"]'::jsonb
  WHERE bank_id = v_bank_id AND category = '1970s' AND point_value = 500;

  -- ── Civil Rights Movement ────────────────────────────────────────────────

  -- 100: correct = "Brown v. Board of Education"
  UPDATE public.questions SET mc_options = '["Plessy v. Ferguson", "Marbury v. Madison", "Sweatt v. Painter"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Civil Rights Movement' AND point_value = 100;

  -- 200: correct = "Rosa Parks"
  UPDATE public.questions SET mc_options = '["Claudette Colvin", "Coretta Scott King", "Fannie Lou Hamer"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Civil Rights Movement' AND point_value = 200;

  -- 300: correct = "Martin Luther King Jr."
  UPDATE public.questions SET mc_options = '["Malcolm X", "John Lewis", "Medgar Evers"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Civil Rights Movement' AND point_value = 300;

  -- 400: correct = "Civil Rights Act of 1964"
  UPDATE public.questions SET mc_options = '["Voting Rights Act of 1965", "Civil Rights Act of 1957", "Fair Housing Act of 1968"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Civil Rights Movement' AND point_value = 400;

  -- 500: correct = "Voting Rights Act of 1965"
  UPDATE public.questions SET mc_options = '["Civil Rights Act of 1964", "24th Amendment", "Fair Housing Act of 1968"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Civil Rights Movement' AND point_value = 500;

  -- ── Korean War & Containment ─────────────────────────────────────────────

  -- 100: correct = "Containment"
  UPDATE public.questions SET mc_options = '["Isolationism", "Detente", "Massive Retaliation"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Korean War & Containment' AND point_value = 100;

  -- 200: correct = "38th parallel"
  UPDATE public.questions SET mc_options = '["17th parallel", "49th parallel", "32nd parallel"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Korean War & Containment' AND point_value = 200;

  -- 300: correct = "1950"
  UPDATE public.questions SET mc_options = '["1948", "1952", "1945"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Korean War & Containment' AND point_value = 300;

  -- 400: correct = "Douglas MacArthur"
  UPDATE public.questions SET mc_options = '["Omar Bradley", "Matthew Ridgway", "Mark Clark"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Korean War & Containment' AND point_value = 400;

  -- 500: correct = "NATO"
  UPDATE public.questions SET mc_options = '["Warsaw Pact", "SEATO", "United Nations"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Korean War & Containment' AND point_value = 500;

  -- ── Origins of the Cold War ──────────────────────────────────────────────

  -- 100: correct = "United States and Soviet Union"
  UPDATE public.questions SET mc_options = '["United States and China", "United States and Germany", "United States and Great Britain"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Origins of the Cold War' AND point_value = 100;

  -- 200: correct = "Iron Curtain"
  UPDATE public.questions SET mc_options = '["Berlin Wall", "Bamboo Curtain", "Demilitarized Zone"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Origins of the Cold War' AND point_value = 200;

  -- 300: correct = "Marshall Plan"
  UPDATE public.questions SET mc_options = '["Truman Doctrine", "Lend-Lease Act", "European Recovery Fund"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Origins of the Cold War' AND point_value = 300;

  -- 400: correct = "Truman Doctrine"
  UPDATE public.questions SET mc_options = '["Marshall Plan", "Eisenhower Doctrine", "Monroe Doctrine"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Origins of the Cold War' AND point_value = 400;

  -- 500: correct = "Berlin Blockade"
  UPDATE public.questions SET mc_options = '["Berlin Wall construction", "Cuban Missile Crisis", "Czech Crisis"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Origins of the Cold War' AND point_value = 500;

  -- ── Space Race & Cuban Missile Crisis ────────────────────────────────────

  -- 100: correct = "Space Race"
  UPDATE public.questions SET mc_options = '["Arms Race", "Nuclear Race", "Satellite Competition"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Space Race & Cuban Missile Crisis' AND point_value = 100;

  -- 200: correct = "Sputnik"
  UPDATE public.questions SET mc_options = '["Vostok", "Explorer 1", "Luna 1"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Space Race & Cuban Missile Crisis' AND point_value = 200;

  -- 300: correct = "Alan Shepard"
  UPDATE public.questions SET mc_options = '["John Glenn", "Gus Grissom", "Neil Armstrong"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Space Race & Cuban Missile Crisis' AND point_value = 300;

  -- 400: correct = "Cuban Missile Crisis"
  UPDATE public.questions SET mc_options = '["Bay of Pigs Invasion", "Berlin Blockade", "Korean War"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Space Race & Cuban Missile Crisis' AND point_value = 400;

  -- 500: correct = "Neil Armstrong"
  UPDATE public.questions SET mc_options = '["Buzz Aldrin", "Alan Shepard", "Yuri Gagarin"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Space Race & Cuban Missile Crisis' AND point_value = 500;

  -- ── Vietnam War ──────────────────────────────────────────────────────────

  -- 100: correct = "Vietnam"
  UPDATE public.questions SET mc_options = '["Korea", "Laos", "Cambodia"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Vietnam War' AND point_value = 100;

  -- 200: correct = "Domino Theory"
  UPDATE public.questions SET mc_options = '["Containment", "Brinkmanship", "Massive Retaliation"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Vietnam War' AND point_value = 200;

  -- 300: correct = "Gulf of Tonkin incident"
  UPDATE public.questions SET mc_options = '["Tet Offensive", "My Lai Massacre", "Fall of Saigon"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Vietnam War' AND point_value = 300;

  -- 400: correct = "Agent Orange"
  UPDATE public.questions SET mc_options = '["Napalm", "DDT", "White Phosphorus"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Vietnam War' AND point_value = 400;

  -- 500: correct = "Tet Offensive"
  UPDATE public.questions SET mc_options = '["Gulf of Tonkin incident", "My Lai Massacre", "Fall of Saigon"]'::jsonb
  WHERE bank_id = v_bank_id AND category = 'Vietnam War' AND point_value = 500;

END $$;

-- Verify all 35 questions now have mc_options
DO $$
DECLARE
  v_nulls INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_nulls
  FROM public.questions q
  JOIN public.question_banks b ON q.bank_id = b.id
  WHERE b.title = 'Cold War & Civil Rights'
    AND q.mc_options IS NULL;

  IF v_nulls > 0 THEN
    RAISE EXCEPTION 'mc_options seed incomplete: % questions still NULL in Cold War & Civil Rights', v_nulls;
  END IF;

  RAISE NOTICE 'OK: all questions in Cold War & Civil Rights now have mc_options';
END $$;
