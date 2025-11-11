-- Migration: Admin Portal Database Schema
-- Purpose: Create tables and fields to support admin customer service portal
-- Reference: Jira ticket RG-54 (Epic RG-53 - Admin Portal)
-- Created: 2025-11-10
-- Phase: Phase 1 (MVP) - Core Customer Service Operations

-- ==============================================================================
-- PROFILES TABLE ENHANCEMENTS
-- ==============================================================================

-- Add admin role and account management fields
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'user' CHECK (role IN ('user', 'admin'));

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS suspension_reason TEXT;

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS email_verified_manually BOOLEAN DEFAULT FALSE;

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS admin_notes TEXT;

-- Add custom plan fields for manual plan overrides
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS custom_plan_name TEXT;

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS custom_plan_type TEXT CHECK (custom_plan_type IN ('lifetime', 'temporary', 'custom_price'));

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS custom_plan_expires_at TIMESTAMPTZ;

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS custom_plan_notes TEXT;

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS plan_override_limits JSONB;

-- Add indexes for performance on profiles table
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_subscription_status ON profiles(subscription_status);
CREATE INDEX IF NOT EXISTS idx_profiles_last_login ON profiles(last_login_at);
CREATE INDEX IF NOT EXISTS idx_profiles_is_active ON profiles(is_active);

-- Add comments for documentation
COMMENT ON COLUMN profiles.role IS 'User role: user (default) or admin';
COMMENT ON COLUMN profiles.is_active IS 'Account status - false if suspended/deactivated';
COMMENT ON COLUMN profiles.suspension_reason IS 'Reason for account suspension';
COMMENT ON COLUMN profiles.email_verified_manually IS 'Admin manually verified email address';
COMMENT ON COLUMN profiles.last_login_at IS 'Timestamp of last successful login';
COMMENT ON COLUMN profiles.admin_notes IS 'Internal admin notes about this user';
COMMENT ON COLUMN profiles.custom_plan_name IS 'Custom plan name (e.g., Educational Grant)';
COMMENT ON COLUMN profiles.custom_plan_type IS 'Type of custom plan override';
COMMENT ON COLUMN profiles.custom_plan_expires_at IS 'Expiration date for temporary custom plans';
COMMENT ON COLUMN profiles.custom_plan_notes IS 'Admin notes explaining why custom plan was granted';
COMMENT ON COLUMN profiles.plan_override_limits IS 'JSON object with custom feature limits';

-- ==============================================================================
-- ADMIN AUDIT LOG TABLE
-- ==============================================================================

CREATE TABLE IF NOT EXISTS admin_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  action_type TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  changes JSONB,
  reason TEXT,
  notes TEXT,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for audit log queries
