 /**
   * @fileoverview Admin API route for manually verifying user email addresses.
   *
   * Allows admins to manually verify user email addresses for users who have
   * email delivery issues. Updates both the profiles table and Supabase Auth.
   *
   * @module app/api/admin/users/[userId]/verify-email/route
   */

  import { NextRequest, NextResponse } from 'next/server';
  import { verifyAdminUser, createAdminServerClient, logAdminAction } from '@/lib/admin/auth';
  import { headers } from 'next/headers';
  import { logger } from '@/lib/logger';

  /**
   * POST /api/admin/users/[userId]/verify-email
   *
   * Manually verifies a user's email address. Sets email_verified_manually to true
   * in the profiles table and updates the Supabase Auth email_verified field.
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

      // Get Supabase client
      const supabase = await createAdminServerClient();

      // Check if user exists and get current email verification status
      const { data: currentUser, error: fetchError } = await supabase
        .from('profiles')
        .select('id, email, full_name, email_verified_manually')
        .eq('id', userId)
        .single();

      if (fetchError) {
        if (fetchError.code === 'PGRST116') {
          return NextResponse.json(
            { error: 'User not found' },
            { status: 404 }
          );
        }

        logger.error('Error fetching user for email verification', new Error(fetchError.message), {
          operation: 'fetchUserForEmailVerification',
          errorCode: fetchError.code,
          userId,
        });

        return NextResponse.json(
          { error: 'Failed to fetch user' },
          { status: 500 }
        );
      }

      // Get user from Supabase Auth to check current email_verified status
      const { data: authUser, error: authFetchError } = await supabase.auth.admin.getUserById(userId);

      if (authFetchError) {
        logger.error('Error fetching auth user for email verification', authFetchError, {
          operation: 'fetchAuthUserForEmailVerification',
          userId,
        });

        return NextResponse.json(
          { error: 'Failed to fetch user authentication data' },
          { status: 500 }
        );
      }

      // FIXED: Check if email is already verified (either manually or through auth)
      if (authUser.user.email_confirmed_at || currentUser.email_verified_manually) {
        return NextResponse.json(
          {
            error: 'Email is already verified',
            details: {
              authVerified: !!authUser.user.email_confirmed_at,
              manuallyVerified: !!currentUser.email_verified_manually,
            }
          },
          { status: 400 }
        );
      }

      // Prepare changes object for audit log
      const changes = {
        email_verified_manually: { from: currentUser.email_verified_manually || false, to: true },
        auth_email_confirmed_at: { from: null, to: new Date().toISOString() },
      };

      // Update profiles table - set email_verified_manually to true
      const { error: profileUpdateError } = await supabase
        .from('profiles')
        .update({ email_verified_manually: true })
        .eq('id', userId);

      if (profileUpdateError) {
        logger.error('Error updating profile for email verification', new Error(profileUpdateError.message), {
          operation: 'updateProfileEmailVerification',
          userId,
        });

        return NextResponse.json(
          { error: 'Failed to update user profile' },
          { status: 500 }
        );
      }

      // Update Supabase Auth - set email_confirmed_at to mark email as verified
      const { error: authUpdateError } = await supabase.auth.admin.updateUserById(
        userId,
        {
          email_confirm: true,
        }
      );

      // FIXED: Proper rollback error handling
      if (authUpdateError) {
        logger.error('Error updating auth email verification', authUpdateError, {
          operation: 'updateAuthEmailVerification',
          userId,
        });

        // Attempt rollback of profile update
        const { error: rollbackError } = await supabase
          .from('profiles')
          .update({ email_verified_manually: currentUser.email_verified_manually })
          .eq('id', userId);

        if (rollbackError) {
          // CRITICAL: Rollback failed - data is now inconsistent
          logger.error('CRITICAL: Failed to rollback profile update after auth verification failure',
            new Error(rollbackError.message),
            {
              operation: 'rollbackProfileEmailVerification',
              userId,
              userEmail: currentUser.email,
              adminId: adminUser.id,
              originalAuthError: authUpdateError.message,
            }
          );

          return NextResponse.json(
            { error: 'Failed to verify email. System administrators have been notified.' },
            { status: 500 }
          );
        }

        return NextResponse.json(
          { error: 'Failed to verify email in authentication system' },
          { status: 500 }
        );
      }

      // Get request metadata for audit log
      const headersList = await headers();
      const forwardedFor = headersList.get('x-forwarded-for')?.split(',')[0]?.trim();
      const ipAddress = (forwardedFor && forwardedFor.length > 0)
                        ? forwardedFor
                        : headersList.get('x-real-ip') || 'unknown';
      const userAgent = headersList.get('user-agent') || 'unknown';

      // Log admin action to audit trail
      await logAdminAction({
        actionType: 'verify_email_manually',
        targetType: 'profile',
        targetId: userId,
        changes,
        notes: `Manually verified email for ${currentUser.email}`,
        ipAddress,
        userAgent,
      });

      logger.info('Email verified manually', {
        operation: 'verifyEmailManually',
        userId,
        userEmail: currentUser.email,
        adminId: adminUser.id,
      });

      // Return success response
      return NextResponse.json({
        message: 'Email verified successfully',
        data: {
          userId,
          userEmail: currentUser.email,
          verifiedBy: adminUser.email,
          verifiedAt: new Date().toISOString(),
        },
      });
    } catch (error) {
      logger.error('Error in POST /api/admin/users/[userId]/verify-email', error instanceof Error ? error : new
  Error(String(error)), {
        operation: 'verifyEmailManually',
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