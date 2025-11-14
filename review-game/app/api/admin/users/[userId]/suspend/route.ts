/**
 * @fileoverview Admin API route for suspending user accounts.
 *
 * Allows admins to suspend user accounts with a mandatory reason.
 * Suspended users cannot login until reactivated.
 *
 * @module app/api/admin/users/[userId]/suspend/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminUser, createAdminServerClient } from '@/lib/admin/auth';
import { headers } from 'next/headers';
import { logger } from '@/lib/logger';

/**
 * Suspension reason types
 */
export type SuspensionReason = 'policy_violation' | 'payment_fraud' | 'abuse' | 'other';

/**
 * Suspend user request body type
 */
export type SuspendUserRequest = {
  reason: SuspensionReason;
  notes?: string;
};

/**
 * Validation constants
 */
const VALIDATION = {
  NOTES_MAX_LENGTH: 5000,
  VALID_REASONS: ['policy_violation', 'payment_fraud', 'abuse', 'other'] as const,
  // Patterns to detect and reject potentially dangerous content
  FORBIDDEN_PATTERNS: [
    /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, // Control characters (except \t, \n, \r)
    /<script[^>]*>.*?<\/script>/gi, // Script tags
    /javascript:/gi, // JavaScript protocol
    /on\w+\s*=/gi, // Event handlers like onclick=, onload=, etc.
  ],
} as const;

/**
 * POST /api/admin/users/[userId]/suspend
 *
 * Suspends a user account. Sets is_active to false and records the suspension reason.
 * Requires admin authentication and logs the action.
 *
 * @param {NextRequest} req - The incoming request
 * @param {Object} context - Route context with params
 * @returns {Promise<NextResponse>} JSON response with success message
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
    const body: SuspendUserRequest = await req.json();

    // Validate reason is provided
    if (!body.reason) {
      return NextResponse.json(
        { error: 'Suspension reason is required' },
        { status: 400 }
      );
    }

    // Validate reason is one of the allowed values
    if (!VALIDATION.VALID_REASONS.includes(body.reason)) {
      return NextResponse.json(
        { error: 'Invalid suspension reason' },
        { status: 400 }
      );
    }

    // Sanitize and validate notes
    let notes = body.notes || '';
    if (notes) {
      notes = notes.trim();

      // Validate length
      if (notes.length > VALIDATION.NOTES_MAX_LENGTH) {
        return NextResponse.json(
          { error: `Notes must be ${VALIDATION.NOTES_MAX_LENGTH} characters or less` },
          { status: 400 }
        );
      }

      // Check for forbidden patterns (XSS prevention)
      for (const pattern of VALIDATION.FORBIDDEN_PATTERNS) {
        if (pattern.test(notes)) {
          logger.warn('Rejected notes with forbidden pattern', {
            operation: 'suspendUser',
            adminId: adminUser.id,
            pattern: pattern.source,
          });

          return NextResponse.json(
            { error: 'Notes contain invalid characters or patterns. Please remove any HTML tags, scripts, or control characters.' },
            { status: 400 }
          );
        }
      }
    }

    // Get Supabase client
    const supabase = await createAdminServerClient();

    // Check if user exists and get current status
    const { data: currentUser, error: fetchError } = await supabase
      .from('profiles')
      .select('id, email, full_name, is_active, suspension_reason')
      .eq('id', userId)
      .single();

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'User not found' },
          { status: 404 }
        );
      }

      logger.error('Error fetching user for suspension', new Error(fetchError.message), {
        operation: 'fetchUserForSuspension',
        errorCode: fetchError.code,
        userId,
      });

      return NextResponse.json(
        { error: 'Failed to fetch user' },
        { status: 500 }
      );
    }

    // Check if user is already suspended
    if (!currentUser.is_active) {
      return NextResponse.json(
        { error: 'User is already suspended' },
        { status: 400 }
      );
    }

    // Prevent admins from suspending themselves
    if (userId === adminUser.id) {
      return NextResponse.json(
        { error: 'You cannot suspend your own account' },
        { status: 400 }
      );
    }

    // Format suspension reason for database
    const formattedReason = `${body.reason}${notes ? `: ${notes}` : ''}`;

    // Prepare changes object for audit log
    const changes = {
      is_active: { from: true, to: false },
      suspension_reason: { from: currentUser.suspension_reason, to: formattedReason },
    };

    // Get request metadata
    const headersList = await headers();
    const forwardedFor = headersList.get('x-forwarded-for')?.split(',')[0]?.trim();
    const ipAddress = (forwardedFor && forwardedFor.length > 0)
                      ? forwardedFor
                      : headersList.get('x-real-ip') || 'unknown';
    const userAgent = headersList.get('user-agent') || 'unknown';

    // Atomically suspend user and create audit log using database function
    // This ensures both operations succeed or both fail (transaction safety)
    // Also includes admin re-verification to prevent TOCTOU race conditions
    // @ts-expect-error - Function added in migration 20251113_suspension_security_enhancements.sql
    // Types will be available after running: npx supabase gen types typescript
    const { data, error: rpcError } = await supabase.rpc('suspend_user_with_audit', {
      p_user_id: userId,
      p_formatted_reason: formattedReason,
      p_admin_id: adminUser.id,
      p_action_type: 'suspend_user',
      p_reason: body.reason,
      p_notes: notes || null,
      p_ip_address: ipAddress,
      p_user_agent: userAgent,
      p_changes: changes,
    }) as { data: unknown; error: unknown };

    if (rpcError) {
      // Check if error is due to admin privileges being revoked (TOCTOU prevention)
      const errorMessage = typeof rpcError === 'object' && rpcError !== null && 'message' in rpcError
        ? String(rpcError.message)
        : 'Unknown error';

      if (errorMessage.includes('Admin privileges revoked')) {
        logger.warn('Admin privileges revoked during suspension operation', {
          operation: 'suspendUser',
          adminId: adminUser.id,
          userId,
        });

        return NextResponse.json(
          { error: 'Admin access revoked. Operation cancelled.' },
          { status: 403 }
        );
      }

      // Log full error details for debugging
      logger.error('Error suspending user (transaction rolled back)', new Error(errorMessage), {
        operation: 'suspendUser',
        userId,
        adminId: adminUser.id,
        errorDetails: errorMessage,
      });

      // Return generic error message to prevent information disclosure
      return NextResponse.json(
        { error: 'Failed to suspend user. Please try again or contact support.' },
        { status: 500 }
      );
    }

    // Success - both operations completed atomically
    // Type assertion: data is JSONB object from database function
    const result = data as { user: { email: string }; audit_id: string; suspended_at: string };

    logger.info('User suspended successfully', {
      operation: 'suspendUser',
      userId,
      userEmail: result.user.email,
      auditId: result.audit_id,
      suspendedAt: result.suspended_at,
      adminId: adminUser.id,
    });

    // Return success response
    return NextResponse.json({
      message: 'User suspended successfully',
      data: {
        userId,
        userEmail: currentUser.email,
        reason: body.reason,
        suspendedBy: adminUser.email,
      },
    });
  } catch (error) {
    logger.error('Error in POST /api/admin/users/[userId]/suspend', error instanceof Error ? error : new Error(String(error)), {
      operation: 'suspendUser',
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