CREATE INDEX IF NOT EXISTS idx_audit_admin_user ON admin_audit_log(admin_user_id);
CREATE INDEX IF NOT EXISTS idx_audit_target ON admin_audit_log(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_audit_created_at ON admin_audit_log(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_action_type ON admin_audit_log(action_type);

-- Comments for audit log table
COMMENT ON TABLE admin_audit_log IS 'Tracks all admin actions for compliance and troubleshooting';
COMMENT ON COLUMN admin_audit_log.admin_user_id IS 'Admin user who performed the action';
COMMENT ON COLUMN admin_audit_log.action_type IS 'Type of action (view, edit, delete, refund, etc.)';
COMMENT ON COLUMN admin_audit_log.target_type IS 'Type of entity affected (profile, subscription, question_bank, etc.)';
COMMENT ON COLUMN admin_audit_log.target_id IS 'ID of the affected entity';
COMMENT ON COLUMN admin_audit_log.changes IS 'JSON object with before/after values for edits';
COMMENT ON COLUMN admin_audit_log.reason IS 'Admin-provided reason for the action';
COMMENT ON COLUMN admin_audit_log.notes IS 'Additional context or notes';
COMMENT ON COLUMN admin_audit_log.ip_address IS 'IP address of admin at time of action';
COMMENT ON COLUMN admin_audit_log.user_agent IS 'Browser user agent string';

-- ==============================================================================
-- LOGIN HISTORY TABLE
-- ==============================================================================

CREATE TABLE IF NOT EXISTS login_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  login_at TIMESTAMPTZ DEFAULT NOW(),
  ip_address TEXT,
  user_agent TEXT,
  login_method TEXT CHECK (login_method IN ('password', 'google_oauth', 'impersonation', 'email_link')),
  impersonated_by UUID REFERENCES profiles(id) ON DELETE SET NULL
);

-- Indexes for login history queries
CREATE INDEX IF NOT EXISTS idx_login_user_id ON login_history(user_id);
CREATE INDEX IF NOT EXISTS idx_login_at ON login_history(login_at);
CREATE INDEX IF NOT EXISTS idx_login_impersonated_by ON login_history(impersonated_by);

-- Comments for login history table
COMMENT ON TABLE login_history IS 'Tracks user login events including impersonation sessions';
COMMENT ON COLUMN login_history.user_id IS 'User who logged in';
COMMENT ON COLUMN login_history.login_at IS 'Timestamp of login';
COMMENT ON COLUMN login_history.login_method IS 'Authentication method used';
COMMENT ON COLUMN login_history.impersonated_by IS 'Admin user ID if this was an impersonation login';

-- ==============================================================================
-- REFUNDS TABLE
-- ==============================================================================

CREATE TABLE IF NOT EXISTS refunds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  stripe_refund_id TEXT NOT NULL UNIQUE,
  stripe_charge_id TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  currency TEXT DEFAULT 'usd',
  reason_category TEXT NOT NULL CHECK (reason_category IN (
    'technical_issue',
    'user_request',
    'duplicate_charge',
    'fraudulent',
    'service_outage',
    'other'
  )),
  notes TEXT,
  refunded_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for refunds queries
CREATE INDEX IF NOT EXISTS idx_refunds_user_id ON refunds(user_id);
CREATE INDEX IF NOT EXISTS idx_refunds_created_at ON refunds(created_at);
CREATE INDEX IF NOT EXISTS idx_refunds_refunded_by ON refunds(refunded_by);
CREATE INDEX IF NOT EXISTS idx_refunds_stripe_refund_id ON refunds(stripe_refund_id);

-- Comments for refunds table
COMMENT ON TABLE refunds IS 'Tracks all refund operations with reasons and admin accountability';
COMMENT ON COLUMN refunds.user_id IS 'User who received the refund';
COMMENT ON COLUMN refunds.stripe_refund_id IS 'Stripe refund ID (unique)';
COMMENT ON COLUMN refunds.stripe_charge_id IS 'Original Stripe charge ID that was refunded';
COMMENT ON COLUMN refunds.amount_cents IS 'Refund amount in cents';
COMMENT ON COLUMN refunds.currency IS 'Currency code (default: usd)';
COMMENT ON COLUMN refunds.reason_category IS 'Categorized reason for refund';
COMMENT ON COLUMN refunds.notes IS 'Additional context about the refund';
COMMENT ON COLUMN refunds.refunded_by IS 'Admin user who issued the refund';

-- ==============================================================================
-- IMPERSONATION SESSIONS TABLE
-- ==============================================================================

CREATE TABLE IF NOT EXISTS impersonation_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  target_user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  reason TEXT,
  ip_address TEXT,
  ended_by TEXT CHECK (ended_by IN ('admin', 'timeout', 'system'))
);

-- Indexes for impersonation sessions queries
CREATE INDEX IF NOT EXISTS idx_impersonation_admin ON impersonation_sessions(admin_user_id);
CREATE INDEX IF NOT EXISTS idx_impersonation_target ON impersonation_sessions(target_user_id);
CREATE INDEX IF NOT EXISTS idx_impersonation_started_at ON impersonation_sessions(started_at);
CREATE INDEX IF NOT EXISTS idx_impersonation_active ON impersonation_sessions(ended_at) WHERE ended_at IS NULL;

