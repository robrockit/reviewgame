/**
 * @fileoverview Admin API route for revealing full user email.
 *
 * Allows admins to view the full, unmasked email address of a user.
 * All email reveals are logged to the audit trail for compliance.
 *
 * @module app/api/admin/users/[userId]/reveal-email/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminUser, createAdminServerClient, logAdminAction } from '@/lib/admin/auth';
import { headers } from 'next/headers';
import * as Sentry from '@sentry/nextjs';
import { logger } from '@/lib/logger';

/**
 * POST /api/admin/users/[userId]/reveal-email
 *
 * Reveals the full email address for a specific user.
 * Logs this action to the audit trail.
 *
 * @param {NextRequest} req - The incoming request
 * @param {Object} context - Route context with params
 * @param {Object} context.params - Route parameters
 * @param {string} context.params.userId - The user ID to reveal email for
 * @returns {Promise<NextResponse>} JSON response with full email
 */
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ userId: string }> }
) {
  try {
    // Verify admin authentication
    const adminUser = await verifyAdminUser();
    if (!adminUser) {
      return NextResponse.json(
        { error: 'Unauthorized: Admin access required' },
        { status: 401 }
      );
    }

    // Get userId from route params
    const params = await context.params;
    const { userId } = params;

    // Validate userId
    if (!userId || typeof userId !== 'string') {
      return NextResponse.json(
        { error: 'Invalid user ID' },
        { status: 400 }
      );
    }

    // Get Supabase client
    const supabase = await createAdminServerClient();

    // Fetch user email
    const { data: user, error: userError } = await supabase
      .from('profiles')
      .select('id, email, full_name')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      logger.error('Error fetching user for email reveal', new Error(userError?.message || 'User not found'), {
        operation: 'fetchUserForEmailReveal',
        errorCode: userError?.code,
        userId,
      });
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Log admin action - CRITICAL for compliance
    // We must not reveal email if audit logging fails
    try {
      const headersList = await headers();
      const ipAddress = headersList.get('x-forwarded-for') ||
                        headersList.get('x-real-ip') ||
                        'unknown';
      const userAgent = headersList.get('user-agent') || 'unknown';

      await logAdminAction({
        actionType: 'reveal_email',
        targetType: 'user',
        targetId: userId,
        notes: `Revealed full email for user: ${user.full_name || user.email}`,
        ipAddress,
        userAgent,
      });
    } catch (auditError) {
      // CRITICAL: Audit logging failure is a compliance violation
      // Do NOT reveal email without logging - this is required for GDPR/CCPA/SOC2
      logger.error('CRITICAL: Failed to log email reveal action', auditError instanceof Error ? auditError : new Error(String(auditError)), {
        operation: 'auditEmailReveal',
        userId,
        adminUserId: adminUser.id,
        targetEmail: user.email,
        critical: true,
      });

      // Alert monitoring system
      Sentry.captureException(auditError, {
        level: 'error',
        tags: {
          critical: 'audit_failure',
          operation: 'reveal_email',
        },
        contexts: {
          custom: {
            userId,
            adminUserId: adminUser.id,
            targetEmail: user.email,
          },
        },
      });

      // Return error - do NOT reveal email without audit trail
      return NextResponse.json(
        {
          error: 'Unable to complete request due to system error. Please try again or contact support if the issue persists.'
        },
        { status: 500 }
      );
    }

    // Return full email only after successful audit logging
    return NextResponse.json({
      userId: user.id,
      email: user.email,
      full_name: user.full_name,
    });
  } catch (error) {
    logger.error('Error in POST /api/admin/users/[userId]/reveal-email', error instanceof Error ? error : new Error(String(error)), {
      operation: 'revealEmail',
    });

    if (error instanceof Error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}
