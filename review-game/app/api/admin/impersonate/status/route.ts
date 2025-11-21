/**
 * @fileoverview Admin API route for checking impersonation session status.
 *
 * Allows admins to check if they have an active impersonation session.
 * Used by frontend to display impersonation banner and handle context.
 *
 * @module app/api/admin/impersonate/status/route
 */

import { NextResponse } from 'next/server';
import { verifyAdminUser, createAdminServerClient } from '@/lib/admin/auth';
import { logger } from '@/lib/logger';

/**
 * GET /api/admin/impersonate/status
 *
 * Checks if the authenticated admin has an active impersonation session.
 * Returns session details if active, or indicates no active session.
 * Requires admin authentication.
 *
 * @returns {Promise<NextResponse>} JSON response with session status
 */
export async function GET() {
  try {
    // Verify admin authentication
    const adminUser = await verifyAdminUser();
    if (!adminUser) {
      return NextResponse.json(
        { error: 'Unauthorized: Admin access required' },
        { status: 401 }
      );
    }

    // Get Supabase client
    const supabase = await createAdminServerClient();

    // Get active impersonation session using database function
    // This function checks for:
    // - Session not ended (ended_at IS NULL)
    // - Session not expired (started_at within last 15 minutes)
    // @ts-expect-error - Function added in migration 20251118_impersonation_functions.sql
    // Types will be available after running: npx supabase gen types typescript
    const { data, error: rpcError } = await supabase.rpc('get_active_impersonation') as {
      data: unknown;
      error: unknown;
    };

    if (rpcError) {
      // Extract error message
      const errorMessage = typeof rpcError === 'object' && rpcError !== null && 'message' in rpcError
        ? String(rpcError.message)
        : 'Unknown error';

      // Log error details for debugging
      logger.error('Error getting impersonation status', new Error(errorMessage), {
        operation: 'getImpersonationStatus',
        adminId: adminUser.id,
        errorDetails: errorMessage,
      });

      // Return generic error message to prevent information disclosure
      return NextResponse.json(
        { error: 'Failed to check impersonation status' },
        { status: 500 }
      );
    }

    // Check if there's an active session
    if (!data) {
      // No active session
      return NextResponse.json({
        active: false,
        session: null,
      });
    }

    // Type assertion: data is JSONB object from database function
    const session = data as {
      id: string;
      admin_user_id: string;
      target_user_id: string;
      target_user_email: string;
      target_user_name: string;
      started_at: string;
      reason: string;
      expires_at: string;
    };

    // Return active session details
    return NextResponse.json({
      active: true,
      session: {
        sessionId: session.id,
        adminUserId: session.admin_user_id,
        targetUserId: session.target_user_id,
        targetUserEmail: session.target_user_email,
        targetUserName: session.target_user_name,
        startedAt: session.started_at,
        expiresAt: session.expires_at,
        reason: session.reason,
      },
    });
  } catch (error) {
    logger.error('Error in GET /api/admin/impersonate/status', error instanceof Error ? error : new Error(String(error)), {
      operation: 'getImpersonationStatus',
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
