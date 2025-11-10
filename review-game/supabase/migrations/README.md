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

---

## Migration: add_teacher_update_policy.sql

**Purpose:** Allow teachers to update their own games (start games, change status, etc.)

**Why it's needed:**
- Teachers couldn't start games without this UPDATE policy
- The policy was added during debugging but never committed to a migration file
- Without this, teachers get RLS policy violations when trying to update game status

**The Problem:**
When teachers click "Start Game", they get error:
```
new row violates row-level security policy for table "games"
UPDATE operation blocked
```

**Changes:**
- Adds RLS policy: "Teachers can update their own games"
- Allows UPDATE operations where teacher_id = auth.uid()
- Required for starting games (status: 'setup' → 'active')

**Security Notes:**
- Only authenticated teachers can update games
- Teachers can only update their own games (verified by teacher_id)
- Anonymous users cannot update games

**To Apply:**

1. Go to Supabase Dashboard → SQL Editor
2. Copy contents of `add_teacher_update_policy.sql`
3. Run the query

**After applying:**
- Teachers can start games successfully
- Game status updates work correctly
- No more RLS policy violations on game updates

**Rollback:**

```sql
DROP POLICY IF EXISTS "Teachers can update their own games" ON public.games;
```

**Related Errors This Fixes:**
- ❌ "new row violates row-level security policy for table 'games'"
- ❌ "UPDATE operation blocked" when starting games
- ❌ Teachers unable to change game status

---

## Migration: fix_team_security_policies.sql

**Purpose:** Fix security vulnerabilities in team management (deletion authorization and restrictive updates)

**Why it's needed:**
- **Security Issue #1**: Teachers can delete any team without verifying they own the game
- **Security Issue #2**: Anonymous users can update ANY team field (scores, names, etc.) not just connection_status
- Both issues identified in code review as MEDIUM severity security vulnerabilities

**The Problems:**

**Problem 1 - Unauthorized Team Deletion:**
```typescript
// Teacher can delete ANY team, even from other teachers' games
const { error } = await supabase
  .from('teams')
  .delete()
  .eq('id', teamId);  // No game ownership verification!
```

**Problem 2 - Overly Permissive UPDATE Policy:**
```sql
-- Old policy allowed updating ALL columns
CREATE POLICY "Anyone can update team presence"
WITH CHECK (connection_status IN ('pending', 'connected', 'disconnected'));
-- Only validates connection_status but allows updating team_name, score, etc.!
```

**Changes:**

1. **Adds DELETE policy for teachers:**
   - Teachers can only delete teams from games they own
   - Verifies teacher_id matches game owner via JOIN

2. **Replaces broad UPDATE policy with restrictive one:**
   - Drops old "Anyone can update team presence" policy
   - Creates new "Anyone can update team connection status" policy
   - Only allows updating connection_status field
   - Prevents modification of scores, team names, or other critical fields

3. **Adds separate UPDATE policy for teachers:**
   - "Teachers can update team scores" policy
   - Allows teachers full UPDATE access to teams in their own games
   - Required for scoring during gameplay

**Security Notes:**
- DELETE operations now verify game ownership
- Anonymous users limited to connection_status updates only
- Teachers have full control over teams in their games
- Scores cannot be modified by anonymous users

**To Apply:**

1. Go to Supabase Dashboard → SQL Editor
2. Copy contents of `fix_team_security_policies.sql`
3. Run the query

**After applying:**
- Teachers can only delete teams from their own games
- Anonymous users cannot modify scores or team names
- Team management is properly authorized
- Security vulnerabilities closed

**Rollback:**

```sql
DROP POLICY IF EXISTS "Teachers can delete teams from their own games" ON public.teams;
DROP POLICY IF EXISTS "Anyone can update team connection status" ON public.teams;
DROP POLICY IF EXISTS "Teachers can update team scores" ON public.teams;

-- Restore old policy if needed
CREATE POLICY "Anyone can update team presence"
ON public.teams
FOR UPDATE
USING (...)
WITH CHECK (connection_status IN ('pending', 'connected', 'disconnected'));
```

**Related Security Issues This Fixes:**
- ❌ MEDIUM: Team deletion without proper authorization
- ❌ MEDIUM: Broad anonymous UPDATE policy allowing score manipulation
- ❌ Unauthorized access to other teachers' game teams

---

## Migration: add_team_number_unique_constraint.sql

**Purpose:** Prevent race condition where multiple students select the same team number simultaneously

**Why it's needed:**
- **Security Issue**: TOCTOU (Time-of-check to Time-of-use) vulnerability
- Students can join the same team at the exact same time
- Client-side check happens BEFORE database INSERT
- Database-level constraint prevents race condition

