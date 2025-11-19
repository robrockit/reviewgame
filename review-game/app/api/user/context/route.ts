/**
 * @fileoverview API route for getting the effective user context.
 *
 * Returns the user context including whether impersonation is active
 * and which user ID should be used for queries. This endpoint can be
 * called by client components that need to determine the effective user.
 *
 * @module app/api/user/context/route
 */

import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { getRequestContext } from '@/lib/admin/impersonation';
import { logger } from '@/lib/logger';

/**
 * Response type for the context endpoint
 */
export interface UserContextResponse {
  effectiveUserId: string;
  adminUserId: string;
  isImpersonating: boolean;
  impersonatedUserId?: string;
  sessionId?: string;
}

/**
 * GET /api/user/context
 *
 * Returns the effective user context for the current request.
 * Checks for impersonation headers set by middleware and returns
 * the appropriate user ID to use for data queries.
 *
 * This endpoint is used by client components to determine which
 * user's data they should display.
 *
 * @returns {Promise<NextResponse>} JSON response with user context
 */
export async function GET() {
  try {
    // Get authenticated user
    const supabase = await createServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized: Authentication required' },
        { status: 401 }
      );
    }

    // Get request context (checks for impersonation headers)
    const context = await getRequestContext(user.id);

    // Return context information
    const response: UserContextResponse = {
      effectiveUserId: context.effectiveUserId,
      adminUserId: context.adminUserId,
      isImpersonating: context.isImpersonating,
      impersonatedUserId: context.impersonatedUserId,
      sessionId: context.sessionId,
    };

    return NextResponse.json(response);
  } catch (error) {
    logger.error('Error in GET /api/user/context', error instanceof Error ? error : new Error(String(error)), {
      operation: 'getUserContext',
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
