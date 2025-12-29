-- Migration: Webhook Idempotency Tracking
-- Description: Adds table to track processed Stripe webhook events for idempotency
-- Date: 2025-12-29
-- Related: RG-83

-- Create table to track processed Stripe webhook events
CREATE TABLE IF NOT EXISTS processed_stripe_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_event_id TEXT UNIQUE NOT NULL,
  event_type TEXT NOT NULL,
  processed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_processed_stripe_events_stripe_event_id
  ON processed_stripe_events(stripe_event_id);

CREATE INDEX IF NOT EXISTS idx_processed_stripe_events_event_type
  ON processed_stripe_events(event_type);

CREATE INDEX IF NOT EXISTS idx_processed_stripe_events_created_at
  ON processed_stripe_events(created_at);

-- Add comment explaining the table purpose
COMMENT ON TABLE processed_stripe_events IS
  'Tracks processed Stripe webhook events to ensure idempotency. Prevents duplicate event processing when Stripe resends webhooks.';

COMMENT ON COLUMN processed_stripe_events.stripe_event_id IS
  'Unique Stripe event ID from the webhook payload (evt_xxx)';

COMMENT ON COLUMN processed_stripe_events.event_type IS
  'Stripe event type (e.g., checkout.session.completed, invoice.payment_succeeded)';

COMMENT ON COLUMN processed_stripe_events.processed_at IS
  'Timestamp when the webhook event was successfully processed';

-- Enable Row Level Security
ALTER TABLE processed_stripe_events ENABLE ROW LEVEL SECURITY;

-- Policy: Service role can read/write (for webhook handler)
-- This is the primary access pattern - webhooks use service role
CREATE POLICY "Service role can manage webhook events"
ON processed_stripe_events
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Policy: Admins can read for debugging and monitoring
-- Allows admin users to query webhook processing history
CREATE POLICY "Admins can read webhook events"
ON processed_stripe_events
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role = 'admin'
  )
);

-- Optional: Add retention policy to clean up old events (keep 90 days)
-- This prevents the table from growing indefinitely
CREATE OR REPLACE FUNCTION cleanup_old_stripe_events()
RETURNS void AS $$
BEGIN
  DELETE FROM processed_stripe_events
  WHERE created_at < NOW() - INTERVAL '90 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Schedule cleanup to run daily (requires pg_cron extension)
-- Uncomment if pg_cron is enabled:
-- SELECT cron.schedule(
--   'cleanup-old-stripe-events',
--   '0 2 * * *', -- Run at 2 AM daily
--   'SELECT cleanup_old_stripe_events();'
-- );
