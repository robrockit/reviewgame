/**
 * @fileoverview Admin API route for starting user impersonation sessions.
 *
 * Allows admins to impersonate users for troubleshooting purposes.
 * Impersonation requires a reason, cannot target admins, and has rate limiting.
 * Sessions auto-expire after 15 minutes.
 *
 * @module app/api/admin/users/[userId]/impersonate/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminUser, createAdminServerClient } from '@/lib/admin/auth';
import { headers } from 'next/headers';
import { logger } from '@/lib/logger';

/**
 * Start impersonation request body type
 */
export type StartImpersonationRequest = {
  reason: string;
};

/**
 * Validation constants
 */
const VALIDATION = {
  REASON_MIN_LENGTH: 10,
  REASON_MAX_LENGTH: 500,
  // Patterns to detect and reject potentially dangerous content
  FORBIDDEN_PATTERNS: [
    /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, // Control characters (except \t, \n, \r)
    /<script[^>]*>.*?<\/script>/gi, // Script tags
    /javascript:/gi, // JavaScript protocol
    /on\w+\s*=/gi, // Event handlers like onclick=, onload=, etc.
  ],
} as const;

/**
 * POST /api/admin/users/[userId]/impersonate
 *
 * Starts an impersonation session for the specified user.
 * Creates session in impersonation_sessions table and logs to audit trail.
 * Requires admin authentication, valid reason, and passes rate limiting.
 *
 * @param {NextRequest} req - The incoming request
 * @param {Object} context - Route context with params
 * @returns {Promise<NextResponse>} JSON response with session details
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

    // Get userId from params
    const { userId } = await context.params;

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(userId)) {
      return NextResponse.json(
        { error: 'Invalid user ID format' },
        { status: 400 }
      );
    }

    // Parse request body
    const body: StartImpersonationRequest = await req.json();

    // Validate reason is provided
    if (!body.reason) {
      return NextResponse.json(
        { error: 'Reason for impersonation is required' },
        { status: 400 }
      );
    }

    // Sanitize and validate reason
    const reason = body.reason.trim();

    // Validate length
    if (reason.length < VALIDATION.REASON_MIN_LENGTH) {
      return NextResponse.json(
        { error: `Reason must be at least ${VALIDATION.REASON_MIN_LENGTH} characters` },
        { status: 400 }
      );
    }

    if (reason.length > VALIDATION.REASON_MAX_LENGTH) {
      return NextResponse.json(
        { error: `Reason must be ${VALIDATION.REASON_MAX_LENGTH} characters or less` },
        { status: 400 }
      );
    }

    // Check for forbidden patterns (XSS prevention)
    for (const pattern of VALIDATION.FORBIDDEN_PATTERNS) {
      if (pattern.test(reason)) {
        logger.warn('Rejected impersonation reason with forbidden pattern', {
          operation: 'startImpersonation',
          adminId: adminUser.id,
          pattern: pattern.source,
        });

        return NextResponse.json(
          { error: 'Reason contains invalid characters or patterns. Please remove any HTML tags, scripts, or control characters.' },
          { status: 400 }
        );
      }
    }

    // Get Supabase client
    const supabase = await createAdminServerClient();

    // Get request metadata
    const headersList = await headers();
    const forwardedFor = headersList.get('x-forwarded-for')?.split(',')[0]?.trim();
    const ipAddress = (forwardedFor && forwardedFor.length > 0)
                      ? forwardedFor
                      : headersList.get('x-real-ip') || 'unknown';
    const userAgent = headersList.get('user-agent') || 'unknown';

    // Start impersonation session using database function
    // This ensures validation, rate limiting, audit logging, and session creation
    // All validation is handled by the RPC function:
    // - Cannot impersonate admins
    // - Cannot impersonate suspended users
    // - Cannot impersonate self
    // - Rate limit: 5 per hour
    // - Auto-ends any existing active session
    // @ts-expect-error - Function added in migration 20251118_impersonation_functions.sql
    // Types will be available after running: npx supabase gen types typescript
    const { data, error: rpcError } = await supabase.rpc('start_impersonation_session', {
      p_target_user_id: userId,
      p_reason: reason,
      p_ip_address: ipAddress,
      p_user_agent: userAgent,
    }) as { data: unknown; error: unknown };

    if (rpcError) {
      // Extract error message
      const errorMessage = typeof rpcError === 'object' && rpcError !== null && 'message' in rpcError
        ? String(rpcError.message)
        : 'Unknown error';

      // Handle specific error cases with user-friendly messages
      if (errorMessage.includes('Admin privileges required')) {
        return NextResponse.json(
          { error: 'Admin access required' },
          { status: 403 }
        );
      }

      if (errorMessage.includes('Cannot impersonate other admin users')) {
        return NextResponse.json(
          { error: 'Cannot impersonate admin users' },
          { status: 403 }
        );
      }

      if (errorMessage.includes('Cannot impersonate suspended users')) {
        return NextResponse.json(
          { error: 'Cannot impersonate suspended users' },
          { status: 403 }
        );
      }

      if (errorMessage.includes('Cannot impersonate yourself')) {
        return NextResponse.json(
          { error: 'Cannot impersonate yourself' },
          { status: 400 }
        );
      }

      if (errorMessage.includes('Rate limit exceeded')) {
        return NextResponse.json(
          { error: 'Rate limit exceeded: Maximum 5 impersonations per hour' },
          { status: 429 }
        );
      }

      if (errorMessage.includes('Target user not found')) {
        return NextResponse.json(
          { error: 'User not found' },
          { status: 404 }
        );
      }

      // Log full error details for debugging
      logger.error('Error starting impersonation session', new Error(errorMessage), {
        operation: 'startImpersonation',
        userId,
        adminId: adminUser.id,
        errorDetails: errorMessage,
      });

      // Return generic error message to prevent information disclosure
      return NextResponse.json(
        { error: 'Failed to start impersonation session. Please try again or contact support.' },
        { status: 500 }
      );
    }

    // Success - impersonation session created
    // Type assertion: data is JSONB object from database function
    const result = data as {
      session_id: string;
      admin_user_id: string;
      target_user_id: string;
      target_user_email: string;
      target_user_name: string;
      started_at: string;
      expires_at: string;
      reason: string;
      audit_id: string;
    };

    logger.info('Impersonation session started successfully', {
      operation: 'startImpersonation',
      sessionId: result.session_id,
      targetUserId: result.target_user_id,
      targetUserEmail: result.target_user_email,
      adminId: adminUser.id,
      adminEmail: adminUser.email,
      expiresAt: result.expires_at,
    });

    // Return success response
    return NextResponse.json({
      message: 'Impersonation session started successfully',
      data: {
        sessionId: result.session_id,
        targetUserId: result.target_user_id,
        targetUserEmail: result.target_user_email,
        targetUserName: result.target_user_name,
        startedAt: result.started_at,
        expiresAt: result.expires_at,
        reason: result.reason,
        startedBy: adminUser.email,
      },
    });
  } catch (error) {
    logger.error('Error in POST /api/admin/users/[userId]/impersonate', error instanceof Error ? error : new Error(String(error)), {
      operation: 'startImpersonation',
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
