/**
 * @fileoverview Vercel Cron endpoint for audit log cleanup
 *
 * This endpoint is called by Vercel Cron to cleanup audit logs older than 7 years.
 * Configure in vercel.json with:
 * {
 *   "crons": [{
 *     "path": "/api/cron/cleanup-audit-logs",
 *     "schedule": "0 2 * * 0"
 *   }]
 * }
 *
 * Security: Protected by CRON_SECRET environment variable
 *
 * @module app/api/cron/cleanup-audit-logs
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { timingSafeEqual } from 'crypto';
import { logger } from '@/lib/logger';

/**
 * POST /api/cron/cleanup-audit-logs
 *
 * Called by Vercel Cron to cleanup old audit logs
 */
export async function POST(req: NextRequest) {
  try {
    // Verify this request is from Vercel Cron
    // In production, Vercel Cron sends the CRON_SECRET in the Authorization header
    const authHeader = req.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    // Require CRON_SECRET to be configured in production
    if (!cronSecret) {
      logger.error('CRON_SECRET not configured', new Error('Missing CRON_SECRET'), {
        operation: 'cleanupAuditLogsCron',
      });

      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }

    const expectedAuth = `Bearer ${cronSecret}`;

    // Use timing-safe comparison to prevent timing attacks
    // timingSafeEqual requires buffers of equal length, so we check that first
    const isValid = authHeader &&
      authHeader.length === expectedAuth.length &&
      timingSafeEqual(
        Buffer.from(authHeader),
        Buffer.from(expectedAuth)
      );

    if (!isValid) {
      logger.error('Unauthorized cron request', new Error('Invalid CRON_SECRET'), {
        operation: 'cleanupAuditLogsCron',
        hasAuthHeader: !!authHeader,
      });

      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Validate Supabase credentials
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      logger.error('Missing Supabase credentials', new Error('Missing environment variables'), {
        operation: 'cleanupAuditLogsCron',
        hasUrl: !!supabaseUrl,
        hasKey: !!supabaseServiceKey,
      });

      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }

    // Create Supabase client with service role key
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    logger.info('Starting audit log cleanup via cron', {
      operation: 'cleanupAuditLogsCron',
      timestamp: new Date().toISOString(),
    });

    // Call the cleanup function
    const { data, error } = await supabase.rpc('cleanup_old_audit_logs');

    if (error) {
      logger.error('Failed to cleanup audit logs', error instanceof Error ? error : new Error(String(error)), {
        operation: 'cleanupAuditLogsCron',
        errorCode: error.code,
        errorMessage: error.message,
      });

      return NextResponse.json(
        { error: 'Cleanup failed', details: error.message },
        { status: 500 }
      );
    }

    const deletedCount = data || 0;

    logger.info('Audit log cleanup completed successfully', {
      operation: 'cleanupAuditLogsCron',
      deletedCount,
      timestamp: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      deletedCount,
      message: deletedCount === 0
        ? 'No records older than 7 years found'
        : `Deleted ${deletedCount} audit log entries older than 7 years`,
    });
  } catch (error) {
    logger.error('Error in cleanup audit logs cron', error instanceof Error ? error : new Error(String(error)), {
      operation: 'cleanupAuditLogsCron',
    });

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/cron/cleanup-audit-logs
 *
 * Manual trigger for testing (protected by CRON_SECRET)
 */
export async function GET(req: NextRequest) {
  // For manual testing, allow GET requests with the same authentication
  return POST(req);
}
