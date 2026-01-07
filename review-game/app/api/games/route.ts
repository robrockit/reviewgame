import { type NextRequest, NextResponse } from 'next/server';
import { createAdminServerClient } from '@/lib/admin/auth';
import type { TablesInsert } from '@/types/database.types';
import { logger } from '@/lib/logger';

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
