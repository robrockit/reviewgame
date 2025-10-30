# Database Migrations

This directory contains SQL migrations for the Review Game database.

## Running Migrations

### Option 1: Supabase Dashboard (Recommended for Production)

1. Go to your Supabase project dashboard: https://nyacfskxqoumzzfvpysv.supabase.co
2. Navigate to **SQL Editor** in the left sidebar
3. Open the migration file: `20251021_add_subscription_fields.sql`
4. Copy the contents and paste into the SQL Editor
5. Click **Run** to execute the migration

### Option 2: Supabase CLI (For Local Development)

If you have the Supabase CLI installed:

```bash
# Navigate to the project root
cd reviewgame/review-game

# Run the migration
supabase db push
```

## Migration: 20251021_add_subscription_fields.sql

**Purpose:** Add enhanced subscription tracking fields to the profiles table

**Changes:**
- Adds `stripe_subscription_id` column (TEXT) - Stores the Stripe subscription ID
- Adds `current_period_end` column (TIMESTAMPTZ) - Tracks when the billing period ends
- Creates index on `stripe_subscription_id` for faster lookups
- Adds column comments for documentation

**Impact:**
- Non-destructive migration (uses `IF NOT EXISTS`)
- Safe to run multiple times (idempotent)
- No data loss
- Enables more detailed subscription tracking in webhook handlers

## Verifying the Migration

After running the migration, verify it was successful:

```sql
-- Check if columns exist
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'profiles'
AND column_name IN ('stripe_subscription_id', 'current_period_end');

-- Verify index was created
SELECT indexname
FROM pg_indexes
WHERE tablename = 'profiles'
AND indexname = 'idx_profiles_stripe_subscription_id';
```

## Rollback (If Needed)

If you need to rollback this migration:

```sql
-- Remove the added columns
ALTER TABLE profiles DROP COLUMN IF EXISTS stripe_subscription_id;
ALTER TABLE profiles DROP COLUMN IF EXISTS current_period_end;

-- Remove the index
DROP INDEX IF EXISTS idx_profiles_stripe_subscription_id;
```

---

## Migration: create_profile_trigger.sql

**Purpose:** Automatically creates user profiles when new users sign up

**Why it's needed:**
- The `games` table has a foreign key constraint on `teacher_id` referencing `profiles.id`
- Without a profile, users cannot create games (foreign key constraint violation)
- This trigger ensures every new user automatically gets a profile

**Changes:**
- Creates function `handle_new_user()` that inserts a new profile with default values
- Creates trigger `on_auth_user_created` that fires on new user signup
- Runs with `SECURITY DEFINER` to bypass RLS policies
- Includes exception handling for duplicate profile attempts

**To Apply:**

1. Go to Supabase Dashboard → SQL Editor
2. Copy contents of `create_profile_trigger.sql`
3. Run the query

**After applying:**
- All new signups will automatically have profiles
- Existing users without profiles will need to sign out and sign back in

**For Existing Users Without Profiles:**

If you have existing users who signed up before the trigger was created, run this query to create profiles for them:

```sql
-- Create profiles for existing users who don't have one
INSERT INTO public.profiles (id, email, subscription_status, created_at, updated_at)
SELECT
  id,
  email,
  'free' as subscription_status,
  created_at,
  updated_at
FROM auth.users
WHERE NOT EXISTS (
  SELECT 1 FROM public.profiles WHERE profiles.id = users.id
)
ON CONFLICT (id) DO NOTHING;
```

**Rollback:**

```sql
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();
```

**Related Errors This Fixes:**
- ❌ "violates foreign key constraint 'games_teacher_id_fkey'"
- ❌ "Key is not present in table 'profiles'"
- ❌ "new row violates row-level security policy for table 'profiles'" (error 42501)

---

## Migration: add_student_read_policies.sql

**Purpose:** Allow students to view game information for joining and playing

**Why it's needed:**
- Students need to view game details when accessing the join page (`/game/team/[gameId]`)
- The games table has RLS policies that only allow teachers to view their own games
- Students (authenticated or anonymous) need read access to games and question banks

**Changes:**
- Adds RLS policy: "Anyone can view games in setup status" (for joining)
- Adds RLS policy: "Anyone can view active games" (for playing)
- Adds RLS policy: "Anyone can view public question banks"
- Adds RLS policy: "Anyone can view question banks for games"

**Security Notes:**
- Only SELECT operations are allowed (no INSERT/UPDATE/DELETE)
- Only games in 'setup' or 'active' status are visible
- Question banks are visible only if they're public OR used in an accessible game
- This does not expose sensitive data (teacher info, etc.)

**To Apply:**

1. Go to Supabase Dashboard → SQL Editor
2. Copy contents of `add_student_read_policies.sql`
3. Run the query

**After applying:**
- Students can view game information on the join page
- Students can see question bank details (title, subject) for games they're joining
- Teacher-only data remains protected

