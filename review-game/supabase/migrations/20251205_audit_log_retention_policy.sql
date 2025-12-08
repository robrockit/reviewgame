-- Migration: Audit Log Retention Policy
-- Purpose: Implement 7-year retention policy for admin_audit_log table
-- Reference: RG-68 Basic Audit Logging
-- Created: 2025-12-05

-- ==============================================================================
-- RETENTION POLICY FUNCTION
-- ==============================================================================

/**
 * Function to delete admin_audit_log entries older than 7 years
 *
 * This function should be called periodically (e.g., via cron job or scheduled task)
 * to maintain the 7-year retention policy for compliance.
 *
 * Returns: Number of records deleted
 *
 * Usage:
 * - Manual: SELECT cleanup_old_audit_logs();
 * - Cron (if pg_cron is enabled):
 *   SELECT cron.schedule('cleanup-audit-logs', '0 2 * * 0', 'SELECT cleanup_old_audit_logs()');
 *   (Runs every Sunday at 2 AM)
 */
CREATE OR REPLACE FUNCTION public.cleanup_old_audit_logs()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted_count INTEGER;
  v_retention_date TIMESTAMPTZ;
  v_role TEXT;
BEGIN
  -- Get the current database role
  v_role := current_setting('role', true);

  -- CRITICAL: Verify caller is an admin or service role (prevents unauthorized audit log deletion)
  -- Service role is used by GitHub Actions and other automated systems
  -- is_admin() checks if the authenticated user has admin privileges
  IF v_role != 'service_role' AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only admins or service role can execute cleanup_old_audit_logs()';
  END IF;

  -- Calculate retention cutoff date (7 years ago)
  v_retention_date := NOW() - INTERVAL '7 years';

  -- Delete old audit log entries
  DELETE FROM admin_audit_log
  WHERE created_at < v_retention_date;

  -- Get number of deleted records
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

  -- Log the cleanup operation
  RAISE NOTICE 'Deleted % audit log entries older than %', v_deleted_count, v_retention_date;

  RETURN v_deleted_count;
END;
$$;

COMMENT ON FUNCTION public.cleanup_old_audit_logs() IS
'Deletes admin_audit_log entries older than 7 years for compliance. Returns number of records deleted. Should be called periodically via cron or scheduled task.';

-- Grant execute permission to authenticated users (only admins can execute due to SECURITY DEFINER)
GRANT EXECUTE ON FUNCTION public.cleanup_old_audit_logs() TO authenticated;

-- ==============================================================================
-- OPTIONAL: pg_cron SETUP (if pg_cron extension is available)
-- ==============================================================================

-- Uncomment the following lines if pg_cron extension is available:
-- This will automatically run the cleanup every Sunday at 2 AM UTC

/*
-- Enable pg_cron extension (requires superuser)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule weekly cleanup (every Sunday at 2 AM UTC)
SELECT cron.schedule(
  'cleanup-audit-logs',
  '0 2 * * 0',
  'SELECT public.cleanup_old_audit_logs()'
);

-- To view scheduled jobs:
-- SELECT * FROM cron.job;

-- To unschedule the job:
-- SELECT cron.unschedule('cleanup-audit-logs');
*/

-- ==============================================================================
-- MIGRATION NOTES
-- ==============================================================================

-- This migration creates a retention policy function for the admin_audit_log table.
--
-- IMPLEMENTATION OPTIONS:
--
-- 1. Manual execution (current default):
--    - Call SELECT cleanup_old_audit_logs(); periodically via external scheduler
--    - Suitable for environments without pg_cron
--
-- 2. Automated with pg_cron (optional):
--    - Uncomment the pg_cron section above
--    - Requires pg_cron extension and superuser privileges
--    - Automatically runs cleanup weekly
--
-- 3. External scheduler:
--    - Use system cron, GitHub Actions, or cloud scheduler
--    - Call via psql or API: SELECT cleanup_old_audit_logs();
--
-- VERIFICATION:
-- - Check current oldest record:
--   SELECT MIN(created_at) FROM admin_audit_log;
-- - Dry run (count records that would be deleted):
--   SELECT COUNT(*) FROM admin_audit_log WHERE created_at < (NOW() - INTERVAL '7 years');
