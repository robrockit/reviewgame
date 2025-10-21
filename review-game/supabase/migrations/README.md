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