**The Problem:**

**Race Condition Flow:**
```
Time: 0ms
Student A: Checks if Team 1 exists → NOT FOUND ✓
Student B: Checks if Team 1 exists → NOT FOUND ✓

Time: 100ms
Student A: INSERT Team 1 → SUCCESS ✓
Student B: INSERT Team 1 → SUCCESS ✓  ❌ DUPLICATE!
```

**Current code:**
```typescript
// app/game/team/[gameId]/page.tsx:139
const existingTeam = existingTeams.find(t => t.team_number === selectedTeamNumber);
if (existingTeam) {
  setError(`Team ${selectedTeamNumber} is already taken`);
  return;
}
// INSERT happens here - gap between check and insert!
```

**Changes:**

1. **Adds unique constraint:**
   ```sql
   ALTER TABLE public.teams
   ADD CONSTRAINT unique_game_team_number
   UNIQUE (game_id, team_number);
   ```

2. **Database-level enforcement:**
   - No two teams can have same team_number within a game
   - Constraint violation returns error code `23505`
   - Second student gets clear error message

**Client-Side Update:**
The client code now handles constraint violations gracefully:
```typescript
if ('code' in insertError && insertError.code === '23505') {
  setError(`Team ${selectedTeamNumber} was just taken by another student`);
  // Refetch teams to update UI
}
```

**To Apply:**

1. Go to Supabase Dashboard → SQL Editor
2. Copy contents of `add_team_number_unique_constraint.sql`
3. Run the query

**After applying:**
- Race condition prevented at database level
- Only one student can successfully join each team number
- Second student gets clear "Team just taken" error
- UI automatically refreshes to show latest team availability

**Rollback:**

```sql
ALTER TABLE public.teams
DROP CONSTRAINT IF EXISTS unique_game_team_number;
```

**Related Errors This Fixes:**
- ❌ MEDIUM: Race condition in team number selection
- ❌ Multiple students joining same team simultaneously
- ❌ TOCTOU vulnerability in team join flow
- ❌ Duplicate team numbers within same game

---

## Migration: 20251110_admin_portal_schema.sql

**Purpose:** Create database schema for Admin Customer Service Portal (Phase 1 MVP)

**Reference:** Jira ticket RG-54 (Epic RG-53 - Admin Portal)

**Why it's needed:**
- Enable admin customer service operations without direct database access
- Track all admin actions for compliance (GDPR, audit requirements)
- Support subscription management, refunds, and user impersonation
- Provide foundation for customer support scaling

**Changes:**

**1. Enhanced Profiles Table:**
- Adds `role` column (user/admin) with CHECK constraint
- Adds `is_active` column for account suspension
- Adds `suspension_reason` column for tracking why accounts are suspended
- Adds `email_verified_manually` column for admin email verification
- Adds `last_login_at` column for tracking user activity
- Adds `admin_notes` column for internal admin notes
- Adds custom plan fields:
  - `custom_plan_name` - Display name for custom plans
  - `custom_plan_type` - Type: lifetime, temporary, custom_price
  - `custom_plan_expires_at` - Expiration for temporary plans
  - `custom_plan_notes` - Admin notes explaining the grant
  - `plan_override_limits` - JSONB for custom feature limits

**2. New Tables:**

**admin_audit_log:**
- Tracks all admin actions for compliance and troubleshooting
- Columns: admin_user_id, action_type, target_type, target_id, changes (JSONB), reason, notes, ip_address, user_agent
- Indexed by: admin_user_id, (target_type, target_id), created_at, action_type
- Retention: 7 years (compliance requirement)

**login_history:**
- Tracks user login events including impersonation sessions
- Columns: user_id, login_at, ip_address, user_agent, login_method, impersonated_by
- Indexed by: user_id, login_at, impersonated_by
- Used for: Activity tracking, security monitoring, impersonation auditing

**refunds:**
- Tracks refund operations with reasons and admin accountability
- Columns: user_id, stripe_refund_id, stripe_charge_id, amount_cents, currency, reason_category, notes, refunded_by
- Indexed by: user_id, created_at, refunded_by, stripe_refund_id
- Required fields: reason_category (technical_issue, user_request, duplicate_charge, fraudulent, service_outage, other)

**impersonation_sessions:**
- Tracks admin impersonation sessions for security and compliance
- Columns: admin_user_id, target_user_id, started_at, ended_at, reason, ip_address, ended_by
- Indexed by: admin_user_id, target_user_id, started_at, active sessions (WHERE ended_at IS NULL)
- Used for: Security monitoring, compliance, session management

