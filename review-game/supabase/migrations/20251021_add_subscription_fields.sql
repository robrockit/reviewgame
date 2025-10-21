-- Add additional subscription tracking fields to profiles table
-- Migration: Add stripe_subscription_id and current_period_end

-- Add stripe_subscription_id column to store the Stripe subscription ID
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT;

-- Add current_period_end column to track when the current billing period ends
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS current_period_end TIMESTAMPTZ;

-- Add index on stripe_subscription_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_profiles_stripe_subscription_id
ON profiles(stripe_subscription_id);

-- Add comment for documentation
COMMENT ON COLUMN profiles.stripe_subscription_id IS 'Stripe subscription ID for the user';
COMMENT ON COLUMN profiles.current_period_end IS 'End date of the current subscription billing period';
