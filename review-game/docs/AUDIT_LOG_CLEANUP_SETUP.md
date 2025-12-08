# Audit Log Cleanup Setup Guide

This guide explains how to configure automated cleanup of audit logs older than 7 years to maintain compliance with the retention policy.

## Overview

The `cleanup_old_audit_logs()` database function deletes audit log entries older than 7 years from the `admin_audit_log` table. This maintenance task should run automatically on a weekly schedule.

## Prerequisites

- Admin user privileges (the function checks `is_admin()`)
- Supabase project with the audit log schema deployed
- Migration `20251205_audit_log_retention_policy.sql` applied

## Scheduling Options

Choose **ONE** of the following options based on your deployment environment:

---

## Option 1: Vercel Cron (Recommended for Vercel Deployments)

**Best for:** Projects deployed on Vercel

### Setup Steps:

1. **Add the cron configuration to `vercel.json`:**

```json
{
  "crons": [
    {
      "path": "/api/cron/cleanup-audit-logs",
      "schedule": "0 2 * * 0"
    }
  ]
}
```

2. **Add environment variables in Vercel Dashboard:**
   - `CRON_SECRET` - A random secret string (e.g., generate with `openssl rand -base64 32`)
   - `SUPABASE_SERVICE_ROLE_KEY` - Your Supabase service role key
   - `NEXT_PUBLIC_SUPABASE_URL` - Your Supabase project URL

3. **Deploy to Vercel:**
   ```bash
   vercel --prod
   ```

4. **Test the endpoint manually:**
   ```bash
   curl -X POST https://your-domain.vercel.app/api/cron/cleanup-audit-logs \
     -H "Authorization: Bearer YOUR_CRON_SECRET"
   ```

### Monitoring:

- View cron job logs in Vercel Dashboard → Logs
- Check for `cleanupAuditLogsCron` entries in your application logs
- Set up alerts for failed runs (status code 500)

---

## Option 2: GitHub Actions (Recommended for GitHub-Hosted Projects)

**Best for:** Projects hosted on GitHub, works with any deployment platform

### Setup Steps:

1. **The workflow file already exists at:**
   `.github/workflows/cleanup-audit-logs.yml`

2. **Add GitHub Secrets:**
   - Go to repository Settings → Secrets and variables → Actions
   - Add secrets:
     - `SUPABASE_URL` - Your Supabase project URL
     - `SUPABASE_SERVICE_ROLE_KEY` - Your Supabase service role key

3. **Enable workflow:**
   - The workflow runs automatically every Sunday at 2 AM UTC
   - Or manually trigger: Actions → Cleanup Audit Logs → Run workflow

4. **Test the script locally:**
   ```bash
   export SUPABASE_URL="your-url"
   export SUPABASE_SERVICE_ROLE_KEY="your-key"
   node scripts/cleanup-audit-logs.js
   ```

### Monitoring:

- View workflow runs: Actions → Cleanup Audit Logs
- Automatic GitHub issue created on failure
- Check workflow status badge (optional)

---

## Option 3: Supabase pg_cron (Recommended for Supabase Pro+)

**Best for:** Supabase Pro/Enterprise plans with pg_cron enabled

### Setup Steps:

1. **Check if pg_cron is available:**
   ```sql
   SELECT extname FROM pg_extension WHERE extname = 'pg_cron';
   ```

2. **If not available, contact Supabase support or enable via Dashboard:**
   - Supabase Dashboard → Database → Extensions
   - Search for "pg_cron" and enable it

3. **Apply the migration:**
   ```bash
   supabase db push --include-all
   ```

   Or manually run in SQL Editor:
   ```sql
   -- Enable extension
   CREATE EXTENSION IF NOT EXISTS pg_cron;

   -- Schedule weekly cleanup
   SELECT cron.schedule(
     'cleanup-audit-logs',
     '0 2 * * 0',
     $$SELECT public.cleanup_old_audit_logs();$$
   );
   ```

4. **Verify the job is scheduled:**
   ```sql
   SELECT * FROM cron.job WHERE jobname = 'cleanup-audit-logs';
   ```

### Monitoring:

```sql
-- View recent job runs
SELECT *
FROM cron.job_run_details
WHERE jobname = 'cleanup-audit-logs'
ORDER BY start_time DESC
LIMIT 10;

-- Check for failures
SELECT *
FROM cron.job_run_details
WHERE jobname = 'cleanup-audit-logs'
  AND status = 'failed'
ORDER BY start_time DESC;
```

