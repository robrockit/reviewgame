/**
 * @fileoverview Admin API route for activating suspended user accounts.
 *
 * Allows admins to reactivate suspended user accounts.
 * Clears the suspension reason and sets is_active to true.
 *
 * @module app/api/admin/users/[userId]/activate/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminUser, createAdminServerClient } from '@/lib/admin/auth';
import { headers } from 'next/headers';
import { logger } from '@/lib/logger';

/**
 * Activate user request body type (optional notes)
 */
export type ActivateUserRequest = {
  notes?: string;
};

/**
 * POST /api/admin/users/[userId]/activate
 *
 * Activates a suspended user account. Sets is_active to true and clears suspension reason.
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

    // Parse request body (notes are optional)
    let notes = '';
    try {
      const body: ActivateUserRequest = await req.json();
      notes = body.notes?.trim() || '';
    } catch {
      // Body is optional, continue without notes
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

      logger.error('Error fetching user for activation', new Error(fetchError.message), {
        operation: 'fetchUserForActivation',
        errorCode: fetchError.code,
        userId,
      });

      return NextResponse.json(
        { error: 'Failed to fetch user' },
        { status: 500 }
      );
    }

    // Check if user is already active
    if (currentUser.is_active) {
      return NextResponse.json(
        { error: 'User is already active' },
        { status: 400 }
      );
    }

    // Prepare changes object for audit log
    const changes = {
      is_active: { from: false, to: true },
      suspension_reason: { from: currentUser.suspension_reason, to: null },
    };

    // Get request metadata
    const headersList = await headers();
    const forwardedFor = headersList.get('x-forwarded-for')?.split(',')[0]?.trim();
    const ipAddress = (forwardedFor && forwardedFor.length > 0)
                      ? forwardedFor
                      : headersList.get('x-real-ip') || 'unknown';
    const userAgent = headersList.get('user-agent') || 'unknown';

    // Atomically activate user and create audit log using database function
    // This ensures both operations succeed or both fail (transaction safety)
    // Also includes admin re-verification to prevent TOCTOU race conditions
    // Types will be available after running: npx supabase gen types typescript
    const { data, error: rpcError } = await supabase.rpc('activate_user_with_audit', {
      p_user_id: userId,
      p_admin_id: adminUser.id,
      p_notes: notes || `Reactivated user ${currentUser.email}`,
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
        logger.warn('Admin privileges revoked during activation operation', {
          operation: 'activateUser',
          adminId: adminUser.id,
          userId,
        });

        return NextResponse.json(
          { error: 'Admin access revoked. Operation cancelled.' },
          { status: 403 }
        );
      }

      // Log full error details for debugging
      logger.error('Error activating user (transaction rolled back)', new Error(errorMessage), {
        operation: 'activateUser',
        userId,
        adminId: adminUser.id,
        errorDetails: errorMessage,
      });

      // Return generic error message to prevent information disclosure
      return NextResponse.json(
        { error: 'Failed to activate user. Please try again or contact support.' },
        { status: 500 }
      );
    }

    // Success - both operations completed atomically
    // Type assertion: data is JSONB object from database function
    const result = data as { user: { email: string }; audit_id: string };

    logger.info('User activated successfully', {
      operation: 'activateUser',
      userId,
      userEmail: result.user.email,
      auditId: result.audit_id,
      adminId: adminUser.id,
    });

    // Return success response
    return NextResponse.json({
      message: 'User activated successfully',
      data: {
        userId,
        userEmail: currentUser.email,
        activatedBy: adminUser.email,
      },
    });
  } catch (error) {
    logger.error('Error in POST /api/admin/users/[userId]/activate', error instanceof Error ? error : new Error(String(error)), {
      operation: 'activateUser',
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
