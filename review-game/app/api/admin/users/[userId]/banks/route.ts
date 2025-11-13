/**
 * @fileoverview Admin API route for fetching user's question banks.
 *
 * Provides a list of question banks created by a specific user for admin viewing.
 *
 * @module app/api/admin/users/[userId]/banks/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminUser, createAdminServerClient, logAdminAction } from '@/lib/admin/auth';
import { headers } from 'next/headers';
import { logger } from '@/lib/logger';

/**
 * Question bank data returned for user profile viewing
 */
export type AdminUserQuestionBank = {
  id: string;
  title: string;
  subject: string;
  description: string | null;
  difficulty: string | null;
  is_custom: boolean | null;
  is_public: boolean | null;
  created_at: string | null;
  updated_at: string | null;
  // Computed field
  question_count?: number;
};

/**
 * GET /api/admin/users/[userId]/banks
 *
 * Fetches all question banks created by a specific user.
 * Requires admin authentication.
 *
 * Query Parameters:
 * - page: number (default: 1)
 * - limit: number (default: 25, max: 100)
 *
 * @param {NextRequest} req - The incoming request
 * @param {Object} context - Route context with params
 * @returns {Promise<NextResponse>} JSON response with user's question banks
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
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const rawLimit = parseInt(searchParams.get('limit') || '25', 10);
    const limit = Math.min(100, Math.max(1, rawLimit));

    // Calculate offset for pagination
    const offset = (page - 1) * limit;

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

    // Get total count
    const { count: totalCount, error: countError } = await supabase
      .from('question_banks')
      .select('*', { count: 'exact', head: true })
      .eq('owner_id', userId);

    if (countError) {
      logger.error('Error counting user question banks', new Error(countError.message), {
        operation: 'countUserQuestionBanks',
        errorCode: countError.code,
        userId,
      });
      return NextResponse.json(
        { error: 'Failed to count question banks' },
        { status: 500 }
      );
    }

    // Fetch question banks with pagination
    const { data: banks, error: banksError } = await supabase
      .from('question_banks')
      .select('*')
      .eq('owner_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (banksError) {
      logger.error('Error fetching user question banks', new Error(banksError.message), {
        operation: 'fetchUserQuestionBanks',
        errorCode: banksError.code,
        userId,
        page,
        limit,
      });
      return NextResponse.json(
        { error: 'Failed to fetch question banks' },
        { status: 500 }
      );
    }

    // Get question counts for all banks in a single query
    // This prevents N+1 query problem by fetching all counts at once
    const bankIds = (banks || []).map(bank => bank.id);
    const questionCounts = new Map<string, number>();

    if (bankIds.length > 0) {
      // Query questions table once for all bank IDs
      const { data: questionData, error: questionError } = await supabase
        .from('questions')
        .select('bank_id')
        .in('bank_id', bankIds);

      if (!questionError && questionData) {
        // Count questions per bank
        questionData.forEach((question) => {
          const currentCount = questionCounts.get(question.bank_id) || 0;
          questionCounts.set(question.bank_id, currentCount + 1);
        });
      }
    }

    // Format response with question counts
    const formattedBanks: AdminUserQuestionBank[] = (banks || []).map((bank) => ({
      id: bank.id,
      title: bank.title,
      subject: bank.subject,
      description: bank.description,
      difficulty: bank.difficulty,
      is_custom: bank.is_custom,
      is_public: bank.is_public,
      created_at: bank.created_at,
      updated_at: bank.updated_at,
      question_count: questionCounts.get(bank.id) || 0,
    }));

    // Calculate pagination metadata
    const totalPages = Math.ceil((totalCount || 0) / limit);
    const hasNextPage = page < totalPages;
    const hasPreviousPage = page > 1;

    // Log admin action (lightweight - no need to block on failure)
    try {
      const headersList = await headers();
      const ipAddress = headersList.get('x-forwarded-for') ||
                        headersList.get('x-real-ip') ||
                        'unknown';
      const userAgent = headersList.get('user-agent') || 'unknown';

      await logAdminAction({
        actionType: 'view_user_banks',
        targetType: 'question_banks',
        targetId: userId,
        notes: `Viewed question banks for user ${userId} (${banks?.length || 0} results)`,
        ipAddress,
        userAgent,
      });
    } catch (auditError) {
      logger.error('Failed to log admin action', auditError instanceof Error ? auditError : new Error(String(auditError)), {
        operation: 'auditViewUserBanks',
        userId,
      });
    }

    // Return response
    return NextResponse.json({
      data: formattedBanks,
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
    logger.error('Error in GET /api/admin/users/[userId]/banks', error instanceof Error ? error : new Error(String(error)), {
      operation: 'getUserQuestionBanks',
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
