/**
 * @fileoverview Admin API route for ending user impersonation sessions.
 *
 * Allows admins to end their active impersonation session.
 * Updates impersonation_sessions table and logs to audit trail.
 *
 * @module app/api/admin/impersonate/end/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminUser, createAdminServerClient } from '@/lib/admin/auth';
import { logger } from '@/lib/logger';

/**
 * End impersonation request body type
 */
export type EndImpersonationRequest = {
  sessionId: string;
};

/**
 * POST /api/admin/impersonate/end
 *
 * Ends the currently active impersonation session.
 * Updates the session record and creates audit log entry.
 * Requires admin authentication.
 *
 * @param {NextRequest} req - The incoming request
 * @returns {Promise<NextResponse>} JSON response with session end details
 */
export async function POST(req: NextRequest) {
  try {
    // Verify admin authentication
    const adminUser = await verifyAdminUser();
    if (!adminUser) {
      return NextResponse.json(
        { error: 'Unauthorized: Admin access required' },
        { status: 401 }
      );
    }

    // Parse request body
    const body: EndImpersonationRequest = await req.json();

    // Validate sessionId is provided
    if (!body.sessionId) {
      return NextResponse.json(
        { error: 'Session ID is required' },
        { status: 400 }
      );
    }

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(body.sessionId)) {
      return NextResponse.json(
        { error: 'Invalid session ID format' },
        { status: 400 }
      );
    }

    // Get Supabase client
    const supabase = await createAdminServerClient();

    // End impersonation session using database function
    // This ensures:
    // - Only the admin who started the session can end it
    // - Session exists and is active
    // - Audit logging
    // Types will be available after running: npx supabase gen types typescript
    const { data, error: rpcError } = await supabase.rpc('end_impersonation_session', {
      p_session_id: body.sessionId,
    }) as { data: unknown; error: unknown };

    if (rpcError) {
      // Extract error message
      const errorMessage = typeof rpcError === 'object' && rpcError !== null && 'message' in rpcError
        ? String(rpcError.message)
        : 'Unknown error';

      // Handle specific error cases with user-friendly messages
      if (errorMessage.includes('Authentication required')) {
        return NextResponse.json(
          { error: 'Authentication required' },
          { status: 401 }
        );
      }

      if (errorMessage.includes('Impersonation session not found')) {
        return NextResponse.json(
          { error: 'Session not found' },
          { status: 404 }
        );
      }

      if (errorMessage.includes('Only the admin who started the session can end it')) {
        return NextResponse.json(
          { error: 'Only the admin who started the session can end it' },
          { status: 403 }
        );
      }

      if (errorMessage.includes('Impersonation session has already ended')) {
        return NextResponse.json(
          { error: 'Session has already ended' },
          { status: 400 }
        );
      }

      // Log full error details for debugging
      logger.error('Error ending impersonation session', new Error(errorMessage), {
        operation: 'endImpersonation',
        sessionId: body.sessionId,
        adminId: adminUser.id,
        errorDetails: errorMessage,
      });

      // Return generic error message to prevent information disclosure
      return NextResponse.json(
        { error: 'Failed to end impersonation session. Please try again or contact support.' },
        { status: 500 }
      );
    }

    // Success - impersonation session ended
    // Type assertion: data is JSONB object from database function
    const result = data as {
      session_id: string;
      target_user_id: string;
      target_user_email: string;
      target_user_name: string;
      started_at: string;
      ended_at: string;
      duration_minutes: number;
      audit_id: string;
    };

    logger.info('Impersonation session ended successfully', {
      operation: 'endImpersonation',
      sessionId: result.session_id,
      targetUserId: result.target_user_id,
      targetUserEmail: result.target_user_email,
      adminId: adminUser.id,
      adminEmail: adminUser.email,
      durationMinutes: result.duration_minutes,
    });

    // Return success response
    return NextResponse.json({
      message: 'Impersonation session ended successfully',
      data: {
        sessionId: result.session_id,
        targetUserId: result.target_user_id,
        targetUserEmail: result.target_user_email,
        targetUserName: result.target_user_name,
        startedAt: result.started_at,
        endedAt: result.ended_at,
        durationMinutes: result.duration_minutes,
        endedBy: adminUser.email,
      },
    });
  } catch (error) {
    logger.error('Error in POST /api/admin/impersonate/end', error instanceof Error ? error : new Error(String(error)), {
      operation: 'endImpersonation',
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
