# Schema Verification & Fix Workflow

## Overview

This workflow helps verify and fix database schema issues discovered after manual SQL execution and type regeneration for RG-118 and RG-107.

## Critical Issues Discovered

1. **RPC Function Missing from Types**: `create_custom_bank_with_limit_check` was present in previous generated types but disappeared after regeneration
2. **teams.game_id Changed to Nullable**: Changed from `string` to `string | null`, potentially breaking application code

## Workflow Steps

### Step 1: Verify Current Database State

1. Open **Supabase Dashboard** → **SQL Editor**
2. Open `supabase/verify_database_state.sql`
3. Run each section **one at a time** (do NOT run entire file)
4. Document the results for each section

**Critical Sections to Check:**

| Section | What It Checks | Pass Criteria | Fail Impact |
|---------|----------------|---------------|-------------|
| 1 | RPC function exists | Returns 1 row | **HIGH** - Runtime errors in production |
| 3 | game_id NOT NULL | is_nullable='NO' | **HIGH** - Silent data corruption possible |
| 4 | No NULL game_ids | count = 0 | **CRITICAL** - Existing data corruption |
| 5 | RG-107 columns | Returns 3 rows | **BLOCKER** - Features won't work |
| 6 | RG-118 column | Returns 1 row | **BLOCKER** - Final Jeopardy broken |

### Step 2: Record Results

Create a checklist of what passed/failed:

```
VERIFICATION RESULTS:
[ ] Section 1: create_custom_bank_with_limit_check exists
[ ] Section 2: Function has correct parameters
[ ] Section 3: teams.game_id is NOT NULL
[ ] Section 4: Zero NULL game_id values
[ ] Section 5: All 3 RG-107 columns exist
[ ] Section 6: current_phase column exists
[ ] Section 7: GIN index exists
[ ] Section 8: update_custom_bank_count function exists
[ ] Section 9: Both triggers exist
```

### Step 3: Apply Fixes (If Needed)

1. Open `supabase/fix_schema_issues.sql`
2. **Only run fixes for sections that failed verification**
3. Run each fix section one at a time
4. Verify each fix worked before proceeding

**Fix Priority Order:**

1. **FIX 4** - Add current_phase column (if missing) - BLOCKER
2. **FIX 3** - Add RG-107 columns (if missing) - BLOCKER
3. **FIX 1** - Add NOT NULL to game_id (if nullable) - HIGH PRIORITY
4. **FIX 2** - Re-create RPC function (if missing) - HIGH PRIORITY
5. **FIX 5-7** - Re-create indexes/triggers (if missing) - MEDIUM PRIORITY
6. **POST-FIX** - Recalculate custom_bank_count - DATA INTEGRITY

### Step 4: Re-run Verification

After applying fixes, run `verify_database_state.sql` again to confirm everything is fixed.

All sections should now PASS.

### Step 5: Regenerate Types

Once database schema is verified and fixed:

```bash
cd reviewgame/review-game
npx supabase gen types typescript --project-id kvygljdyzdhltngqvrii > types/database.types.ts
```

### Step 6: Verify Type Changes

Check the regenerated types for these critical fields:

```bash
# Should show game_id as NON-NULL (not "string | null")
grep -A 15 "teams: {" types/database.types.ts | grep game_id

# Should show the RPC function
grep "create_custom_bank_with_limit_check" types/database.types.ts
```

**Expected Results:**

- `game_id: string` (NOT `string | null`)
- RPC function appears in Functions section

### Step 7: Fix Type Errors (If Needed)

If types are now correct, you may need to **remove** some of our previous "fixes":

1. **Remove game_id casts** if it's now correctly typed as non-null
2. **Remove RPC function any casts** if function is now in types
3. Re-run build to verify no new errors

### Step 8: Create New PR

Once everything is verified:

```bash
# Commit any new changes
git add -A
git commit -m "fix: correct database schema and regenerate types

- Add NOT NULL constraint to teams.game_id (if was missing)
- Verify RPC functions exist in database
- Regenerate types with correct schema
- Remove unnecessary type assertions

Fixes RG-118, RG-107"

# Create new PR
git checkout -b fix/rg-118-schema-verified
git push -u origin fix/rg-118-schema-verified
gh pr create --title "Fix database schema and type errors (RG-118, RG-107 - Verified)" --body "..."
```

## Common Scenarios

### Scenario A: Everything Already Correct

**Verification Results:**
- ✅ All sections pass
- ✅ RPC function exists
- ✅ game_id is NOT NULL

**Action:**
- Types were incorrectly regenerated (possible Supabase CLI cache issue)
- Try regenerating types again
- If still broken, check Supabase project ID in command
- Consider `npx supabase db pull` to sync schema

### Scenario B: RPC Function Missing

**Verification Results:**
- ❌ Section 1: NO ROWS
- ✅ Other sections pass

**Action:**
1. Run **FIX 2** in fix_schema_issues.sql
2. Verify with Section 1 again
3. Regenerate types
4. Remove `(supabase as any).rpc(...)` casts from code

### Scenario C: game_id is Nullable

**Verification Results:**
- ❌ Section 3: is_nullable='YES'
- ✅ Section 4: count=0 (no NULL values)

**Action:**
1. Run **FIX 1** in fix_schema_issues.sql
2. Verify with Section 3 again
3. Regenerate types
4. Remove `team_names as string[] | null` casts if no longer needed

### Scenario D: Data Corruption (NULL game_ids exist)

**Verification Results:**
- ❌ Section 3: is_nullable='YES'
- ❌ Section 4: count > 0

**Action:**
1. **STOP** - Do NOT add NOT NULL constraint yet
2. Investigate the NULL rows:
   ```sql
   SELECT * FROM teams WHERE game_id IS NULL;
   ```
3. Determine if these are orphaned records or valid data
4. Fix or delete the rows
5. Then run **FIX 1**

## Rollback Plan

If fixes cause issues:

```sql
-- Rollback FIX 1 (game_id NOT NULL)
ALTER TABLE teams ALTER COLUMN game_id DROP NOT NULL;

-- Rollback FIX 2 (RPC function)
DROP FUNCTION IF EXISTS create_custom_bank_with_limit_check;

-- Rollback FIX 3 (RG-107 columns)
ALTER TABLE profiles DROP COLUMN accessible_prebuilt_bank_ids;
ALTER TABLE profiles DROP COLUMN custom_bank_limit;
ALTER TABLE profiles DROP COLUMN custom_bank_count;

-- Rollback FIX 4 (RG-118 column)
ALTER TABLE games DROP COLUMN current_phase;
```

## Success Criteria

✅ All 9 verification sections pass
✅ Types regenerate with correct schema
✅ `teams.game_id` is `string` (not nullable)
✅ RPC function appears in generated types
✅ Build passes without type errors
✅ No unnecessary type assertions in code

## Next Steps After Success

1. Deploy to staging
2. Test Final Jeopardy flow (RG-118)
3. Test custom question bank creation (RG-107)
4. Update Jira tickets to Done
5. Document any schema migrations for future reference

## Questions to Answer

- **Why was the RPC function removed from types?**
  - Wrong schema?
  - Dropped between creation and regeneration?
  - Type generation config issue?

- **Why did game_id become nullable?**
  - Was it always nullable and previous types were wrong?
  - Was NOT NULL constraint dropped?
  - When did it change?

- **Should we migrate to proper migration system?**
  - Current approach (manual SQL) is error-prone
  - Consider using `supabase db push` for future changes
  - Document when manual SQL is necessary vs. migrations
