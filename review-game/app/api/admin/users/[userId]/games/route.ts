/**
 * @fileoverview Admin API route for fetching user's games.
 *
 * Provides a list of games created by a specific user for admin viewing.
 *
 * @module app/api/admin/users/[userId]/games/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminUser, createAdminServerClient, logAdminAction } from '@/lib/admin/auth';
import { headers } from 'next/headers';
import { logger } from '@/lib/logger';

/**
 * Game data returned for user profile viewing
 */
export type AdminUserGame = {
  id: string;
  bank_id: string;
  created_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  status: string | null;
  num_teams: number;
  team_names: string[] | null;
  timer_enabled: boolean | null;
  timer_seconds: number | null;
  // Question bank info
  bank_title?: string;
  bank_subject?: string;
};

/**
 * GET /api/admin/users/[userId]/games
 *
 * Fetches all games created by a specific user.
 * Requires admin authentication.
 *
 * Query Parameters:
 * - page: number (default: 1)
 * - limit: number (default: 25, max: 100)
 *
 * @param {NextRequest} req - The incoming request
 * @param {Object} context - Route context with params
 * @returns {Promise<NextResponse>} JSON response with user's games
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
      .from('games')
      .select('*', { count: 'exact', head: true })
      .eq('teacher_id', userId);

    if (countError) {
      logger.error('Error counting user games', new Error(countError.message), {
        operation: 'countUserGames',
        errorCode: countError.code,
        userId,
      });
      return NextResponse.json(
        { error: 'Failed to count games' },
        { status: 500 }
      );
    }

    // Fetch games with pagination
    const { data: games, error: gamesError } = await supabase
      .from('games')
      .select(`
        id,
        bank_id,
        created_at,
        started_at,
        completed_at,
        status,
        num_teams,
        team_names,
        timer_enabled,
        timer_seconds,
        question_banks (
          title,
          subject
        )
      `)
      .eq('teacher_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (gamesError) {
      logger.error('Error fetching user games', new Error(gamesError.message), {
        operation: 'fetchUserGames',
        errorCode: gamesError.code,
        userId,
        page,
        limit,
      });
      return NextResponse.json(
        { error: 'Failed to fetch games' },
        { status: 500 }
      );
    }

    // Define proper type for query result with joined question bank data
    type GameWithBank = {
      id: string;
      bank_id: string;
      created_at: string | null;
      started_at: string | null;
      completed_at: string | null;
      status: string | null;
      num_teams: number;
      team_names: string[] | null;
      timer_enabled: boolean | null;
      timer_seconds: number | null;
      question_banks: {
        title: string;
        subject: string;
      } | null;
    };

    // Format response with proper typing
    const formattedGames: AdminUserGame[] = (games as GameWithBank[] || []).map((game) => ({
      id: game.id,
      bank_id: game.bank_id,
      created_at: game.created_at,
      started_at: game.started_at,
      completed_at: game.completed_at,
      status: game.status,
      num_teams: game.num_teams,
      team_names: game.team_names,
      timer_enabled: game.timer_enabled,
      timer_seconds: game.timer_seconds,
      bank_title: game.question_banks?.title,
      bank_subject: game.question_banks?.subject,
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
        actionType: 'view_user_games',
        targetType: 'games',
        targetId: userId,
        notes: `Viewed games for user ${userId} (${games?.length || 0} results)`,
        ipAddress,
        userAgent,
      });
    } catch (auditError) {
      logger.error('Failed to log admin action', auditError instanceof Error ? auditError : new Error(String(auditError)), {
        operation: 'auditViewUserGames',
        userId,
      });
    }

    // Return response
    return NextResponse.json({
      data: formattedGames,
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
    logger.error('Error in GET /api/admin/users/[userId]/games', error instanceof Error ? error : new Error(String(error)), {
      operation: 'getUserGames',
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
