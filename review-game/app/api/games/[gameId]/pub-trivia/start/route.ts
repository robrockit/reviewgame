import { type NextRequest, NextResponse } from 'next/server';
import { createAdminServerClient, createAdminServiceClient } from '@/lib/admin/auth';
import { canAccessPubTrivia, getMaxPubTriviaPlayers } from '@/lib/utils/feature-access';
import { logger } from '@/lib/logger';
import type { Tables } from '@/types/database.types';
import type { StartPubTriviaResponse } from '@/types/pub-trivia';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * POST /api/games/[gameId]/pub-trivia/start
 *
 * Starts a pub trivia game:
 * 1. Verifies teacher auth and ownership
 * 2. Checks BASIC+ subscription
 * 3. Fetches questions with mc_options from the bank
 * 4. Validates all questions have mc_options
 * 5. Shuffles question order, stores in games.pub_trivia_question_order
 * 6. Updates game status to 'in_progress'
 * 7. Returns total question count and current players
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

    // Auth — teacher session required
    const authClient = await createAdminServerClient();
    const { data: { user }, error: authError } = await authClient.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const serviceClient = createAdminServiceClient();

    // Load profile for feature gating
    const { data: profile, error: profileError } = await serviceClient
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    if (!canAccessPubTrivia(profile as Tables<'profiles'>)) {
      return NextResponse.json(
        { error: 'Quick Fire requires a BASIC or PREMIUM subscription' },
        { status: 403 }
      );
    }

    const maxPlayers = getMaxPubTriviaPlayers(profile as Tables<'profiles'>);

    // Load game and verify ownership
    const { data: game, error: gameError } = await serviceClient
      .from('games')
      .select('id, teacher_id, bank_id, status, game_type, num_teams')
      .eq('id', gameId)
      .single();

    if (gameError || !game) {
      return NextResponse.json({ error: 'Game not found' }, { status: 404 });
    }
    if (game.teacher_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (game.game_type !== 'pub_trivia') {
      return NextResponse.json({ error: 'Game is not a pub trivia game' }, { status: 400 });
    }
    if (game.status !== 'setup') {
      return NextResponse.json({ error: 'Game has already started' }, { status: 409 });
    }

    // Fetch questions for this bank that have mc_options
    const { data: questions, error: qError } = await serviceClient
      .from('questions')
      .select('id, question_text, answer_text, category, mc_options, point_value')
      .eq('bank_id', game.bank_id)
      .not('mc_options', 'is', null);

    if (qError) {
      logger.error('Failed to fetch questions for pub trivia', qError, {
        operation: 'startPubTrivia',
        gameId,
      });
      return NextResponse.json({ error: 'Failed to load questions' }, { status: 500 });
    }

    if (!questions || questions.length === 0) {
      return NextResponse.json(
        { error: 'This question bank has no Quick Fire-ready questions. Add wrong answer options to questions first.' },
        { status: 422 }
      );
    }

    // Shuffle question order (Fisher-Yates)
    const shuffled = [...questions];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    const questionOrder = shuffled.map((q) => q.id);

    // Load current players (teams joined to game)
    const { data: players, error: playersError } = await serviceClient
      .from('teams')
      .select('id, team_name, score, connection_status, player_icon')
      .eq('game_id', gameId)
      .eq('connection_status', 'connected');

    if (playersError) {
      logger.error('Failed to fetch players for pub trivia', playersError, {
        operation: 'startPubTrivia',
        gameId,
      });
      return NextResponse.json({ error: 'Failed to load players' }, { status: 500 });
    }

    if ((players?.length ?? 0) > maxPlayers) {
      return NextResponse.json(
        { error: `Too many players. Your plan allows up to ${maxPlayers} players.` },
        { status: 403 }
      );
    }

    // Persist shuffled order and start the game
    const { error: updateError } = await serviceClient
      .from('games')
      .update({
        status: 'in_progress',
        pub_trivia_question_order: questionOrder,
        current_question_index: 0,
        started_at: new Date().toISOString(),
      })
      .eq('id', gameId);

    if (updateError) {
      logger.error('Failed to start pub trivia game', updateError, {
        operation: 'startPubTrivia',
        gameId,
      });
      return NextResponse.json({ error: 'Failed to start game' }, { status: 500 });
    }

    logger.info('Pub trivia game started', {
      operation: 'startPubTrivia',
      gameId,
      questionCount: questionOrder.length,
      playerCount: players?.length ?? 0,
    });

    const response: StartPubTriviaResponse = {
      totalQuestions: questionOrder.length,
      players: (players ?? []).map((p) => ({
        id: p.id,
        playerName: p.team_name ?? 'Player',
        playerIcon: p.player_icon ?? null,
        score: p.score ?? 0,
        connectionStatus: p.connection_status,
      })),
    };

    return NextResponse.json(response);
  } catch (error) {
    logger.error('Unexpected error starting pub trivia', error, {
      operation: 'startPubTrivia',
    });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