**Rollback:**

```sql
-- Remove the policies
DROP POLICY IF EXISTS "Anyone can view games in setup status" ON public.games;
DROP POLICY IF EXISTS "Anyone can view active games" ON public.games;
DROP POLICY IF EXISTS "Anyone can view public question banks" ON public.question_banks;
DROP POLICY IF EXISTS "Anyone can view question banks for games" ON public.question_banks;
```

**Related Errors This Fixes:**
- ❌ "Failed to load game" on student join page
- ❌ 403 Forbidden when fetching game data
- ❌ PostgREST error when querying games table from student pages

---

## Migration: fix_anonymous_team_join.sql

**Purpose:** Allow anonymous students to join games via QR code

**Why it's needed:**
- Students scanning QR codes are NOT authenticated users
- Previous RLS policies required authentication to INSERT teams
- Students need to be able to join without creating an account first

**The Problem:**
When students scan the QR code and try to join, they get error:
```
POST /rest/v1/teams 401 (Unauthorized)
new row violates row-level security policy for table "teams"
```

This happens because they're anonymous users trying to INSERT into the teams table.

**Changes:**
- Drops old "Students can insert teams when joining" policy (required auth)
- Creates "Anyone can join teams during setup" policy (allows anonymous)
- Creates "Anyone can view teams for accessible games" policy
- Creates "Anyone can update team presence" policy

**Security Notes:**
- Anonymous users can ONLY insert teams for games in 'setup' status
- Teams must start with connection_status = 'pending' (requires teacher approval)
- Teams must start with score = 0
- Anonymous users can view teams but not modify scores
- Teacher approval is still required before students can play

**To Apply:**

1. Go to Supabase Dashboard → SQL Editor
2. Copy contents of `fix_anonymous_team_join.sql`
3. Run the query

**After applying:**
- Students can join games without authentication
- Teams are created in pending status
- Teacher must still approve before game starts
- All score modifications remain protected

**Rollback:**

```sql
-- Remove the anonymous policies
DROP POLICY IF EXISTS "Anyone can join teams during setup" ON public.teams;
DROP POLICY IF EXISTS "Anyone can view teams for accessible games" ON public.teams;
DROP POLICY IF EXISTS "Anyone can update team presence" ON public.teams;
```

**Related Errors This Fixes:**
- ❌ "Failed to join game" when clicking join button
- ❌ 401 (Unauthorized) on POST /rest/v1/teams
- ❌ "new row violates row-level security policy for table 'teams'"

---

## Migration: enable_realtime.sql

**Purpose:** Enable real-time subscriptions for live updates

**Why it's needed:**
- Teacher dashboard needs to see teams join without refreshing
- Students need to see approval status updates instantly
- Students need to see game status changes (setup → active → completed)
- Real-time subscriptions require tables to be added to the publication

**The Problem:**
Real-time subscriptions aren't firing:
- Console doesn't show "Team change detected" when students join
- Teacher must manually refresh to see new teams
- Students stuck at "Waiting for game to start" even after teacher clicks "Start Game"

**Changes:**
- Sets REPLICA IDENTITY FULL on teams table (required for realtime)
- Sets REPLICA IDENTITY FULL on games table (required for realtime)
- Adds teams table to supabase_realtime publication
- Adds games table to supabase_realtime publication
- Enables real-time for INSERT, UPDATE, DELETE events

**To Apply - Option 1 (SQL Editor):**

1. Go to Supabase Dashboard → SQL Editor
2. Copy contents of `enable_realtime.sql`
3. Run the query

**To Apply - Option 2 (UI - Recommended):**

1. Go to Supabase Dashboard → Database → Replication
2. Find "supabase_realtime" publication
3. Click on it to edit
4. Enable the `teams` table checkbox
5. Enable the `games` table checkbox
6. Save changes

**After applying:**
- Teacher sees teams join instantly (no refresh needed)
- Students see approval status change immediately
- Students see game start/end without refreshing
- Console logs show "Team change detected" and "Game updated" messages

**Verification:**

Check if realtime is enabled:
```sql
-- Check if teams and games tables are in the publication
SELECT schemaname, tablename
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime'
AND tablename IN ('teams', 'games')
ORDER BY tablename;
```

You should see two rows returned: one for `games` and one for `teams`.

**Rollback:**

```sql
-- Disable realtime for teams and games tables
ALTER PUBLICATION supabase_realtime DROP TABLE public.teams;
ALTER PUBLICATION supabase_realtime DROP TABLE public.games;
```

**Related Issues This Fixes:**
- ❌ Teacher dashboard doesn't update when students join
- ❌ Students stuck at "Waiting for game to start" screen
- ❌ No "Team change detected" or "Game updated" console logs
- ❌ Real-time subscriptions not firing
- ❌ Must manually refresh to see updates
