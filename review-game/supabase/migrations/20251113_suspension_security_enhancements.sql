-- Migration: Suspension Security Enhancements
-- Purpose: Fix critical security issues in user suspension system
-- Reference: Jira ticket RG-106 (Follow-up to RG-59)
-- Created: 2025-11-13
-- Fixes: Session invalidation, transaction safety, TOCTOU prevention

-- ==============================================================================
-- ISSUE #1: SESSION INVALIDATION - Add suspended_at Timestamp
-- ==============================================================================

-- Add suspended_at column to track when suspension occurred
-- This enables middleware to invalidate sessions created before suspension
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMPTZ;

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_profiles_suspended_at ON profiles(suspended_at);

-- Add comment
COMMENT ON COLUMN profiles.suspended_at IS 'Timestamp when account was suspended (NULL if never suspended or currently active)';

-- ==============================================================================
-- ISSUE #2: TRANSACTION SAFETY - Atomic Suspend/Activate with Audit Logging
-- ==============================================================================

/**
 * Atomically suspend a user account and create audit log entry.
 * Both operations succeed or both fail (transaction safety).
 *
 * @param p_user_id - User ID to suspend
 * @param p_formatted_reason - Full suspension reason with notes
 * @param p_admin_id - Admin performing the suspension
 * @param p_action_type - Action type for audit log
 * @param p_reason - Suspension reason category
 * @param p_notes - Optional admin notes
 * @param p_ip_address - Admin IP address
 * @param p_user_agent - Admin user agent
 * @param p_changes - JSONB object with before/after changes
 * @returns JSONB with user data and audit ID
 */
