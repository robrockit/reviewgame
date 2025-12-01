-- Migration: Update custom_plan_type constraint to include 'temporary_stripe'
-- Purpose: Allow tracking of temporary access grants via Stripe trials
-- Reference: RG-65 Grant Free Access feature
-- Created: 2025-12-01

-- Drop the existing constraint
ALTER TABLE profiles
DROP CONSTRAINT IF EXISTS profiles_custom_plan_type_check;

-- Add updated constraint with 'temporary_stripe' option
ALTER TABLE profiles
ADD CONSTRAINT profiles_custom_plan_type_check
CHECK (custom_plan_type IN ('lifetime', 'temporary', 'custom_price', 'temporary_stripe'));

-- Add comment explaining the types
COMMENT ON CONSTRAINT profiles_custom_plan_type_check ON profiles IS
'Custom plan types:
- lifetime: Permanent Premium access (no expiration)
- temporary: Time-limited access managed via database (uses custom_plan_expires_at)
- temporary_stripe: Time-limited access managed via Stripe trial (uses trial_end_date)
- custom_price: Custom pricing arrangement';
