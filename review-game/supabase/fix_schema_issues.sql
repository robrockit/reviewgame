-- ================================================================
-- Schema Fix Script
-- Purpose: Fix issues discovered by verify_database_state.sql
-- Date: 2026-03-02
-- Related: RG-118, RG-107
-- ================================================================
--
-- IMPORTANT: Only run fixes for issues found during verification!
-- Do NOT run this entire file blindly - only run specific sections
-- based on what verify_database_state.sql revealed.
--
-- ================================================================


-- ================================================================
-- FIX 1: Add NOT NULL Constraint to teams.game_id
-- ================================================================
-- WHEN TO RUN: If verify_database_state.sql Section 3 shows is_nullable='YES'
-- PREREQUISITE: Section 4 must show 0 NULL values (otherwise fix data first)
--
-- This makes the database schema match the application's assumptions
-- that every team must belong to a game.

-- Step 1: Verify no NULL values exist (CRITICAL - run this first!)
DO $$
DECLARE
  null_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO null_count
  FROM teams
  WHERE game_id IS NULL;

  IF null_count > 0 THEN
    RAISE EXCEPTION 'Cannot add NOT NULL constraint: % rows have NULL game_id. Fix data first!', null_count;
  ELSE
    RAISE NOTICE 'Safe to proceed: No NULL game_id values found';
  END IF;
END $$;

-- Step 2: Add NOT NULL constraint
ALTER TABLE teams
ALTER COLUMN game_id SET NOT NULL;

-- Step 3: Verify the constraint was added
SELECT
  column_name,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'teams'
  AND column_name = 'game_id';

-- Expected output: is_nullable = 'NO'


-- ================================================================
-- FIX 2: Re-create RPC Function create_custom_bank_with_limit_check
-- ================================================================
-- WHEN TO RUN: If verify_database_state.sql Section 1 returns NO ROWS
--
-- This recreates the RPC function that was missing from type generation

