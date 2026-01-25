import { type NextRequest, NextResponse } from 'next/server';
import { createAdminServerClient } from '@/lib/admin/auth';
import type { TablesInsert } from '@/types/database.types';
import { logger } from '@/lib/logger';

/**
 * POST /api/games/[gameId]/duplicate
 * Duplicates an existing game with new settings.
 *
 * - Copies game settings (bank_id, num_teams, team_names, timer settings)
 * - Resets status='setup', started_at=null, completed_at=null
 * - Generates new daily_double_positions
 * - Checks subscription quota
 * - Creates team records for duplicated game
 *
 * Returns new game_id on success.
 */
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ gameId: string }> }
) {
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

    // Get gameId from params
    const { gameId } = await context.params;

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(gameId)) {
      return NextResponse.json(
        { error: 'Invalid game ID format' },
        { status: 400 }
      );
    }

    // Fetch the game to duplicate (RLS-protected query)
    // Using eq('teacher_id', user.id) leverages RLS policies for defense in depth
    const { data: originalGame, error: fetchError } = await supabase
      .from('games')
      .select('*')
      .eq('id', gameId)
      .eq('teacher_id', user.id) // RLS enforcement
      .single();

    if (fetchError || !originalGame) {
      logger.error('Game not found or access denied', fetchError, {
        operation: 'duplicateGame',
        gameId,
        userId: user.id,
      });
      // Use 404 instead of 403 to avoid leaking game existence
      return NextResponse.json(
        { error: 'Game not found' },
        { status: 404 }
      );
    }

    // Check subscription quota (increment count if allowed)
    const { data: allowed, error: incrementError } = await supabase
      .rpc('increment_game_count_if_allowed', { p_user_id: user.id });

    if (incrementError) {
      logger.error('Failed to check game creation limit', incrementError, {
        operation: 'duplicateGame',
        userId: user.id,
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
        .eq('id', user.id)
        .single();

      const tier = profile?.subscription_tier?.toUpperCase() || 'FREE';
      const gamesCreated = profile?.games_created_count ?? 0;
      const status = profile?.subscription_status?.toUpperCase() || 'INACTIVE';

      let errorMessage = 'Unable to duplicate game';
      let upgradeRequired = false;

      if (tier === 'FREE' && gamesCreated >= 3) {
        errorMessage = 'Free tier limited to 3 games. Upgrade to create unlimited games.';
        upgradeRequired = true;
      } else if (status !== 'TRIAL' && status !== 'ACTIVE') {
        errorMessage = 'Active subscription required to create games.';
        upgradeRequired = true;
      }

      logger.info('Game duplication denied - limit reached', {
        operation: 'duplicateGame',
        userId: user.id,
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

    // Generate new daily double positions
    // Assume 5 categories and 5 questions per category (standard Jeopardy format)
    const numCategories = 5;
    const numQuestions = 5;
    const totalQuestions = numCategories * numQuestions;

    // Generate 2 random positions for daily doubles
    const dailyDoublePositions: number[] = [];
    while (dailyDoublePositions.length < 2) {
      const randomPos = Math.floor(Math.random() * totalQuestions);
      if (!dailyDoublePositions.includes(randomPos)) {
        dailyDoublePositions.push(randomPos);
      }
    }

    // Create duplicated game data
    const duplicatedGameData: TablesInsert<'games'> = {
      teacher_id: user.id,
      bank_id: originalGame.bank_id,
      num_teams: originalGame.num_teams,
      team_names: originalGame.team_names,
      timer_enabled: originalGame.timer_enabled,
      timer_seconds: originalGame.timer_seconds,
      daily_double_positions: dailyDoublePositions,
      status: 'setup',
      started_at: null,
      completed_at: null,
      selected_questions: [],
    };

    // Create the duplicated game
    const { data: newGame, error: createError } = await supabase
      .from('games')
      .insert(duplicatedGameData)
      .select()
      .single();

    if (createError) {
      logger.error('Failed to create duplicated game', createError, {
        operation: 'duplicateGame',
        userId: user.id,
        originalGameId: gameId,
      });

      // Rollback counter increment
      await supabase.rpc('decrement_game_count', { p_user_id: user.id });

      return NextResponse.json(
        { error: 'Failed to create duplicated game' },
        { status: 500 }
      );
    }

    // Create team records for duplicated game
    const teamRecords = Array.from({ length: originalGame.num_teams }, (_, i) => ({
      game_id: newGame.id,
      team_number: i + 1,
      team_name: originalGame.team_names?.[i] || `Team ${i + 1}`,
      score: 0,
      connection_status: 'pending' as const,
    }));

    const { error: teamsError } = await supabase
      .from('teams')
      .insert(teamRecords);

    if (teamsError) {
      logger.error('Failed to create team records for duplicated game', teamsError, {
        operation: 'duplicateGame',
        userId: user.id,
        gameId: newGame.id,
      });

      // Rollback: Delete game and decrement counter
      await supabase.from('games').delete().eq('id', newGame.id);
      await supabase.rpc('decrement_game_count', { p_user_id: user.id });

      return NextResponse.json(
        { error: 'Failed to create team records' },
        { status: 500 }
      );
    }

    logger.info('Game duplicated successfully', {
      operation: 'duplicateGame',
      userId: user.id,
      originalGameId: gameId,
      newGameId: newGame.id,
    });

    // Return new game ID
    return NextResponse.json({
      game_id: newGame.id,
      status: newGame.status,
      message: 'Game duplicated successfully',
    }, { status: 201 });
  } catch (error) {
    logger.error('Game duplication failed', error, {
      operation: 'duplicateGame',
    });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
