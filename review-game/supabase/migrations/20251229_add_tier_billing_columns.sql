-- Migration: Add subscription tier and billing cycle columns
-- Description: Adds columns needed for 3-tier pricing structure (FREE, BASIC, PREMIUM)
-- Date: 2025-12-29
-- Related: RG-83
-- IMPORTANT: This migration must run BEFORE 20251229_webhook_idempotency_tracking.sql

-- Add subscription_tier column with constraint
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS subscription_tier TEXT DEFAULT 'FREE'
CHECK (subscription_tier IN ('FREE', 'BASIC', 'PREMIUM'));

-- Add billing_cycle column with constraint
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS billing_cycle TEXT
CHECK (billing_cycle IN ('monthly', 'annual'));

-- Add index for efficient tier-based queries
CREATE INDEX IF NOT EXISTS idx_profiles_subscription_tier
ON profiles(subscription_tier);

-- Add index for billing cycle queries
CREATE INDEX IF NOT EXISTS idx_profiles_billing_cycle
ON profiles(billing_cycle);

-- Add comments explaining the columns
COMMENT ON COLUMN profiles.subscription_tier IS
  'User subscription tier: FREE (default), BASIC, or PREMIUM. Determines access to features like custom question banks, AI, analytics.';

COMMENT ON COLUMN profiles.billing_cycle IS
  'Billing cycle for paid subscriptions: monthly or annual. NULL for FREE tier users.';

-- Update existing users to have FREE tier if null
-- This is safe because subscription_tier has a default of 'FREE'
-- and we're only updating NULL values
UPDATE profiles
SET subscription_tier = 'FREE'
WHERE subscription_tier IS NULL;

-- Note: We intentionally do NOT update subscription_status here
-- The existing check constraint on subscription_status has specific allowed values
-- that are managed by the subscription system (TRIAL, ACTIVE, INACTIVE, etc.)
-- Changing these values could break existing functionality
