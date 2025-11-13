/**
 * @fileoverview Admin API route for fetching user's activity history.
 *
 * Provides login history and recent admin actions for a specific user.
 *
 * @module app/api/admin/users/[userId]/activity/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminUser, createAdminServerClient, logAdminAction } from '@/lib/admin/auth';
import { headers } from 'next/headers';
import { logger } from '@/lib/logger';

/**
 * Login history entry
 */
export type AdminUserLoginHistory = {
  id: string;
  login_at: string | null;
  login_method: string | null;
  ip_address: string | null;
  user_agent: string | null;
  impersonated_by: string | null;
  impersonator_email?: string | null;
};

/**
 * Admin action entry
 */
export type AdminUserAdminAction = {
  id: string;
  admin_user_id: string;
  admin_email?: string | null;
  action_type: string;
  target_type: string;
  target_id: string;
  changes: Record<string, unknown> | null;
  reason: string | null;
  notes: string | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string | null;
};

/**
 * Combined activity response
 */
export type AdminUserActivity = {
  loginHistory: AdminUserLoginHistory[];
  adminActions: AdminUserAdminAction[];
  loginPagination: {
    page: number;
    limit: number;
    totalCount: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
  actionsPagination: {
    page: number;
    limit: number;
    totalCount: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
};

/**
 * GET /api/admin/users/[userId]/activity
 *
 * Fetches activity history for a specific user including login history
 * and admin actions performed on their account.
 * Requires admin authentication.
 *
 * Query Parameters:
 * - loginPage: number (default: 1)
 * - loginLimit: number (default: 10, max: 50)
 * - actionsPage: number (default: 1)
 * - actionsLimit: number (default: 10, max: 50)
 *
 * @param {NextRequest} req - The incoming request
 * @param {Object} context - Route context with params
 * @returns {Promise<NextResponse>} JSON response with user activity
 */
export async function GET(
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

    // Parse query parameters
    const { searchParams } = req.nextUrl;
    const loginPage = Math.max(1, parseInt(searchParams.get('loginPage') || '1', 10));
    const rawLoginLimit = parseInt(searchParams.get('loginLimit') || '10', 10);
    const loginLimit = Math.min(50, Math.max(1, rawLoginLimit));

    const actionsPage = Math.max(1, parseInt(searchParams.get('actionsPage') || '1', 10));
    const rawActionsLimit = parseInt(searchParams.get('actionsLimit') || '10', 10);
    const actionsLimit = Math.min(50, Math.max(1, rawActionsLimit));

    // Calculate offsets for pagination
    const loginOffset = (loginPage - 1) * loginLimit;
    const actionsOffset = (actionsPage - 1) * actionsLimit;

    // Get Supabase client
    const supabase = await createAdminServerClient();

    // Check if user exists
    const { data: userExists, error: userCheckError } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', userId)
      .single();

    if (userCheckError || !userExists) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Fetch login history with count
    const { data: loginHistory, count: loginCount, error: loginError } = await supabase
      .from('login_history')
      .select('*', { count: 'exact' })
      .eq('user_id', userId)
      .order('login_at', { ascending: false })
      .range(loginOffset, loginOffset + loginLimit - 1);

    if (loginError) {
      logger.error('Error fetching login history', new Error(loginError.message), {
        operation: 'fetchLoginHistory',
        errorCode: loginError.code,
        userId,
      });
      return NextResponse.json(
        { error: 'Failed to fetch login history' },
        { status: 500 }
      );
    }

    // Enrich login history with impersonator details
    // Fetch all impersonator emails in a single query to prevent N+1 problem
    const impersonatorIds = (loginHistory || [])
      .map(login => login.impersonated_by)
      .filter((id): id is string => id !== null);

    const impersonatorEmails = new Map<string, string>();

    if (impersonatorIds.length > 0) {
      const { data: impersonators } = await supabase
        .from('profiles')
        .select('id, email')
        .in('id', impersonatorIds);

      if (impersonators) {
        impersonators.forEach(imp => {
          impersonatorEmails.set(imp.id, imp.email);
        });
      }
    }

    const enrichedLoginHistory = (loginHistory || []).map((login) => ({
      ...login,
      impersonator_email: login.impersonated_by
        ? impersonatorEmails.get(login.impersonated_by) || null
        : null,
    }));

    // Fetch admin actions targeting this user
    const { data: adminActions, count: actionsCount, error: actionsError } = await supabase
      .from('admin_audit_log')
      .select('*', { count: 'exact' })
      .eq('target_type', 'profile')
      .eq('target_id', userId)
      .order('created_at', { ascending: false })
      .range(actionsOffset, actionsOffset + actionsLimit - 1);

    if (actionsError) {
      logger.error('Error fetching admin actions', new Error(actionsError.message), {
        operation: 'fetchAdminActions',
        errorCode: actionsError.code,
        userId,
      });
      return NextResponse.json(
        { error: 'Failed to fetch admin actions' },
        { status: 500 }
      );
    }

    // Enrich admin actions with admin user details
    // Fetch all admin emails in a single query to prevent N+1 problem
    const adminUserIds = (adminActions || [])
      .map(action => action.admin_user_id)
      .filter((id): id is string => id !== null);

    const adminEmails = new Map<string, string>();

    if (adminUserIds.length > 0) {
      const { data: admins } = await supabase
        .from('profiles')
        .select('id, email')
        .in('id', adminUserIds);

      if (admins) {
        admins.forEach(admin => {
          adminEmails.set(admin.id, admin.email);
        });
      }
    }

    const enrichedAdminActions = (adminActions || []).map((action) => ({
      ...action,
      admin_email: action.admin_user_id
        ? adminEmails.get(action.admin_user_id) || null
        : null,
      changes: action.changes as Record<string, unknown> | null,
    }));

    // Calculate pagination metadata
    const loginTotalPages = Math.ceil((loginCount || 0) / loginLimit);
    const actionsTotalPages = Math.ceil((actionsCount || 0) / actionsLimit);

    // Log admin action (lightweight - no need to block on failure)
    try {
      const headersList = await headers();
      const ipAddress = headersList.get('x-forwarded-for') ||
                        headersList.get('x-real-ip') ||
                        'unknown';
      const userAgent = headersList.get('user-agent') || 'unknown';

      await logAdminAction({
        actionType: 'view_user_activity',
        targetType: 'profile',
        targetId: userId,
        notes: `Viewed activity history for user ${userId}`,
        ipAddress,
        userAgent,
      });
    } catch (auditError) {
      logger.error('Failed to log admin action', auditError instanceof Error ? auditError : new Error(String(auditError)), {
        operation: 'auditViewUserActivity',
        userId,
      });
    }

    // Return response
    const response: AdminUserActivity = {
      loginHistory: enrichedLoginHistory,
      adminActions: enrichedAdminActions,
      loginPagination: {
        page: loginPage,
        limit: loginLimit,
        totalCount: loginCount || 0,
        totalPages: loginTotalPages,
        hasNextPage: loginPage < loginTotalPages,
        hasPreviousPage: loginPage > 1,
      },
      actionsPagination: {
        page: actionsPage,
        limit: actionsLimit,
        totalCount: actionsCount || 0,
        totalPages: actionsTotalPages,
        hasNextPage: actionsPage < actionsTotalPages,
        hasPreviousPage: actionsPage > 1,
      },
    };

    return NextResponse.json({ data: response });
  } catch (error) {
    logger.error('Error in GET /api/admin/users/[userId]/activity', error instanceof Error ? error : new Error(String(error)), {
      operation: 'getUserActivity',
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
