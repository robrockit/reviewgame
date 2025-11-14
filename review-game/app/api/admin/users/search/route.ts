/**
 * @fileoverview Admin user search API route.
 *
 * Provides search functionality for finding users by email, name, or user ID.
 * Supports partial matching and returns masked emails by default.
 *
 * @module app/api/admin/users/search/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminUser, createAdminServerClient, logAdminAction } from '@/lib/admin/auth';
import { headers } from 'next/headers';
import { logger } from '@/lib/logger';
import type { AdminUserListItem } from '../route';

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
 * POST /api/admin/users/search
 *
 * Searches for users by email, name, or user ID.
 *
 * Request Body:
 * - query: string (search term)
 * - page: number (default: 1)
 * - limit: number (default: 25, options: 25, 50, 100)
 *
 * @param {NextRequest} req - The incoming request
 * @returns {Promise<NextResponse>} JSON response with matching users and pagination
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
    const body = await req.json();
    const { query, page = 1, limit = 25 } = body;

    // Validate inputs
    if (!query || typeof query !== 'string') {
      return NextResponse.json(
        { error: 'Search query is required' },
        { status: 400 }
      );
    }

    const searchQuery = query.trim();
    if (searchQuery.length === 0) {
      return NextResponse.json(
        { error: 'Search query cannot be empty' },
        { status: 400 }
      );
    }

    const pageNum = Math.max(1, typeof page === 'number' ? page : parseInt(page, 10));
    const rawLimit = typeof limit === 'number' ? limit : parseInt(limit, 10);
    const limitNum = [25, 50, 100].includes(rawLimit) ? rawLimit : 25;

    // Calculate offset for pagination
    const offset = (pageNum - 1) * limitNum;

    // Get Supabase client
    const supabase = await createAdminServerClient();

    // Build search query
    // Search in: email, full_name, or exact match on id
    let queryBuilder = supabase
      .from('profiles')
      .select('id, email, full_name, role, is_active, subscription_status, subscription_tier, last_login_at, created_at, games_created_count', { count: 'exact' });

    // Check if query looks like a UUID (for ID search)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const isUuidSearch = uuidRegex.test(searchQuery);

    if (isUuidSearch) {
      // Exact ID match
      queryBuilder = queryBuilder.eq('id', searchQuery);
    } else {
      // Escape special characters to prevent SQL injection
      // Escape backslash, percent, and underscore which are special in SQL LIKE patterns
      const escapedQuery = searchQuery
        .replace(/\\/g, '\\\\')  // Escape backslashes first
        .replace(/%/g, '\\%')     // Escape percent signs
        .replace(/_/g, '\\_');    // Escape underscores

      // Search by email or name using ilike (case-insensitive pattern matching)
      queryBuilder = queryBuilder.or(`email.ilike.%${escapedQuery}%,full_name.ilike.%${escapedQuery}%`);
    }

    // Execute query with pagination
    const { data: users, count: totalCount, error: searchError } = await queryBuilder
      .order('created_at', { ascending: false })
      .range(offset, offset + limitNum - 1);

    if (searchError) {
      logger.error('Error searching users', new Error(searchError.message), {
        operation: 'searchUsers',
        errorCode: searchError.code,
        query: searchQuery,
        page: pageNum,
        limit: limitNum,
      });
      return NextResponse.json(
        { error: 'Failed to search users' },
        { status: 500 }
      );
    }

    // Mask emails and format response
    const maskedUsers: AdminUserListItem[] = (users || []).map((user) => ({
      ...user,
      email_masked: maskEmail(user.email),
    }));

    // Calculate pagination metadata
    const totalPages = Math.ceil((totalCount || 0) / limitNum);
    const hasNextPage = pageNum < totalPages;
    const hasPreviousPage = pageNum > 1;

    // Log admin action
    try {
      const headersList = await headers();
      const ipAddress = headersList.get('x-forwarded-for') ||
                        headersList.get('x-real-ip') ||
                        'unknown';
      const userAgent = headersList.get('user-agent') || 'unknown';

      await logAdminAction({
        actionType: 'search_users',
        targetType: 'users',
        targetId: 'search',
        notes: `Searched users with query: "${searchQuery}" (${users?.length || 0} results)`,
        ipAddress,
        userAgent,
      });
    } catch (auditError) {
      // Log audit failure but don't block response for search operations
      // Search operations expose masked data only, so less critical than email reveal
      logger.error('Failed to log admin search action', auditError instanceof Error ? auditError : new Error(String(auditError)), {
        operation: 'auditSearchUsers',
        query: searchQuery,
        page: pageNum,
        limit: limitNum,
      });
    }

    // Return response
    return NextResponse.json({
      data: maskedUsers,
      query: searchQuery,
      pagination: {
        page: pageNum,
        limit: limitNum,
        totalCount: totalCount || 0,
        totalPages,
        hasNextPage,
        hasPreviousPage,
      },
    });
  } catch (error) {
    logger.error('Error in POST /api/admin/users/search', error instanceof Error ? error : new Error(String(error)), {
      operation: 'searchUsers',
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
