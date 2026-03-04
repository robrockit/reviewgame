import { type NextRequest, NextResponse } from 'next/server';
import { createAdminServerClient } from '@/lib/admin/auth';
import type { TablesInsert } from '@/types/database.types';
import type { GameListItem, GameListResponse } from '@/types/game.types';
import { logger } from '@/lib/logger';

/**
 * GET /api/games
 * Fetches the authenticated user's games with pagination and filtering.
 *
 * Query Parameters:
 * - page: number (default: 1)
 * - limit: number (default: 12, max: 50)
 * - search: string (search bank title/subject)
 * - status: 'setup' | 'in_progress' | 'completed' | 'all' (default: 'all')
 * - sort: 'created_at' | 'bank_title' | 'status' (default: 'created_at')
 * - order: 'asc' | 'desc' (default: 'desc')
 * - effective_user_id: string (optional: for admin impersonation)
 */
export async function GET(req: NextRequest) {
  try {
    const supabase = await createAdminServerClient();

    // Get authenticated user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Parse query parameters
    const { searchParams } = req.nextUrl;
    const MAX_PAGE = 10000; // Prevent DoS via extremely large offsets
    const page = Math.min(MAX_PAGE, Math.max(1, parseInt(searchParams.get('page') || '1', 10)));
    const rawLimit = parseInt(searchParams.get('limit') || '12', 10);
    const limit = Math.min(50, Math.max(1, rawLimit));
    const search = searchParams.get('search') || '';
    const status = searchParams.get('status') || 'all';
    const sort = (searchParams.get('sort') || 'created_at') as 'created_at' | 'bank_title' | 'status';
    const order = (searchParams.get('order') || 'desc') as 'asc' | 'desc';
    const effectiveUserId = searchParams.get('effective_user_id');

    // Determine which user ID to use (for admin impersonation support)
    const targetUserId = effectiveUserId || user.id;

    // Calculate offset for pagination
    const offset = (page - 1) * limit;

    // Build base query
    let countQuery = supabase
      .from('games')
      .select('*', { count: 'exact', head: true })
      .eq('teacher_id', targetUserId);

    let dataQuery = supabase
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
      .eq('teacher_id', targetUserId);

    // Apply status filter
    if (status !== 'all') {
      countQuery = countQuery.eq('status', status);
      dataQuery = dataQuery.eq('status', status);
    }

    // Apply search filter (search bank title or subject)
    if (search) {
      // Sanitize search input to prevent SQL injection
      // Escape special characters used in PostgreSQL LIKE patterns
      const sanitizedSearch = search.replace(/[%_\\]/g, '\\$&');

      // For search, we need to use a different approach since we're joining tables
      // We'll fetch all matching question banks first, then filter games
      const { data: matchingBanks } = await supabase
        .from('question_banks')
        .select('id')
        .or(`title.ilike.%${sanitizedSearch}%,subject.ilike.%${sanitizedSearch}%`);

      if (matchingBanks && matchingBanks.length > 0) {
        const bankIds = matchingBanks.map(b => b.id);
        countQuery = countQuery.in('bank_id', bankIds);
        dataQuery = dataQuery.in('bank_id', bankIds);
      } else {
        // No matching banks, return empty result
        return NextResponse.json({
          data: [],
          pagination: {
            page,
            limit,
            totalCount: 0,
            totalPages: 0,
            hasNextPage: false,
            hasPreviousPage: false,
          },
        } as GameListResponse);
      }
    }

    // Get total count
    const { count: totalCount, error: countError } = await countQuery;

    if (countError) {
      logger.error('Error counting games', countError, {
        operation: 'getGames',
        userId: targetUserId,
      });
      return NextResponse.json(
        { error: 'Failed to count games' },
        { status: 500 }
      );
    }

    // Apply sorting
    // Note: sorting by bank_title requires client-side sorting after fetching
    // since it's a joined field
    if (sort === 'created_at') {
      dataQuery = dataQuery.order('created_at', { ascending: order === 'asc' });
    } else if (sort === 'status') {
      dataQuery = dataQuery.order('status', { ascending: order === 'asc' });
    } else {
      // For bank_title, we'll sort client-side after fetching
      dataQuery = dataQuery.order('created_at', { ascending: order === 'asc' });
    }

    // Apply pagination
    dataQuery = dataQuery.range(offset, offset + limit - 1);

    // Fetch games
    const { data: games, error: gamesError } = await dataQuery;

    if (gamesError) {
      logger.error('Error fetching games', gamesError, {
        operation: 'getGames',
        userId: targetUserId,
        page,
        limit,
      });
      return NextResponse.json(
        { error: 'Failed to fetch games' },
        { status: 500 }
      );
    }

    // Define type for query result with joined question bank data
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

    // Format response
    const formattedGames: GameListItem[] = (games as GameWithBank[] || []).map((game) => ({
      id: game.id,
      bank_id: game.bank_id,
      bank_title: game.question_banks?.title || 'Unknown',
      bank_subject: game.question_banks?.subject || 'Unknown',
      status: game.status,
      num_teams: game.num_teams,
      created_at: game.created_at,
      started_at: game.started_at,
      completed_at: game.completed_at,
      timer_enabled: game.timer_enabled,
      timer_seconds: game.timer_seconds,
      team_names: game.team_names,
    }));

    // Sort by bank_title if requested (client-side)
    if (sort === 'bank_title') {
      formattedGames.sort((a, b) => {
        const comparison = a.bank_title.localeCompare(b.bank_title);
        return order === 'asc' ? comparison : -comparison;
      });
    }

    // Calculate pagination metadata
    const totalPages = Math.ceil((totalCount || 0) / limit);
    const hasNextPage = page < totalPages;
    const hasPreviousPage = page > 1;

    logger.info('Games fetched successfully', {
      operation: 'getGames',
      userId: targetUserId,
      count: formattedGames.length,
      page,
    });

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
    } as GameListResponse);
  } catch (error) {
    logger.error('Failed to fetch games', error, {
      operation: 'getGames',
    });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/games
 * Creates a new game with proper subscription tier enforcement.
 *
 * Free tier users are limited to 3 game creations (cumulative count).
 * Trial and paid users have unlimited game creations.
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createAdminServerClient();

    // Get authenticated user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get request body
    const body = await req.json();
    const {
      bank_id,
      num_teams,
      team_names,
      timer_enabled,
      timer_seconds,
      daily_double_positions,
      effective_user_id, // Optional: for admin impersonation
    } = body;

    // Validate required fields
    if (!bank_id || !num_teams || !daily_double_positions) {
      return NextResponse.json(
        { error: 'Missing required fields: bank_id, num_teams, daily_double_positions' },
        { status: 400 }
      );
    }

    // Validate bank_id format (must be valid UUID)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(bank_id)) {
      return NextResponse.json(
        { error: 'Invalid bank_id format. Must be a valid UUID.' },
        { status: 400 }
      );
    }

    // Validate num_teams (must be positive integer between 1 and 10)
    if (typeof num_teams !== 'number' || !Number.isInteger(num_teams) || num_teams < 1 || num_teams > 10) {
      return NextResponse.json(
        { error: 'num_teams must be an integer between 1 and 10' },
        { status: 400 }
      );
    }

    // Validate timer settings
    if (timer_enabled && (!timer_seconds || typeof timer_seconds !== 'number' || timer_seconds < 10 || timer_seconds > 120)) {
      return NextResponse.json(
        { error: 'timer_seconds must be between 10 and 120 when timer is enabled' },
        { status: 400 }
      );
    }

    // Validate daily_double_positions (must be array of 2 valid positions)
    if (!Array.isArray(daily_double_positions) || daily_double_positions.length !== 2) {
      return NextResponse.json(
        { error: 'daily_double_positions must be an array of exactly 2 positions' },
        { status: 400 }
      );
    }

    // Validate team_names if provided (length must match num_teams)
    if (team_names) {
      if (!Array.isArray(team_names)) {
        return NextResponse.json(
          { error: 'team_names must be an array' },
          { status: 400 }
        );
      }
      if (team_names.length !== num_teams) {
        return NextResponse.json(
          { error: `team_names length (${team_names.length}) must match num_teams (${num_teams})` },
          { status: 400 }
        );
      }
      // Validate each team name is a non-empty string
      for (let i = 0; i < team_names.length; i++) {
        if (typeof team_names[i] !== 'string' || team_names[i].trim().length === 0) {
          return NextResponse.json(
            { error: `team_names[${i}] must be a non-empty string` },
            { status: 400 }
          );
        }
      }
    }

    // Determine which user ID to use (for admin impersonation support)
    const targetUserId = effective_user_id || user.id;

    // Atomically check and increment game count (prevents race conditions)
    // This MUST happen BEFORE creating the game to ensure proper enforcement
    const { data: allowed, error: incrementError } = await supabase
      .rpc('increment_game_count_if_allowed', { p_user_id: targetUserId });

    if (incrementError) {
      logger.error('Failed to check game creation limit', incrementError, {
        operation: 'createGame',
        userId: targetUserId,
      });
      return NextResponse.json(
        { error: 'Failed to verify game creation eligibility' },
        { status: 500 }
      );
    }

    if (!allowed) {
      // Fetch profile to get current count for error message
      const { data: profile } = await supabase
        .from('profiles')
        .select('subscription_tier, subscription_status, games_created_count')
        .eq('id', targetUserId)
        .single();

      const tier = profile?.subscription_tier?.toUpperCase() || 'FREE';
      const gamesCreated = profile?.games_created_count ?? 0;
      const status = profile?.subscription_status?.toUpperCase() || 'INACTIVE';

      // Determine reason for denial
      let errorMessage = 'Unable to create game';
      let upgradeRequired = false;

      if (tier === 'FREE' && gamesCreated >= 3) {
        errorMessage = 'Free tier limited to 3 games. Upgrade to create unlimited games.';
        upgradeRequired = true;
      } else if (status !== 'TRIAL' && status !== 'ACTIVE') {
        errorMessage = 'Active subscription required to create games.';
        upgradeRequired = true;
      }

      logger.info('Game creation denied - limit reached', {
        operation: 'createGame',
        userId: targetUserId,
        tier,
        gamesCreated,
        subscriptionStatus: status,
      });

      return NextResponse.json(
        {
          error: errorMessage,
          upgrade_url: '/pricing',
          upgrade_required: upgradeRequired,
          games_created: gamesCreated,
          limit: tier === 'FREE' ? 3 : null,
        },
        { status: 403 }
      );
    }

    // At this point, counter is already incremented (for FREE tier)
    // We need to rollback if game/team creation fails

    // Create game data
    const gameData: TablesInsert<'games'> = {
      teacher_id: targetUserId,
      bank_id,
      num_teams,
      team_names,
      timer_enabled: timer_enabled ?? true,
      timer_seconds: timer_enabled ? timer_seconds : null,
      daily_double_positions,
      status: 'setup',
      selected_questions: [],
    };

    // Create game in database
    const { data: newGame, error: gameError } = await supabase
      .from('games')
      .insert(gameData)
      .select()
      .single();

    if (gameError) {
      logger.error('Failed to create game', gameError, {
        operation: 'createGame',
        userId: targetUserId,
        bankId: bank_id,
      });

      // Rollback counter increment for FREE tier users
      await supabase.rpc('decrement_game_count', { p_user_id: targetUserId });

      return NextResponse.json(
        { error: 'Failed to create game' },
        { status: 500 }
      );
    }

    // Create team records
    const teamRecords = Array.from({ length: num_teams }, (_, i) => ({
      game_id: newGame.id,
      team_number: i + 1,
      team_name: team_names?.[i] || `Team ${i + 1}`,
      score: 0,
      connection_status: 'pending' as const,
    }));

    const { error: teamsError } = await supabase
      .from('teams')
      .insert(teamRecords);

    if (teamsError) {
      logger.error('Failed to create team records', teamsError, {
        operation: 'createGame',
        userId: targetUserId,
        gameId: newGame.id,
      });

      // Rollback: Delete game and decrement counter
      await supabase.from('games').delete().eq('id', newGame.id);
      await supabase.rpc('decrement_game_count', { p_user_id: targetUserId });

      return NextResponse.json(
        { error: 'Failed to create team records' },
        { status: 500 }
      );
    }

    // Counter was already incremented atomically before game creation
    // No need for additional increment here

    logger.info('Game created successfully', {
      operation: 'createGame',
      userId: targetUserId,
      gameId: newGame.id,
    });

    // Return created game
    return NextResponse.json({
      game_id: newGame.id,
      status: newGame.status,
      message: 'Game created successfully',
    }, { status: 201 });

  } catch (error) {
    logger.error('Game creation failed', error, {
      operation: 'createGame',
    });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
