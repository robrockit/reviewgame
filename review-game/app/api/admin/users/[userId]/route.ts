/**
 * @fileoverview Admin API route for fetching individual user details.
 *
 * Provides comprehensive user information including profile, subscription,
 * and account status for admin customer service operations.
 *
 * @module app/api/admin/users/[userId]/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminUser, createAdminServerClient, logAdminAction } from '@/lib/admin/auth';
import { headers } from 'next/headers';
import { logger } from '@/lib/logger';

/**
 * Detailed user data returned for profile viewing
 */
export type AdminUserDetail = {
  id: string;
  email: string;
  full_name: string | null;
  role: string | null;
  is_active: boolean | null;
  created_at: string | null;
  updated_at: string | null;
  last_login_at: string | null;

  // Subscription fields
  subscription_status: string | null;
  subscription_tier: string | null;
  billing_cycle: string | null;
  current_period_end: string | null;
  trial_end_date: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;

  // Custom plan fields
  custom_plan_name: string | null;
  custom_plan_type: string | null;
  custom_plan_expires_at: string | null;
  custom_plan_notes: string | null;
  plan_override_limits: Record<string, unknown> | null;

  // Account management fields
  suspension_reason: string | null;
  email_verified_manually: boolean | null;
  admin_notes: string | null;

  // Computed fields
  games_created_count: number | null;
};

/**
 * GET /api/admin/users/[userId]
 *
 * Fetches detailed information about a specific user.
 * Requires admin authentication and logs the access.
 *
 * @param {NextRequest} req - The incoming request
 * @param {Object} context - Route context with params
 * @returns {Promise<NextResponse>} JSON response with user details
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

    // Get Supabase client
    const supabase = await createAdminServerClient();

    // Fetch user details
    const { data: user, error: userError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (userError) {
      if (userError.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'User not found' },
          { status: 404 }
        );
      }

      logger.error('Error fetching user details', new Error(userError.message), {
        operation: 'fetchUserDetails',
        errorCode: userError.code,
        userId,
      });

      return NextResponse.json(
        { error: 'Failed to fetch user details' },
        { status: 500 }
      );
    }

    // Format response
    const userDetail: AdminUserDetail = {
      id: user.id,
      email: user.email,
      full_name: user.full_name,
      role: user.role,
      is_active: user.is_active,
      created_at: user.created_at,
      updated_at: user.updated_at,
      last_login_at: user.last_login_at,
      subscription_status: user.subscription_status,
      subscription_tier: user.subscription_tier,
      billing_cycle: user.billing_cycle,
      current_period_end: user.current_period_end,
      trial_end_date: user.trial_end_date,
      stripe_customer_id: user.stripe_customer_id,
      stripe_subscription_id: user.stripe_subscription_id,
      custom_plan_name: user.custom_plan_name,
      custom_plan_type: user.custom_plan_type,
      custom_plan_expires_at: user.custom_plan_expires_at,
      custom_plan_notes: user.custom_plan_notes,
      plan_override_limits: user.plan_override_limits as Record<string, unknown> | null,
      suspension_reason: user.suspension_reason,
      email_verified_manually: user.email_verified_manually,
      admin_notes: user.admin_notes,
      games_created_count: user.games_created_count,
    };

    // Log admin action
    try {
      const headersList = await headers();
      const ipAddress = headersList.get('x-forwarded-for') ||
                        headersList.get('x-real-ip') ||
                        'unknown';
      const userAgent = headersList.get('user-agent') || 'unknown';

      await logAdminAction({
        actionType: 'view_user_profile',
        targetType: 'profile',
        targetId: userId,
        notes: `Viewed profile for ${user.email}`,
        ipAddress,
        userAgent,
      });
    } catch (auditError) {
      // Log audit failure but don't block response
      logger.error('Failed to log admin view action', auditError instanceof Error ? auditError : new Error(String(auditError)), {
        operation: 'auditViewUser',
        userId,
      });
    }

    // Return response
    return NextResponse.json({
      data: userDetail,
    });
  } catch (error) {
    logger.error('Error in GET /api/admin/users/[userId]', error instanceof Error ? error : new Error(String(error)), {
      operation: 'getUserDetails',
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