-- Comments for impersonation sessions table
COMMENT ON TABLE impersonation_sessions IS 'Tracks admin impersonation sessions for security and compliance';
COMMENT ON COLUMN impersonation_sessions.admin_user_id IS 'Admin user performing the impersonation';
COMMENT ON COLUMN impersonation_sessions.target_user_id IS 'User being impersonated';
COMMENT ON COLUMN impersonation_sessions.started_at IS 'When impersonation session started';
COMMENT ON COLUMN impersonation_sessions.ended_at IS 'When impersonation session ended (NULL if active)';
COMMENT ON COLUMN impersonation_sessions.reason IS 'Admin-provided reason for impersonation';
COMMENT ON COLUMN impersonation_sessions.ip_address IS 'IP address of admin during impersonation';
COMMENT ON COLUMN impersonation_sessions.ended_by IS 'How the session ended (admin, timeout, system)';

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================

-- Enable RLS on new tables
ALTER TABLE admin_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE login_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE refunds ENABLE ROW LEVEL SECURITY;
ALTER TABLE impersonation_sessions ENABLE ROW LEVEL SECURITY;

-- Admin audit log policies: Only admins can read, system can insert
CREATE POLICY admin_audit_log_read_policy ON admin_audit_log
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
      AND profiles.is_active = TRUE
    )
  );

CREATE POLICY admin_audit_log_insert_policy ON admin_audit_log
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
      AND profiles.is_active = TRUE
    )
  );

-- Login history policies: Users can see their own, admins can see all
CREATE POLICY login_history_user_read_policy ON login_history
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY login_history_admin_read_policy ON login_history
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
      AND profiles.is_active = TRUE
    )
  );

CREATE POLICY login_history_insert_policy ON login_history
  FOR INSERT
  TO authenticated
  WITH CHECK (TRUE); -- System can insert for any user

-- Refunds policies: Only admins can access
CREATE POLICY refunds_admin_policy ON refunds
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
      AND profiles.is_active = TRUE
    )
  );

-- Impersonation sessions policies: Only admins can access
CREATE POLICY impersonation_sessions_admin_policy ON impersonation_sessions
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
      AND profiles.is_active = TRUE
    )
  );

-- ==============================================================================
-- HELPER FUNCTIONS
-- ==============================================================================

-- Function to check if a user is an admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin BOOLEAN;
BEGIN
  SELECT (role = 'admin' AND is_active = TRUE)
  INTO v_is_admin
  FROM profiles
  WHERE id = auth.uid();

  RETURN COALESCE(v_is_admin, FALSE);
END;
$$;

COMMENT ON FUNCTION public.is_admin() IS 'Returns true if the authenticated user is an active admin';

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

-- Function to log admin actions (to be called from API routes)
CREATE OR REPLACE FUNCTION public.log_admin_action(
  p_action_type TEXT,
  p_target_type TEXT,
  p_target_id TEXT,
  p_changes JSONB DEFAULT NULL,
  p_reason TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL,
  p_ip_address TEXT DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_log_id UUID;
BEGIN
  -- Verify caller is an admin
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only admins can log actions';
  END IF;

  -- Insert audit log entry
  INSERT INTO admin_audit_log (
    admin_user_id,
    action_type,
    target_type,
    target_id,
    changes,
    reason,
    notes,
    ip_address,
    user_agent
  ) VALUES (
    auth.uid(),
    p_action_type,
    p_target_type,
    p_target_id,
    p_changes,
    p_reason,
    p_notes,
    p_ip_address,
    p_user_agent
  )
  RETURNING id INTO v_log_id;

  RETURN v_log_id;
END;
$$;

COMMENT ON FUNCTION public.log_admin_action IS 'Logs an admin action to the audit log. Only callable by active admins.';

-- Grant execute permission to authenticated users (function checks admin status internally)
GRANT EXECUTE ON FUNCTION public.log_admin_action TO authenticated;

-- ==============================================================================
-- MIGRATION COMPLETE
-- ==============================================================================

-- This migration creates:
-- 1. Enhanced profiles table with admin role and custom plan fields
-- 2. admin_audit_log table for tracking all admin actions
-- 3. login_history table for tracking user logins and impersonation
-- 4. refunds table for tracking refund operations
-- 5. impersonation_sessions table for tracking active/historical impersonation
-- 6. RLS policies to secure admin-only access
-- 7. Helper functions for admin checks and audit logging
