-- Migration: Enable Automated Audit Log Cleanup (pg_cron)
-- Purpose: Schedule weekly cleanup of audit logs older than 7 years
-- Prerequisite: pg_cron extension must be enabled (requires superuser/Supabase support)
-- Created: 2025-12-05

-- ==============================================================================
-- ENABLE pg_cron EXTENSION
-- ==============================================================================

-- Note: This may require contacting Supabase support or having superuser privileges
-- For Supabase hosted projects, you can enable this via the Dashboard or contact support

-- Uncomment if you have permission to enable extensions:
-- CREATE EXTENSION IF NOT EXISTS pg_cron;

-- ==============================================================================
-- SCHEDULE WEEKLY CLEANUP JOB
-- ==============================================================================

-- Schedule cleanup to run every Sunday at 2:00 AM UTC
-- This uses standard cron syntax: minute hour day month weekday
-- '0 2 * * 0' means: minute 0, hour 2, any day, any month, Sunday (0 or 7)

-- Uncomment after pg_cron is enabled:
/*
SELECT cron.schedule(
  'cleanup-audit-logs',           -- Job name
  '0 2 * * 0',                     -- Cron schedule (every Sunday at 2 AM UTC)
  $$SELECT public.cleanup_old_audit_logs();$$  -- SQL command to execute
);
*/

-- ==============================================================================
-- VERIFY SCHEDULED JOBS
-- ==============================================================================

-- To view all scheduled jobs:
-- SELECT * FROM cron.job;

-- Expected output should show:
-- jobid | schedule  | command                                      | nodename  | nodeport | database | username | active | jobname
-- ------+-----------+----------------------------------------------+-----------+----------+----------+----------+--------+------------------
--     1 | 0 2 * * 0 | SELECT public.cleanup_old_audit_logs();      | localhost |     5432 | postgres | postgres | t      | cleanup-audit-logs

-- ==============================================================================
-- MANAGE SCHEDULED JOBS
-- ==============================================================================

-- To view job execution history:
-- SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 10;

-- To unschedule the job (if needed):
-- SELECT cron.unschedule('cleanup-audit-logs');

-- To modify the schedule, unschedule and reschedule:
-- SELECT cron.unschedule('cleanup-audit-logs');
-- SELECT cron.schedule('cleanup-audit-logs', '0 3 * * 0', $$SELECT public.cleanup_old_audit_logs();$$);

-- ==============================================================================
-- TESTING THE SCHEDULED JOB
-- ==============================================================================

-- To manually test the function (requires admin privileges):
-- SELECT public.cleanup_old_audit_logs();

-- To test the cron job runs correctly, check the job run details:
-- SELECT * FROM cron.job_run_details WHERE jobname = 'cleanup-audit-logs' ORDER BY start_time DESC LIMIT 5;

-- ==============================================================================
-- MONITORING
-- ==============================================================================

-- Set up alerts for failed job runs by querying cron.job_run_details
-- where status = 'failed' for the 'cleanup-audit-logs' job

-- Example query to check for failures in the last 7 days:
/*
SELECT
  jobname,
  start_time,
  end_time,
  status,
  return_message
FROM cron.job_run_details
WHERE jobname = 'cleanup-audit-logs'
  AND start_time > NOW() - INTERVAL '7 days'
  AND status = 'failed'
ORDER BY start_time DESC;
*/
