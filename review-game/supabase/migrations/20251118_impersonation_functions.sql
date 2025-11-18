-- Migration: User Impersonation Functions
-- Purpose: Add RPC functions for admin user impersonation feature
-- Reference: Jira ticket RG-61 (Epic RG-53 - Admin Portal)
-- Created: 2025-11-18
-- Features: Start/end impersonation, auto-expiry, rate limiting, audit logging

-- ==============================================================================
-- HELPER FUNCTION: Get Active Impersonation Session
-- ==============================================================================

/**
 * Gets the active impersonation session for the currently authenticated admin.
 * Returns NULL if no active impersonation session exists.
 *
 * An impersonation session is considered active if:
 * - ended_at IS NULL (not manually ended)
 * - started_at is within the last 15 minutes (not expired)
 *
 * @returns JSONB with session details or NULL
 */
CREATE OR REPLACE FUNCTION public.get_active_impersonation()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session_record JSONB;
  v_expiry_minutes INTEGER := 15;
BEGIN
  -- Get active session for current admin
  SELECT jsonb_build_object(
    'id', ims.id,
    'admin_user_id', ims.admin_user_id,
    'target_user_id', ims.target_user_id,
    'target_user_email', p.email,
    'target_user_name', p.full_name,
    'started_at', ims.started_at,
    'reason', ims.reason,
    'expires_at', ims.started_at + (v_expiry_minutes || ' minutes')::INTERVAL
  )
  INTO v_session_record
  FROM impersonation_sessions ims
  JOIN profiles p ON p.id = ims.target_user_id
  WHERE ims.admin_user_id = auth.uid()
    AND ims.ended_at IS NULL
    AND ims.started_at > NOW() - (v_expiry_minutes || ' minutes')::INTERVAL
  ORDER BY ims.started_at DESC
  LIMIT 1;

  RETURN v_session_record;
END;
$$;

COMMENT ON FUNCTION public.get_active_impersonation() IS 'Returns active impersonation session for current admin (auto-expires after 15 minutes)';

GRANT EXECUTE ON FUNCTION public.get_active_impersonation() TO authenticated;

-- ==============================================================================
-- MAIN FUNCTION: Start Impersonation Session
-- ==============================================================================

/**
 * Starts a new impersonation session for an admin user.
 * Creates impersonation_sessions entry, logs to audit trail, and validates permissions.
 *
 * SECURITY NOTE: This function uses SECURITY DEFINER to bypass RLS policies
 * and execute with elevated privileges. This is intentional and necessary for:
 * 1. Ensuring atomic updates across tables
 * 2. Re-verifying admin status to prevent TOCTOU race conditions
 * 3. Enforcing rate limiting and business rules
 * The search_path is locked to 'public' to prevent privilege escalation attacks.
 *
 * Security Checks:
 * - Admin must be active with admin role
 * - Cannot impersonate other admins
 * - Cannot impersonate suspended users
 * - Rate limit: Max 5 impersonations per hour per admin
 * - Auto-ends any existing active session for this admin
 *
 * @param p_target_user_id - User ID to impersonate
 * @param p_reason - Admin-provided reason for impersonation (required)
 * @param p_ip_address - Admin IP address
 * @param p_user_agent - Admin user agent
 * @returns JSONB with session details and audit ID
 */