---

## Testing

### Manual Execution (Any Option)

You can manually trigger the cleanup function to test:

```sql
-- Connect to Supabase SQL Editor as an admin user
SELECT public.cleanup_old_audit_logs();
```

Expected output:
```
 cleanup_old_audit_logs
------------------------
                      0
(1 row)
```

(Returns the number of records deleted)

### Dry Run (Count Records)

To see how many records would be deleted without actually deleting:

```sql
SELECT COUNT(*)
FROM admin_audit_log
WHERE created_at < (NOW() - INTERVAL '7 years');
```

---

## Cron Schedule Reference

The schedule `0 2 * * 0` means:
- `0` - Minute 0 (on the hour)
- `2` - Hour 2 (2 AM UTC)
- `*` - Any day of the month
- `*` - Any month
- `0` - Day of week 0 (Sunday)

**Result:** Runs every Sunday at 2:00 AM UTC

To modify the schedule:
- Daily: `0 2 * * *` (every day at 2 AM)
- Monthly: `0 2 1 * *` (first day of each month at 2 AM)
- Every 6 hours: `0 */6 * * *`

---

## Security Considerations

1. **CRON_SECRET** (Vercel): Store securely, never commit to git
2. **Service Role Key**: Has elevated privileges, protect carefully
3. **Function Security**: The `cleanup_old_audit_logs()` function verifies admin status
4. **Rate Limiting**: Consider adding rate limiting to the Vercel endpoint

---

## Troubleshooting

### "Only admins can execute cleanup_old_audit_logs()"

**Cause:** The service role key or authentication isn't being recognized as an admin.

**Solution:**
- Verify `SUPABASE_SERVICE_ROLE_KEY` is correct
- Check that the service role bypasses RLS policies
- Ensure the `is_admin()` function is working correctly

### Vercel Cron: "Unauthorized"

**Cause:** CRON_SECRET mismatch or missing.

**Solution:**
- Verify `CRON_SECRET` environment variable is set in Vercel
- Check Authorization header format: `Bearer YOUR_SECRET`
- Redeploy after adding environment variables

### GitHub Actions: Script fails

**Cause:** Missing or incorrect secrets.

**Solution:**
- Verify secrets are set in GitHub repository settings
- Check secret names match exactly (case-sensitive)
- Test script locally with environment variables

### pg_cron: Job not running

**Cause:** Extension not enabled or job not scheduled.

**Solution:**
```sql
-- Check if extension is enabled
SELECT extname FROM pg_extension WHERE extname = 'pg_cron';

-- Check if job exists
SELECT * FROM cron.job WHERE jobname = 'cleanup-audit-logs';

-- Reschedule if needed
SELECT cron.unschedule('cleanup-audit-logs');
SELECT cron.schedule('cleanup-audit-logs', '0 2 * * 0', $$SELECT public.cleanup_old_audit_logs();$$);
```

---

## Monitoring and Alerts

### Recommended Monitoring

1. **Set up alerts for cleanup failures:**
   - Vercel: Monitor HTTP 500 responses
   - GitHub: Automatic issue creation on failure
   - pg_cron: Query `cron.job_run_details` for failed runs

2. **Track deletion counts:**
   - Log the number of records deleted each run
   - Alert if count is unexpectedly high (potential issue)
   - Alert if count is 0 for extended periods (verify jobs are running)

3. **Compliance verification:**
   - Periodically verify oldest record is < 7 years:
   ```sql
   SELECT MIN(created_at) as oldest_audit_log
   FROM admin_audit_log;
   ```

---

## Recommendation

For most projects, **GitHub Actions** (Option 2) is recommended because:
- ✅ Works with any deployment platform
- ✅ Free on GitHub
- ✅ Easy to test and debug
- ✅ Automatic failure notifications
- ✅ No dependency on Vercel or Supabase features

Choose **Vercel Cron** if you're already on Vercel and want tighter integration.

Choose **pg_cron** if you have Supabase Pro/Enterprise and want database-level scheduling.

---

## Support

For issues or questions:
- Check Supabase logs for RPC errors
- Review application logs for cron execution
- Consult database migration files for schema details