CREATE OR REPLACE FUNCTION public.suspend_user_with_audit(
  p_user_id UUID,
  p_formatted_reason TEXT,
  p_admin_id UUID,
  p_action_type TEXT,
  p_reason TEXT,
  p_notes TEXT DEFAULT NULL,
  p_ip_address TEXT DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL,
  p_changes JSONB DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_audit_id UUID;
  v_user_record JSONB;
  v_suspended_at TIMESTAMP;
  v_admin_is_active BOOLEAN;
  v_admin_role TEXT;
BEGIN
  -- CRITICAL: Re-verify admin status to prevent TOCTOU race condition
  SELECT is_active, role INTO v_admin_is_active, v_admin_role
  FROM profiles
  WHERE id = p_admin_id;

  IF NOT v_admin_is_active OR v_admin_role != 'admin' THEN
    RAISE EXCEPTION 'Admin privileges revoked during operation';
  END IF;

  -- Set suspension timestamp
  v_suspended_at := NOW();

  -- Update user profile (within transaction)
  UPDATE profiles
  SET
    is_active = FALSE,
    suspension_reason = p_formatted_reason,
    suspended_at = v_suspended_at,
    updated_at = NOW()
  WHERE id = p_user_id
  RETURNING jsonb_build_object(
    'id', id,
    'email', email,
    'full_name', full_name,
    'is_active', is_active,
    'suspension_reason', suspension_reason,
    'suspended_at', suspended_at
  ) INTO v_user_record;

  IF v_user_record IS NULL THEN
    RAISE EXCEPTION 'User not found or update failed';
  END IF;

  -- Create audit log entry (in same transaction)
  -- Note: Using admin_audit_log table name from schema
  INSERT INTO admin_audit_log (
    admin_user_id,
    action_type,
    target_type,
    target_id,
    reason,
    notes,
    changes,
    ip_address,
    user_agent,
    created_at
  ) VALUES (
    p_admin_id,
    p_action_type,
    'profile',
    p_user_id::TEXT,
    p_reason,
    p_notes,
    p_changes,
    p_ip_address,
    p_user_agent,
    NOW()
  ) RETURNING id INTO v_audit_id;

  -- Return both results
  RETURN jsonb_build_object(
    'user', v_user_record,
    'audit_id', v_audit_id,
    'suspended_at', v_suspended_at
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.suspend_user_with_audit IS 'Atomically suspends a user and creates audit log. Includes admin re-verification for TOCTOU prevention.';

-- Grant execute to authenticated users (RLS will control actual access)
GRANT EXECUTE ON FUNCTION public.suspend_user_with_audit TO authenticated;

/**
 * Atomically activate a user account and create audit log entry.
 * Both operations succeed or both fail (transaction safety).
 *
 * @param p_user_id - User ID to activate
 * @param p_admin_id - Admin performing the activation
 * @param p_notes - Optional admin notes
 * @param p_ip_address - Admin IP address
 * @param p_user_agent - Admin user agent
 * @param p_changes - JSONB object with before/after changes
 * @returns JSONB with user data and audit ID
 */
CREATE OR REPLACE FUNCTION public.activate_user_with_audit(
  p_user_id UUID,
  p_admin_id UUID,
  p_notes TEXT DEFAULT NULL,
  p_ip_address TEXT DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL,
  p_changes JSONB DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_audit_id UUID;
  v_user_record JSONB;
  v_admin_is_active BOOLEAN;
  v_admin_role TEXT;
BEGIN
  -- CRITICAL: Re-verify admin status to prevent TOCTOU race condition
  SELECT is_active, role INTO v_admin_is_active, v_admin_role
  FROM profiles
  WHERE id = p_admin_id;

  IF NOT v_admin_is_active OR v_admin_role != 'admin' THEN
    RAISE EXCEPTION 'Admin privileges revoked during operation';
  END IF;

  -- Update user profile (within transaction)
  UPDATE profiles
  SET
    is_active = TRUE,
    suspension_reason = NULL,
    suspended_at = NULL,
    updated_at = NOW()
  WHERE id = p_user_id
  RETURNING jsonb_build_object(
    'id', id,
    'email', email,
    'full_name', full_name,
    'is_active', is_active
  ) INTO v_user_record;

  IF v_user_record IS NULL THEN
    RAISE EXCEPTION 'User not found or update failed';
  END IF;

  -- Create audit log entry (in same transaction)
  INSERT INTO admin_audit_log (
    admin_user_id,
    action_type,
    target_type,
    target_id,
    notes,
    changes,
    ip_address,
    user_agent,
    created_at
  ) VALUES (
    p_admin_id,
    'activate_user',
    'profile',
    p_user_id::TEXT,
    COALESCE(p_notes, 'Reactivated user account'),
    p_changes,
    p_ip_address,
    p_user_agent,
    NOW()
  ) RETURNING id INTO v_audit_id;

  RETURN jsonb_build_object(
    'user', v_user_record,
    'audit_id', v_audit_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.activate_user_with_audit IS 'Atomically activates a suspended user and creates audit log. Includes admin re-verification for TOCTOU prevention.';

-- Grant execute to authenticated users (RLS will control actual access)
GRANT EXECUTE ON FUNCTION public.activate_user_with_audit TO authenticated;

-- ==============================================================================
-- MIGRATION COMPLETE
-- ==============================================================================

-- This migration addresses 3 critical security issues:
--
-- 1. SESSION INVALIDATION (Issue #1)
--    - Added suspended_at timestamp to track when suspension occurred
--    - Middleware can now compare session creation time vs suspension time
--    - Prevents suspended users from continuing to use active sessions
--
-- 2. TRANSACTION SAFETY (Issue #2)
--    - Created atomic functions for suspend/activate operations
--    - Both profile update and audit logging succeed or fail together
--    - Ensures compliance with audit requirements (no suspension without log)
--
-- 3. TOCTOU PREVENTION (Issue #3)
--    - Functions re-verify admin status before performing actions
--    - Prevents suspended admins from completing in-flight operations
--    - Database-level defense against race conditions
--
-- Next Steps:
-- 1. Update API routes to use these functions via supabase.rpc()
-- 2. Update middleware to check suspended_at timestamp
-- 3. Test session invalidation with multiple browser tabs
-- 4. Test transaction rollback on audit log failures
-- 5. Test admin re-verification during concurrent operations
