/**
 * @fileoverview Admin API route for activating suspended user accounts.
 *
 * Allows admins to reactivate suspended user accounts.
 * Clears the suspension reason and sets is_active to true.
 *
 * @module app/api/admin/users/[userId]/activate/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminUser, createAdminServerClient, logAdminAction } from '@/lib/admin/auth';
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

    // Activate the user
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        is_active: true,
        suspension_reason: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId);

    if (updateError) {
      logger.error('Error activating user', new Error(updateError.message), {
        operation: 'activateUser',
        errorCode: updateError.code,
        userId,
      });

      return NextResponse.json(
        { error: 'Failed to activate user' },
        { status: 500 }
      );
    }

    // Log admin action
    try {
      const headersList = await headers();
      const ipAddress = headersList.get('x-forwarded-for') ||
                        headersList.get('x-real-ip') ||
                        'unknown';
      const userAgent = headersList.get('user-agent') || 'unknown';

      await logAdminAction({
        actionType: 'activate_user',
        targetType: 'profile',
        targetId: userId,
        notes: notes || `Reactivated user ${currentUser.email}`,
        changes: {
          is_active: { from: false, to: true },
          suspension_reason: { from: currentUser.suspension_reason, to: null },
        },
        ipAddress,
        userAgent,
      });
    } catch (auditError) {
      // CRITICAL: Log audit failure with full details for compliance
      logger.error('CRITICAL: Failed to log user activation action', auditError instanceof Error ? auditError : new Error(String(auditError)), {
        operation: 'auditActivateUser',
        userId,
        adminId: adminUser.id,
        notes,
        attemptedAction: 'activate_user',
      });
    }

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