**3. Row Level Security (RLS) Policies:**
- All new tables have RLS enabled
- Admin audit log: Only admins can read/insert
- Login history: Users can see own, admins can see all
- Refunds: Admin-only access
- Impersonation sessions: Admin-only access

**4. Helper Functions:**

**is_admin():**
- Returns TRUE if authenticated user is an active admin
- SECURITY DEFINER function for safe role checking
- Used by: RLS policies, API routes

**log_admin_action():**
- Logs admin actions to audit_log table
- Parameters: action_type, target_type, target_id, changes, reason, notes, ip_address, user_agent
- Returns: UUID of created log entry
- Only callable by active admins

**Security Notes:**
- Admin-only access enforced via RLS policies
- All admin actions must be logged (audit trail)
- Impersonation sessions auto-expire after 15 minutes (application-level)
- Cannot impersonate other admin users (application-level check)
- PII access logged for GDPR compliance

**Impact:**
- Non-destructive migration (uses IF NOT EXISTS)
- Safe to run multiple times (idempotent)
- No data loss
- Adds columns with sensible defaults (won't break existing queries)
- Enables Phase 1 admin portal features

**To Apply:**

**Option A: Via Supabase Dashboard (Recommended)**
1. Go to Supabase Dashboard: https://nyacfskxqoumzzfvpysv.supabase.co
2. Navigate to SQL Editor
3. Copy contents of `supabase/migrations/20251110_admin_portal_schema.sql`
4. Paste and click Run

**Option B: Via Supabase CLI**
```bash
cd reviewgame/review-game
supabase db push
```

**After applying:**
- Admin roles can be assigned via:
  ```sql
  UPDATE profiles SET role = 'admin' WHERE email = 'admin@example.com';
  ```
- All new tables are ready for admin portal development
- RLS policies protect admin-only data
- Audit logging is active

**Next Steps:**
After applying migration:
1. Assign initial admin user(s)
2. Regenerate TypeScript types (see regenerate-types.md)
3. Create admin authentication middleware
4. Build admin portal routes at `/app/admin/*`

**Verification:**

Check if migration was successful:
```sql
-- Check new columns in profiles table
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'profiles'
AND column_name IN ('role', 'is_active', 'last_login_at', 'custom_plan_name')
ORDER BY column_name;

-- Check new tables exist
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('admin_audit_log', 'login_history', 'refunds', 'impersonation_sessions')
ORDER BY table_name;

-- Check RLS is enabled
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
AND tablename IN ('admin_audit_log', 'login_history', 'refunds', 'impersonation_sessions');

-- Test is_admin() function
SELECT public.is_admin(); -- Should return FALSE for non-admin users
```

**Rollback (If Needed):**

```sql
-- Drop new tables
DROP TABLE IF EXISTS impersonation_sessions CASCADE;
DROP TABLE IF EXISTS refunds CASCADE;
DROP TABLE IF EXISTS login_history CASCADE;
DROP TABLE IF EXISTS admin_audit_log CASCADE;

-- Drop functions
DROP FUNCTION IF EXISTS public.log_admin_action CASCADE;
DROP FUNCTION IF EXISTS public.is_admin CASCADE;

-- Remove new columns from profiles
ALTER TABLE profiles DROP COLUMN IF EXISTS role;
ALTER TABLE profiles DROP COLUMN IF EXISTS is_active;
ALTER TABLE profiles DROP COLUMN IF EXISTS suspension_reason;
ALTER TABLE profiles DROP COLUMN IF EXISTS email_verified_manually;
ALTER TABLE profiles DROP COLUMN IF EXISTS last_login_at;
ALTER TABLE profiles DROP COLUMN IF EXISTS admin_notes;
ALTER TABLE profiles DROP COLUMN IF EXISTS custom_plan_name;
ALTER TABLE profiles DROP COLUMN IF EXISTS custom_plan_type;
ALTER TABLE profiles DROP COLUMN IF EXISTS custom_plan_expires_at;
ALTER TABLE profiles DROP COLUMN IF EXISTS custom_plan_notes;
ALTER TABLE profiles DROP COLUMN IF EXISTS plan_override_limits;

-- Remove indexes
DROP INDEX IF EXISTS idx_profiles_role;
DROP INDEX IF EXISTS idx_profiles_is_active;
```

**Phase 1 Features Enabled by This Migration:**
- ✅ Teacher account management (view, edit, suspend, notes)
- ✅ Payment & subscription management (view history, refunds, grants)
- ✅ Custom plan assignments (lifetime, temporary, custom pricing)
- ✅ User impersonation (troubleshooting)
- ✅ Comprehensive audit logging (compliance)
- ✅ Login history tracking (security)

---
