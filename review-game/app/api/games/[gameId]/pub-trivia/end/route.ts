import { type NextRequest, NextResponse } from 'next/server';
import { createAdminServerClient, createAdminServiceClient } from '@/lib/admin/auth';
import { logger } from '@/lib/logger';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * POST /api/games/[gameId]/pub-trivia/end
 *
 * Teacher ends the pub trivia game:
 * 1. Verifies teacher auth and ownership
 * 2. Fetches final player scores sorted by score desc
 * 3. Updates game status to 'completed', sets completed_at
 * 4. Returns final rankings for the teacher to broadcast
 */
export async function POST(
  _req: NextRequest,
  context: { params: Promise<{ gameId: string }> }
) {
  try {
    const { gameId } = await context.params;

    if (!UUID_RE.test(gameId)) {
      return NextResponse.json({ error: 'Invalid game ID' }, { status: 400 });
    }

    const authClient = await createAdminServerClient();
    const { data: { user }, error: authError } = await authClient.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const serviceClient = createAdminServiceClient();

    const { data: game, error: gameError } = await serviceClient
      .from('games')
      .select('teacher_id, status, game_type')
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
    if (game.status === 'completed') {
      return NextResponse.json({ error: 'Game already completed' }, { status: 409 });
    }

    // Fetch final rankings
    const { data: players, error: playersError } = await serviceClient
      .from('teams')
      .select('id, team_name, score, connection_status, player_icon')
      .eq('game_id', gameId)
      .order('score', { ascending: false });

    if (playersError) {
      logger.error('Failed to fetch final rankings', playersError, {
        operation: 'endPubTriviaGame',
        gameId,
      });
      return NextResponse.json({ error: 'Failed to fetch rankings' }, { status: 500 });
    }

    const { error: updateError } = await serviceClient
      .from('games')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        current_question_started_at: null,
      })
      .eq('id', gameId);

    if (updateError) {
      logger.error('Failed to complete pub trivia game', updateError, {
        operation: 'endPubTriviaGame',
        gameId,
      });
      return NextResponse.json({ error: 'Failed to end game' }, { status: 500 });
    }

    logger.info('Pub trivia game ended', {
      operation: 'endPubTriviaGame',
      gameId,
      playerCount: players?.length ?? 0,
    });

    const finalRankings = (players ?? []).map((p) => ({
      id: p.id,
      playerName: p.team_name ?? 'Player',
      playerIcon: p.player_icon ?? null,
      score: p.score ?? 0,
      connectionStatus: p.connection_status,
    }));

    return NextResponse.json({ finalRankings });
  } catch (error) {
    logger.error('Unexpected error ending pub trivia game', error, {
      operation: 'endPubTriviaGame',
    });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
