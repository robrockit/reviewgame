/**
 * @fileoverview Admin API route for user management.
 *
 * Provides endpoints for listing and searching users in the admin portal.
 * All operations require admin authentication and are logged to the audit trail.
 *
 * @module app/api/admin/users/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminUser, createAdminServerClient, logAdminAction } from '@/lib/admin/auth';
import { headers } from 'next/headers';

/**
 * User data returned in API responses
 */
export type AdminUserListItem = {
  id: string;
  email: string;
  email_masked: string;
  full_name: string | null;
  role: string | null;
  is_active: boolean | null;
  subscription_status: string | null;
  subscription_tier: string | null;
  last_login_at: string | null;
  created_at: string | null;
  games_created_count: number | null;
};

/**
 * Masks an email address for privacy.
 * Example: john.doe@example.com -> j***@example.com
 */
function maskEmail(email: string): string {
  const [localPart, domain] = email.split('@');
  if (!localPart || !domain) return email;

  if (localPart.length <= 2) {
    return `${localPart[0]}***@${domain}`;
  }

  return `${localPart[0]}***@${domain}`;
}

/**
 * GET /api/admin/users
 *
 * Lists all users with pagination.
 *
 * Query Parameters:
 * - page: number (default: 1)
 * - limit: number (default: 25, options: 25, 50, 100)
 * - sortBy: string (default: 'created_at')
 * - sortOrder: 'asc' | 'desc' (default: 'desc')
 *
 * @param {NextRequest} req - The incoming request
 * @returns {Promise<NextResponse>} JSON response with users and pagination metadata
 */
export async function GET(req: NextRequest) {
  try {
    // Verify admin authentication
    const adminUser = await verifyAdminUser();
    if (!adminUser) {
      return NextResponse.json(
        { error: 'Unauthorized: Admin access required' },
        { status: 401 }
      );
    }

    // Parse query parameters
    const { searchParams } = req.nextUrl;
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const rawLimit = parseInt(searchParams.get('limit') || '25', 10);
    const limit = [25, 50, 100].includes(rawLimit) ? rawLimit : 25;
    const sortBy = searchParams.get('sortBy') || 'created_at';
    const sortOrder = searchParams.get('sortOrder') === 'asc' ? 'asc' : 'desc';

    // Calculate offset for pagination
    const offset = (page - 1) * limit;

    // Allowed sort columns for security
    const allowedSortColumns = [
      'created_at',
      'email',
      'full_name',
      'last_login_at',
      'subscription_status',
      'role',
    ];
    const safeSortBy = allowedSortColumns.includes(sortBy) ? sortBy : 'created_at';

    // Get Supabase client
    const supabase = await createAdminServerClient();

    // Get total count
    const { count: totalCount, error: countError } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true });

    if (countError) {
      console.error('Error counting users:', countError);
      return NextResponse.json(
        { error: 'Failed to count users' },
        { status: 500 }
      );
    }

    // Fetch users with pagination
    const { data: users, error: usersError } = await supabase
      .from('profiles')
      .select('id, email, full_name, role, is_active, subscription_status, subscription_tier, last_login_at, created_at, games_created_count')
      .order(safeSortBy, { ascending: sortOrder === 'asc' })
      .range(offset, offset + limit - 1);

    if (usersError) {
      console.error('Error fetching users:', usersError);
      return NextResponse.json(
        { error: 'Failed to fetch users' },
        { status: 500 }
      );
    }

    // Mask emails and format response
    const maskedUsers: AdminUserListItem[] = (users || []).map((user) => ({
      ...user,
      email_masked: maskEmail(user.email),
    }));

    // Calculate pagination metadata
    const totalPages = Math.ceil((totalCount || 0) / limit);
    const hasNextPage = page < totalPages;
    const hasPreviousPage = page > 1;

    // Log admin action
    try {
      const headersList = await headers();
      const ipAddress = headersList.get('x-forwarded-for') ||
                        headersList.get('x-real-ip') ||
                        'unknown';
      const userAgent = headersList.get('user-agent') || 'unknown';

      await logAdminAction({
        actionType: 'list_users',
        targetType: 'users',
        targetId: 'all',
        notes: `Listed users (page ${page}, limit ${limit})`,
        ipAddress,
        userAgent,
      });
    } catch (auditError) {
      // Log silently - don't block response if audit logging fails
      if (process.env.NODE_ENV === 'development') {
        console.error('Failed to log admin action:', auditError);
      }
    }

    // Return response
    return NextResponse.json({
      data: maskedUsers,
      pagination: {
        page,
        limit,
        totalCount: totalCount || 0,
        totalPages,
        hasNextPage,
        hasPreviousPage,
      },
    });
  } catch (error) {
    console.error('Error in GET /api/admin/users:', error);

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