CREATE OR REPLACE FUNCTION create_custom_bank_with_limit_check(
  p_owner_id UUID,
  p_title TEXT,
  p_subject TEXT DEFAULT NULL,
  p_description TEXT DEFAULT NULL,
  p_difficulty TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_current_count INTEGER;
  v_limit INTEGER;
  v_tier TEXT;
  v_bank_id UUID;
BEGIN
  -- Authorization check: Ensure caller is acting on their own behalf
  -- Prevents users from creating custom banks under another user's account
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: authentication required';
  END IF;

  IF auth.uid() != p_owner_id THEN
    RAISE EXCEPTION 'Unauthorized: cannot create banks for another user (caller: %, requested: %)',
      auth.uid(), p_owner_id;
  END IF;

  -- Lock the profile row to prevent race conditions
  -- This ensures only one concurrent transaction can check/update limits at a time
  SELECT
    custom_bank_count,
    custom_bank_limit,
    subscription_tier
  INTO
    v_current_count,
    v_limit,
    v_tier
  FROM profiles
  WHERE id = p_owner_id
  FOR UPDATE;

  -- Check if profile exists
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile not found for user %', p_owner_id;
  END IF;

  -- Check limit (NULL means unlimited for PREMIUM tier)
  IF v_limit IS NOT NULL AND v_current_count >= v_limit THEN
    RAISE EXCEPTION 'Custom bank limit exceeded. Tier: %, Limit: %, Current: %',
      v_tier, v_limit, v_current_count;
  END IF;

  -- Create the custom bank
  INSERT INTO question_banks (
    owner_id,
    title,
    subject,
    description,
    difficulty,
    is_custom,
    is_public
  )
  VALUES (
    p_owner_id,
    p_title,
    p_subject,
    p_description,
    p_difficulty,
    true,  -- is_custom
    false  -- is_public (custom banks are private by default)
  )
  RETURNING id INTO v_bank_id;

  -- Note: custom_bank_count is updated automatically by trigger
  -- The trigger increments/decrements the count on INSERT/DELETE

  RETURN v_bank_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public;

-- Add function comment
COMMENT ON FUNCTION create_custom_bank_with_limit_check IS
  'Atomically creates a custom question bank with limit enforcement. ' ||
  'Prevents race conditions by locking the profile row during limit check. ' ||
  'Raises exception if limit exceeded or user unauthorized.';

-- Verify function was created
SELECT
  routine_name,
  routine_schema
FROM information_schema.routines
WHERE routine_name = 'create_custom_bank_with_limit_check';

-- Expected output: 1 row showing the function exists


-- ================================================================
-- FIX 3: Re-create Missing RG-107 Columns
-- ================================================================
-- WHEN TO RUN: If verify_database_state.sql Section 5 shows < 3 rows
--
-- Only run the specific ALTER TABLE for columns that are missing

-- Fix: accessible_prebuilt_bank_ids
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS accessible_prebuilt_bank_ids JSONB DEFAULT NULL
CONSTRAINT chk_accessible_prebuilt_bank_ids_is_array
  CHECK (accessible_prebuilt_bank_ids IS NULL OR jsonb_typeof(accessible_prebuilt_bank_ids) = 'array');

-- Fix: custom_bank_limit
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS custom_bank_limit INTEGER DEFAULT 0
CONSTRAINT chk_custom_bank_limit CHECK (custom_bank_limit IS NULL OR custom_bank_limit >= 0);

-- Fix: custom_bank_count
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS custom_bank_count INTEGER DEFAULT 0 NOT NULL
CONSTRAINT chk_custom_bank_count CHECK (custom_bank_count >= 0);

-- Verify columns were created
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'profiles'
  AND column_name IN (
    'accessible_prebuilt_bank_ids',
    'custom_bank_limit',
    'custom_bank_count'
  )
ORDER BY column_name;

-- Expected output: 3 rows


-- ================================================================
-- FIX 4: Re-create Missing RG-118 Column
-- ================================================================
-- WHEN TO RUN: If verify_database_state.sql Section 6 returns NO ROWS

ALTER TABLE games
ADD COLUMN IF NOT EXISTS current_phase TEXT DEFAULT 'regular';

-- Verify column was created
SELECT
  column_name,
  data_type,
  column_default
FROM information_schema.columns
WHERE table_name = 'games'
  AND column_name = 'current_phase';

-- Expected output: 1 row


-- ================================================================
-- FIX 5: Re-create GIN Index
-- ================================================================
-- WHEN TO RUN: If verify_database_state.sql Section 7 returns NO ROWS

CREATE INDEX IF NOT EXISTS idx_profiles_accessible_banks
ON profiles USING gin(accessible_prebuilt_bank_ids);

-- Verify index was created
SELECT
  indexname,
  tablename
FROM pg_indexes
WHERE indexname = 'idx_profiles_accessible_banks';

-- Expected output: 1 row


-- ================================================================
-- FIX 6: Re-create Trigger Function
-- ================================================================
-- WHEN TO RUN: If verify_database_state.sql Section 8 returns NO ROWS

CREATE OR REPLACE FUNCTION update_custom_bank_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Only increment count for custom banks
    IF NEW.is_custom = true THEN
      UPDATE profiles
      SET custom_bank_count = custom_bank_count + 1
      WHERE id = NEW.owner_id;
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    -- Only decrement count for custom banks
    IF OLD.is_custom = true THEN
      UPDATE profiles
      SET custom_bank_count = GREATEST(custom_bank_count - 1, 0)
      WHERE id = OLD.owner_id;
    END IF;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public;

-- Verify function was created
SELECT routine_name
FROM information_schema.routines
WHERE routine_name = 'update_custom_bank_count';

-- Expected output: 1 row


-- ================================================================
-- FIX 7: Re-create Triggers
-- ================================================================
-- WHEN TO RUN: If verify_database_state.sql Section 9 returns < 2 rows

-- Drop existing triggers if they exist (to avoid conflicts)
DROP TRIGGER IF EXISTS trg_update_custom_bank_count_insert ON question_banks;
DROP TRIGGER IF EXISTS trg_update_custom_bank_count_delete ON question_banks;

-- Create INSERT trigger
CREATE TRIGGER trg_update_custom_bank_count_insert
AFTER INSERT ON question_banks
FOR EACH ROW
EXECUTE FUNCTION update_custom_bank_count();

-- Create DELETE trigger
CREATE TRIGGER trg_update_custom_bank_count_delete
AFTER DELETE ON question_banks
FOR EACH ROW
EXECUTE FUNCTION update_custom_bank_count();

-- Verify triggers were created
SELECT
  trigger_name,
  event_manipulation
FROM information_schema.triggers
WHERE event_object_table = 'question_banks'
  AND trigger_name IN ('trg_update_custom_bank_count_insert', 'trg_update_custom_bank_count_delete')
ORDER BY trigger_name;

-- Expected output: 2 rows


-- ================================================================
-- POST-FIX: Recalculate custom_bank_count (Data Integrity)
-- ================================================================
-- WHEN TO RUN: After running FIX 6 or FIX 7 (trigger fixes)
--
-- This ensures custom_bank_count matches actual count in case
-- the triggers were missing and counts drifted out of sync.

UPDATE profiles
SET custom_bank_count = (
  SELECT COUNT(*)
  FROM question_banks
  WHERE question_banks.owner_id = profiles.id
    AND question_banks.is_custom = true
);

-- Verify counts are accurate
SELECT
  p.id,
  p.custom_bank_count as profile_count,
  COUNT(qb.id) as actual_count,
  p.custom_bank_count = COUNT(qb.id) as counts_match
FROM profiles p
LEFT JOIN question_banks qb ON qb.owner_id = p.id AND qb.is_custom = true
GROUP BY p.id, p.custom_bank_count
HAVING p.custom_bank_count != COUNT(qb.id);

-- Expected output: 0 rows (no mismatches)
-- If rows returned: Those profiles had incorrect counts (now fixed)


-- ================================================================
-- FINAL STEP: Re-run Verification
-- ================================================================
--
-- After running any fixes, go back to verify_database_state.sql
-- and run all sections again to confirm everything is fixed.
--
-- Then regenerate types:
--   npx supabase gen types typescript --project-id kvygljdyzdhltngqvrii > types/database.types.ts
--
-- ================================================================
