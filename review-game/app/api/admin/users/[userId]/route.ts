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

/**
 * Update profile request body type
 */
export type UpdateProfileRequest = {
  full_name?: string | null;
  email?: string;
  admin_notes?: string | null;
};

/**
 * Validation constants
 */
const VALIDATION = {
  FULL_NAME_MAX_LENGTH: 255,
  EMAIL_MAX_LENGTH: 255,
  ADMIN_NOTES_MAX_LENGTH: 5000,
  // More robust email validation regex (RFC 5322 compliant)
  EMAIL_REGEX: /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/,
} as const;

/**
 * PATCH /api/admin/users/[userId]
 *
 * Updates user profile information.
 * Requires admin authentication and logs the changes.
 * If email is changed, sets email_verified_manually to false to trigger re-verification.
 *
 * @param {NextRequest} req - The incoming request
 * @param {Object} context - Route context with params
 * @returns {Promise<NextResponse>} JSON response with updated user details
 */
export async function PATCH(
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
    const body: UpdateProfileRequest = await req.json();

    // Validate at least one field is provided
    if (body.full_name === undefined && body.email === undefined && body.admin_notes === undefined) {
      return NextResponse.json(
        { error: 'At least one field must be provided for update' },
        { status: 400 }
      );
    }

    // Sanitize and validate full_name
    if (body.full_name !== undefined && body.full_name !== null) {
      body.full_name = body.full_name.trim();
      if (body.full_name.length > VALIDATION.FULL_NAME_MAX_LENGTH) {
        return NextResponse.json(
          { error: `Full name must be ${VALIDATION.FULL_NAME_MAX_LENGTH} characters or less` },
          { status: 400 }
        );
      }
      // Convert empty string to null
      if (body.full_name === '') {
        body.full_name = null;
      }
    }

    // Sanitize and validate email
    if (body.email !== undefined) {
      body.email = body.email.trim().toLowerCase();

      if (body.email.length === 0) {
        return NextResponse.json(
          { error: 'Email cannot be empty' },
          { status: 400 }
        );
      }

      if (body.email.length > VALIDATION.EMAIL_MAX_LENGTH) {
        return NextResponse.json(
          { error: `Email must be ${VALIDATION.EMAIL_MAX_LENGTH} characters or less` },
          { status: 400 }
        );
      }

      if (!VALIDATION.EMAIL_REGEX.test(body.email)) {
        return NextResponse.json(
          { error: 'Invalid email format' },
          { status: 400 }
        );
      }
    }

    // Sanitize and validate admin_notes
    if (body.admin_notes !== undefined && body.admin_notes !== null) {
      body.admin_notes = body.admin_notes.trim();
      if (body.admin_notes.length > VALIDATION.ADMIN_NOTES_MAX_LENGTH) {
        return NextResponse.json(
          { error: `Admin notes must be ${VALIDATION.ADMIN_NOTES_MAX_LENGTH} characters or less` },
          { status: 400 }
        );
      }
      // Convert empty string to null
      if (body.admin_notes === '') {
        body.admin_notes = null;
      }
    }

    // Get Supabase client
    const supabase = await createAdminServerClient();

    // Check email uniqueness if email is being changed
    if (body.email !== undefined) {
      const { data: existingUser, error: emailCheckError } = await supabase
        .from('profiles')
        .select('id, email')
        .eq('email', body.email)
        .neq('id', userId)
        .maybeSingle();

      if (emailCheckError) {
        logger.error('Error checking email uniqueness', new Error(emailCheckError.message), {
          operation: 'checkEmailUniqueness',
          errorCode: emailCheckError.code,
          userId,
        });
        return NextResponse.json(
          { error: 'Failed to validate email' },
          { status: 500 }
        );
      }

      if (existingUser) {
        return NextResponse.json(
          { error: 'Email is already in use by another user' },
          { status: 409 }
        );
      }
    }

    // Fetch current user data to track changes (include updated_at for optimistic locking)
    const { data: currentUser, error: fetchError } = await supabase
      .from('profiles')
      .select('email, full_name, admin_notes, updated_at')
      .eq('id', userId)
      .single();

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'User not found' },
          { status: 404 }
        );
      }

      logger.error('Error fetching user for update', new Error(fetchError.message), {
        operation: 'fetchUserForUpdate',
        errorCode: fetchError.code,
        userId,
      });

      return NextResponse.json(
        { error: 'Failed to fetch user' },
        { status: 500 }
      );
    }

    // Track changes for audit log
    const changes: Record<string, { from: string | null; to: string | null }> = {};
    const emailChanged = body.email !== undefined && body.email !== currentUser.email;

    if (body.full_name !== undefined && body.full_name !== currentUser.full_name) {
      changes.full_name = { from: currentUser.full_name, to: body.full_name };
    }

    if (emailChanged && body.email) {
      changes.email = { from: currentUser.email, to: body.email };
    }

    if (body.admin_notes !== undefined && body.admin_notes !== currentUser.admin_notes) {
      changes.admin_notes = { from: currentUser.admin_notes, to: body.admin_notes };
    }

    // Build update object
    const updateData: {
      full_name?: string | null;
      email?: string;
      admin_notes?: string | null;
      email_verified_manually?: boolean;
      updated_at?: string;
    } = {
      updated_at: new Date().toISOString(),
    };

    if (body.full_name !== undefined) {
      updateData.full_name = body.full_name;
    }

    if (body.email !== undefined) {
      updateData.email = body.email;
      // If email changed, reset email verification
      if (emailChanged) {
        updateData.email_verified_manually = false;
      }
    }

    if (body.admin_notes !== undefined) {
      updateData.admin_notes = body.admin_notes;
    }

    // Update user in database with optimistic locking
    let query = supabase
      .from('profiles')
      .update(updateData)
      .eq('id', userId);

    // Add optimistic lock check if updated_at exists
    if (currentUser.updated_at) {
      query = query.eq('updated_at', currentUser.updated_at);
    }

    const { data: updatedUser, error: updateError } = await query
      .select()
      .maybeSingle();

    if (updateError) {
      logger.error('Error updating user profile', new Error(updateError.message), {
        operation: 'updateUserProfile',
        errorCode: updateError.code,
        userId,
      });

      return NextResponse.json(
        { error: 'Failed to update user profile' },
        { status: 500 }
      );
    }

    // Check if update succeeded (optimistic lock check)
    if (!updatedUser) {
      logger.warn('Optimistic lock failure - user was modified by another admin', {
        operation: 'updateUserProfile',
        userId,
        adminUserId: adminUser.id,
      });

      return NextResponse.json(
        { error: 'User was modified by another admin. Please refresh and try again.' },
        { status: 409 }
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
        actionType: 'edit_user_profile',
        targetType: 'profile',
        targetId: userId,
        changes,
        notes: emailChanged
          ? `Updated profile for ${currentUser.email}. Email changed - verification required.`
          : `Updated profile for ${currentUser.email}`,
        ipAddress,
        userAgent,
      });
    } catch (auditError) {
      // CRITICAL: Log audit failure with full change details for compliance
      logger.error('CRITICAL: Failed to log admin edit action', auditError instanceof Error ? auditError : new Error(String(auditError)), {
        operation: 'auditEditUser',
        userId,
        adminId: adminUser.id,
        changes: JSON.stringify(changes),
        attemptedAction: 'edit_user_profile',
        emailChanged,
      });
    }

    // Format response
    const userDetail: AdminUserDetail = {
      id: updatedUser.id,
      email: updatedUser.email,
      full_name: updatedUser.full_name,
      role: updatedUser.role,
      is_active: updatedUser.is_active,
      created_at: updatedUser.created_at,
      updated_at: updatedUser.updated_at,
      last_login_at: updatedUser.last_login_at,
      subscription_status: updatedUser.subscription_status,
      subscription_tier: updatedUser.subscription_tier,
      billing_cycle: updatedUser.billing_cycle,
      current_period_end: updatedUser.current_period_end,
      trial_end_date: updatedUser.trial_end_date,
      stripe_customer_id: updatedUser.stripe_customer_id,
      stripe_subscription_id: updatedUser.stripe_subscription_id,
      custom_plan_name: updatedUser.custom_plan_name,
      custom_plan_type: updatedUser.custom_plan_type,
      custom_plan_expires_at: updatedUser.custom_plan_expires_at,
      custom_plan_notes: updatedUser.custom_plan_notes,
      plan_override_limits: updatedUser.plan_override_limits as Record<string, unknown> | null,
      suspension_reason: updatedUser.suspension_reason,
      email_verified_manually: updatedUser.email_verified_manually,
      admin_notes: updatedUser.admin_notes,
      games_created_count: updatedUser.games_created_count,
    };

    // Return success response
    return NextResponse.json({
      data: userDetail,
      message: 'User profile updated successfully',
    });
  } catch (error) {
    logger.error('Error in PATCH /api/admin/users/[userId]', error instanceof Error ? error : new Error(String(error)), {
      operation: 'updateUser',
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