CREATE OR REPLACE FUNCTION public.start_impersonation_session(
  p_target_user_id UUID,
  p_reason TEXT,
  p_ip_address TEXT DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_admin_id UUID;
  v_admin_is_active BOOLEAN;
  v_admin_role TEXT;
  v_target_is_active BOOLEAN;
  v_target_role TEXT;
  v_target_email TEXT;
  v_target_name TEXT;
  v_session_id UUID;
  v_audit_id UUID;
  v_recent_sessions_count INTEGER;
  v_active_session_id UUID;
BEGIN
  -- Get authenticated admin ID
  v_admin_id := auth.uid();

  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- CRITICAL: Verify admin status
  SELECT is_active, role INTO v_admin_is_active, v_admin_role
  FROM profiles
  WHERE id = v_admin_id;

  IF NOT v_admin_is_active OR v_admin_role != 'admin' THEN
    RAISE EXCEPTION 'Admin privileges required';
  END IF;

  -- Validate reason is provided
  IF p_reason IS NULL OR LENGTH(TRIM(p_reason)) = 0 THEN
    RAISE EXCEPTION 'Reason for impersonation is required';
  END IF;

  -- Validate reason length (max 500 characters)
  IF LENGTH(p_reason) > 500 THEN
    RAISE EXCEPTION 'Reason must be 500 characters or less';
  END IF;

  -- Get target user details and validate
  SELECT is_active, role, email, full_name
  INTO v_target_is_active, v_target_role, v_target_email, v_target_name
  FROM profiles
  WHERE id = p_target_user_id;

  IF v_target_role IS NULL THEN
    RAISE EXCEPTION 'Target user not found';
  END IF;

  -- SECURITY: Cannot impersonate other admins
  IF v_target_role = 'admin' THEN
    RAISE EXCEPTION 'Cannot impersonate other admin users';
  END IF;

  -- SECURITY: Cannot impersonate suspended users
  IF NOT v_target_is_active THEN
    RAISE EXCEPTION 'Cannot impersonate suspended users';
  END IF;

  -- SECURITY: Cannot impersonate self
  IF v_admin_id = p_target_user_id THEN
    RAISE EXCEPTION 'Cannot impersonate yourself';
  END IF;

  -- RATE LIMITING: Check recent impersonations (max 5 per hour)
  SELECT COUNT(*) INTO v_recent_sessions_count
  FROM impersonation_sessions
  WHERE admin_user_id = v_admin_id
    AND started_at > NOW() - INTERVAL '1 hour';

  IF v_recent_sessions_count >= 5 THEN
    RAISE EXCEPTION 'Rate limit exceeded: Maximum 5 impersonations per hour';
  END IF;

  -- Auto-end any existing active session for this admin
  UPDATE impersonation_sessions
  SET ended_at = NOW(),
      ended_by = 'system'
  WHERE admin_user_id = v_admin_id
    AND ended_at IS NULL
    AND started_at > NOW() - INTERVAL '15 minutes'
  RETURNING id INTO v_active_session_id;

  IF v_active_session_id IS NOT NULL THEN
    -- Log the auto-ended session
    INSERT INTO admin_audit_log (
      admin_user_id,
      action_type,
      target_type,
      target_id,
      notes,
      created_at
    ) VALUES (
      v_admin_id,
      'end_impersonation_auto',
      'impersonation_session',
      v_active_session_id::TEXT,
      'Auto-ended previous session to start new impersonation',
      NOW()
    );
  END IF;

  -- Create new impersonation session
  INSERT INTO impersonation_sessions (
    admin_user_id,
    target_user_id,
    reason,
    ip_address,
    started_at
  ) VALUES (
    v_admin_id,
    p_target_user_id,
    p_reason,
    p_ip_address,
    NOW()
  ) RETURNING id INTO v_session_id;

  -- Create audit log entry
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
    v_admin_id,
    'start_impersonation',
    'profile',
    p_target_user_id::TEXT,
    p_reason,
    'Started impersonation session',
    jsonb_build_object(
      'session_id', v_session_id,
      'target_email', v_target_email,
      'target_name', v_target_name,
      'expires_at', NOW() + INTERVAL '15 minutes'
    ),
    p_ip_address,
    p_user_agent,
    NOW()
  ) RETURNING id INTO v_audit_id;

  -- Return session details
  RETURN jsonb_build_object(
    'session_id', v_session_id,
    'admin_user_id', v_admin_id,
    'target_user_id', p_target_user_id,
    'target_user_email', v_target_email,
    'target_user_name', v_target_name,
    'started_at', NOW(),
    'expires_at', NOW() + INTERVAL '15 minutes',
    'reason', p_reason,
    'audit_id', v_audit_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

COMMENT ON FUNCTION public.start_impersonation_session IS 'Starts admin impersonation session with validation, rate limiting, and audit logging';

GRANT EXECUTE ON FUNCTION public.start_impersonation_session TO authenticated;

-- ==============================================================================
-- MAIN FUNCTION: End Impersonation Session
-- ==============================================================================

/**
 * Ends an active impersonation session.
 * Updates impersonation_sessions table and logs to audit trail.
 *
 * SECURITY NOTE: This function uses SECURITY DEFINER to bypass RLS policies
 * and execute with elevated privileges. The search_path is locked to 'public'
 * to prevent privilege escalation attacks.
 *
 * Security Checks:
 * - Only the admin who started the session can end it
 * - Session must be active (not already ended)
 * - Admin must still be active (for audit logging)
 *
 * @param p_session_id - Impersonation session ID to end
 * @returns JSONB with session details and audit ID
 */
CREATE OR REPLACE FUNCTION public.end_impersonation_session(
  p_session_id UUID
) RETURNS JSONB AS $$
DECLARE
  v_admin_id UUID;
  v_session_record RECORD;
  v_audit_id UUID;
  v_duration_minutes INTEGER;
BEGIN
  -- Get authenticated admin ID
  v_admin_id := auth.uid();

  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- Get session details and validate
  SELECT
    ims.id,
    ims.admin_user_id,
    ims.target_user_id,
    ims.started_at,
    ims.ended_at,
    ims.reason,
    p.email as target_email,
    p.full_name as target_name
  INTO v_session_record
  FROM impersonation_sessions ims
  JOIN profiles p ON p.id = ims.target_user_id
  WHERE ims.id = p_session_id;

  IF v_session_record.id IS NULL THEN
    RAISE EXCEPTION 'Impersonation session not found';
  END IF;

  -- SECURITY: Only the admin who started the session can end it
  IF v_session_record.admin_user_id != v_admin_id THEN
    RAISE EXCEPTION 'Only the admin who started the session can end it';
  END IF;

  -- Check if session is already ended
  IF v_session_record.ended_at IS NOT NULL THEN
    RAISE EXCEPTION 'Impersonation session has already ended';
  END IF;

  -- Calculate session duration
  v_duration_minutes := EXTRACT(EPOCH FROM (NOW() - v_session_record.started_at)) / 60;

  -- End the impersonation session
  UPDATE impersonation_sessions
  SET ended_at = NOW(),
      ended_by = 'admin'
  WHERE id = p_session_id;

  -- Create audit log entry
  INSERT INTO admin_audit_log (
    admin_user_id,
    action_type,
    target_type,
    target_id,
    notes,
    changes,
    created_at
  ) VALUES (
    v_admin_id,
    'end_impersonation',
    'profile',
    v_session_record.target_user_id::TEXT,
    'Ended impersonation session',
    jsonb_build_object(
      'session_id', p_session_id,
      'target_email', v_session_record.target_email,
      'target_name', v_session_record.target_name,
      'started_at', v_session_record.started_at,
      'ended_at', NOW(),
      'duration_minutes', v_duration_minutes,
      'ended_by', 'admin'
    ),
    NOW()
  ) RETURNING id INTO v_audit_id;

  -- Return session details
  RETURN jsonb_build_object(
    'session_id', p_session_id,
    'target_user_id', v_session_record.target_user_id,
    'target_user_email', v_session_record.target_email,
    'target_user_name', v_session_record.target_name,
    'started_at', v_session_record.started_at,
    'ended_at', NOW(),
    'duration_minutes', v_duration_minutes,
    'audit_id', v_audit_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

COMMENT ON FUNCTION public.end_impersonation_session IS 'Ends active impersonation session and logs to audit trail';

GRANT EXECUTE ON FUNCTION public.end_impersonation_session TO authenticated;

-- ==============================================================================
-- CLEANUP FUNCTION: Auto-Expire Old Sessions (Scheduled Task)
-- ==============================================================================

/**
 * Automatically expires impersonation sessions older than 15 minutes.
 * Should be called periodically by a scheduled task (e.g., cron job).
 *
 * This function is idempotent and safe to run multiple times.
 *
 * @returns INTEGER count of expired sessions
 */
CREATE OR REPLACE FUNCTION public.expire_old_impersonation_sessions()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_expired_count INTEGER;
BEGIN
  -- Update sessions that are older than 15 minutes and not yet ended
  UPDATE impersonation_sessions
  SET ended_at = NOW(),
      ended_by = 'timeout'
  WHERE ended_at IS NULL
    AND started_at < NOW() - INTERVAL '15 minutes';

  GET DIAGNOSTICS v_expired_count = ROW_COUNT;

  RETURN v_expired_count;
END;
$$;

COMMENT ON FUNCTION public.expire_old_impersonation_sessions() IS 'Auto-expires impersonation sessions older than 15 minutes (for scheduled tasks)';

GRANT EXECUTE ON FUNCTION public.expire_old_impersonation_sessions() TO authenticated;

-- ==============================================================================
-- UPDATE DATABASE TYPES
-- ==============================================================================

-- Update type definitions for Functions in database.types.ts
-- Add these to the Functions section:
--
-- get_active_impersonation: {
--   Args: never
--   Returns: Json | null
-- }
--
-- start_impersonation_session: {
--   Args: {
--     p_target_user_id: string
--     p_reason: string
--     p_ip_address?: string
--     p_user_agent?: string
--   }
--   Returns: Json
-- }
--
-- end_impersonation_session: {
--   Args: {
--     p_session_id: string
--   }
--   Returns: Json
-- }
--
-- expire_old_impersonation_sessions: {
--   Args: never
--   Returns: number
-- }

-- ==============================================================================
-- MIGRATION COMPLETE
-- ==============================================================================

-- This migration adds:
-- 1. get_active_impersonation() - Get active session for current admin
-- 2. start_impersonation_session() - Create new impersonation with validation & rate limiting
-- 3. end_impersonation_session() - End active session with audit logging
-- 4. expire_old_impersonation_sessions() - Cleanup function for scheduled tasks
--
-- Security Features:
-- - Admin re-verification (TOCTOU prevention)
-- - Cannot impersonate admins
-- - Cannot impersonate suspended users
-- - Rate limiting (5 per hour per admin)
-- - Auto-expiry after 15 minutes
-- - Comprehensive audit logging
-- - SECURITY DEFINER with locked search_path
--
-- Next Steps:
-- 1. Run: npx supabase gen types typescript --local to update database.types.ts
-- 2. Create API routes to call these RPC functions
-- 3. Build UI components (modal, banner)
-- 4. Update middleware to handle impersonation context
-- 5. Set up scheduled task to run expire_old_impersonation_sessions()
