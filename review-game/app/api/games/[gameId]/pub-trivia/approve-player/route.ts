import { type NextRequest, NextResponse } from 'next/server';
import { createAdminServerClient, createAdminServiceClient } from '@/lib/admin/auth';
import { logger } from '@/lib/logger';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * POST /api/games/[gameId]/pub-trivia/approve-player
 *
 * Teacher approves or rejects a pending player:
 * - approved=true  → sets connection_status='connected'
 * - approved=false → deletes the team row (frees the capacity slot for a future join)
 *
 * The teacher page broadcasts pt_player_approved / pt_player_rejected after
 * receiving a 200 response, so the player's browser can transition phases.
 */
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ gameId: string }> },
) {
  try {
    const { gameId } = await context.params;

    if (!UUID_RE.test(gameId)) {
      return NextResponse.json({ error: 'Invalid game ID' }, { status: 400 });
    }

    const body = (await req.json()) as Partial<{ playerId: string; approved: boolean }>;
    const { playerId, approved } = body;

    if (!playerId || !UUID_RE.test(playerId)) {
      return NextResponse.json({ error: 'playerId must be a valid UUID' }, { status: 400 });
    }
    if (typeof approved !== 'boolean') {
      return NextResponse.json({ error: 'approved must be a boolean' }, { status: 400 });
    }

    // Auth — teacher session required
    const authClient = await createAdminServerClient();
    const {
      data: { user },
      error: authError,
    } = await authClient.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const serviceClient = createAdminServiceClient();

    // Verify teacher owns this game
    const { data: game, error: gameError } = await serviceClient
      .from('games')
      .select('teacher_id, game_type')
      .eq('id', gameId)
      .single();

    if (gameError || !game) {
      return NextResponse.json({ error: 'Game not found' }, { status: 404 });
    }
    if (game.teacher_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (game.game_type !== 'pub_trivia') {
      return NextResponse.json({ error: 'Not a pub trivia game' }, { status: 400 });
    }

    if (approved) {
      const { data: updated, error: updateError } = await serviceClient
        .from('teams')
        .update({
          connection_status: 'connected',
          updated_at: new Date().toISOString(),
        })
        .eq('id', playerId)
        .eq('game_id', gameId)
        .select('id, team_name, player_icon')
        .single();

      if (updateError || !updated) {
        return NextResponse.json({ error: 'Player not found' }, { status: 404 });
      }

      logger.info('Pub trivia player approved', {
        operation: 'approvePubTriviaPlayer',
        gameId,
        playerId,
      });

      return NextResponse.json({
        playerId,
        playerName: updated.team_name,
        playerIcon: updated.player_icon ?? null,
        approved: true,
      });
    } else {
      const { error: deleteError } = await serviceClient
        .from('teams')
        .delete()
        .eq('id', playerId)
        .eq('game_id', gameId);

      if (deleteError) {
        logger.error('Failed to reject pub trivia player', deleteError, {
          operation: 'rejectPubTriviaPlayer',
          gameId,
          playerId,
        });
        return NextResponse.json({ error: 'Failed to reject player' }, { status: 500 });
      }

      logger.info('Pub trivia player rejected', {
        operation: 'rejectPubTriviaPlayer',
        gameId,
        playerId,
      });

      return NextResponse.json({ playerId, approved: false });
    }
  } catch (error) {
    logger.error('Unexpected error in approve-player', error, {
      operation: 'approvePubTriviaPlayer',
    });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
