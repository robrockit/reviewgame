# Regenerate Database Types After Migration

After running the `20251021_add_subscription_fields.sql` migration, you need to regenerate the TypeScript types to include the new fields.

## Steps:

### 1. Run the Migration

**Option A: Via Supabase Dashboard (Recommended)**
```
1. Go to: https://nyacfskxqoumzzfvpysv.supabase.co
2. Navigate to SQL Editor
3. Copy contents of: supabase/migrations/20251021_add_subscription_fields.sql
4. Paste and Run
```

**Option B: Via Supabase CLI**
```bash
cd reviewgame/review-game
supabase db push
```

### 2. Regenerate TypeScript Types

**Using Supabase CLI:**
```bash
# Generate types from your remote database
npx supabase gen types typescript --project-id nyacfskxqoumzzfvpysv > types/database.types.ts
```

**Or manually via Supabase Dashboard:**
```
1. Go to: https://nyacfskxqoumzzfvpysv.supabase.co
2. Navigate to Settings → API
3. Copy the TypeScript definitions
4. Replace contents of types/database.types.ts
```

### 3. Verify New Fields

After regeneration, the `profiles` table should include:
- ✅ `stripe_customer_id: string | null`
- ✅ `stripe_subscription_id: string | null` ← NEW
- ✅ `subscription_status: string | null`
- ✅ `trial_end_date: string | null`
- ✅ `current_period_end: string | null` ← NEW

### 4. Run Type Check

```bash
npx tsc --noEmit
```

Should now pass with 0 errors!

## What This Fixes

These fields enable the Stripe webhook to properly track:
- **stripe_subscription_id**: Direct reference to the Stripe subscription for management
- **current_period_end**: Display next billing date to users
