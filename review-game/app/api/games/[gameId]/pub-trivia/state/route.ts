import { type NextRequest, NextResponse } from 'next/server';
import { createAdminServiceClient } from '@/lib/admin/auth';
import { logger } from '@/lib/logger';
import { RateLimiter } from '@/lib/utils/rate-limiter';
import type { PubTriviaQuestionForPlayer } from '@/types/pub-trivia';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// 10 requests per 10s per IP — allows a student to refresh a few times but
// blocks runaway rapid-refresh loops from hammering the DB.
const stateRateLimiter = new RateLimiter(10_000, 10);
if (typeof setInterval !== 'undefined') {
  setInterval(() => stateRateLimiter.cleanup(), 60_000);
}

type PubTriviaStatePhase = 'lobby' | 'question' | 'answered' | 'completed';

export interface PubTriviaStateResponse {
  phase: PubTriviaStatePhase;
  score: number;
  question?: PubTriviaQuestionForPlayer;
  durationMs?: number;
  /** Epoch ms when the current question round started. */
  startedAt?: number;
}

/**
 * GET /api/games/[gameId]/pub-trivia/state?playerId=<uuid>&deviceId=<uuid>
 *
 * Returns the current game phase and question (if active) for a reconnecting player.
 * Called by the player page when restoring state from localStorage after a refresh or
 * disconnect, so the player rejoins mid-game in the correct phase rather than being
 * stuck on the lobby screen.
 *
 * Security: deviceId is verified against teams.device_id before any payload is returned.
 * A null stored device_id (player joined before device binding was enforced) returns 401
 * rather than silently succeeding or silently 403-ing — the caller falls back to 'lobby'.
 *
 * If a question is active, options are reshuffled — safe because answer comparison is by
 * answer_text, not option index.
 */
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ gameId: string }> }
) {
  try {
    const { gameId } = await context.params;

    if (!UUID_RE.test(gameId)) {
      return NextResponse.json({ error: 'Invalid game ID' }, { status: 400 });
    }

    const { searchParams } = new URL(req.url);
    const playerId = searchParams.get('playerId');
    const deviceId = searchParams.get('deviceId');

    if (!playerId || !UUID_RE.test(playerId)) {
      return NextResponse.json(
        { error: 'playerId query param is required and must be a valid UUID' },
        { status: 400 }
      );
    }
    if (!deviceId || !UUID_RE.test(deviceId)) {
      return NextResponse.json(
        { error: 'deviceId query param is required and must be a valid UUID' },
        { status: 400 }
      );
    }

    const ip =
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
      req.headers.get('x-real-ip') ??
      'unknown';
    if (stateRateLimiter.isRateLimited(ip)) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    const serviceClient = createAdminServiceClient();

    // Fetch game and player in parallel — independent queries.
    const [
      { data: game, error: gameError },
      { data: player, error: playerError },
    ] = await Promise.all([
      serviceClient
        .from('games')
        .select(
          'status, game_type, current_question_index, pub_trivia_question_order, current_question_started_at, timer_seconds'
        )
        .eq('id', gameId)
        .single(),
      serviceClient
        .from('teams')
        .select('score, device_id')
        .eq('id', playerId)
        .eq('game_id', gameId)
        .single(),
    ]);

    if (gameError || !game) {
      return NextResponse.json({ error: 'Game not found' }, { status: 404 });
    }
    if (game.game_type !== 'pub_trivia') {
      return NextResponse.json({ error: 'Not a pub trivia game' }, { status: 400 });
    }
    if (playerError || !player) {
      return NextResponse.json({ error: 'Player not found in this game' }, { status: 404 });
    }

    // Verify device ownership. A null stored device_id means the player joined before
    // device binding was enforced — treat as unbound rather than silently 403-ing.
    if (player.device_id === null) {
      logger.warn('Player has no stored device_id during state recovery', {
        operation: 'getPubTriviaState',
        gameId,
        playerId,
      });
      return NextResponse.json({ error: 'Device not bound to this player' }, { status: 401 });
    }
    if (player.device_id !== deviceId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const score = player.score ?? 0;

    if (game.status === 'completed') {
      return NextResponse.json({ phase: 'completed', score } satisfies PubTriviaStateResponse);
    }

    if (game.status !== 'in_progress' || !game.current_question_started_at) {
      return NextResponse.json({ phase: 'lobby', score } satisfies PubTriviaStateResponse);
    }

    // A question is currently active — reconstruct it for this player.
    const questionOrder = game.pub_trivia_question_order as string[] | null;
    if (!questionOrder || questionOrder.length === 0) {
      logger.warn('pub_trivia_question_order missing for active game', {
        operation: 'getPubTriviaState',
        gameId,
      });
      return NextResponse.json({ phase: 'lobby', score } satisfies PubTriviaStateResponse);
    }

    const index = game.current_question_index ?? 0;
    const questionId = questionOrder[index];

    const { data: question, error: qError } = await serviceClient
      .from('questions')
      .select('id, question_text, answer_text, category, mc_options')
      .eq('id', questionId)
      .single();

    if (qError || !question) {
      logger.error('Failed to fetch active pub trivia question during state recovery', qError, {
        operation: 'getPubTriviaState',
        gameId,
        questionId,
      });
      return NextResponse.json({ phase: 'lobby', score } satisfies PubTriviaStateResponse);
    }

    // Reshuffle options (Fisher-Yates). Answer comparison is by text, not index,
    // so a fresh shuffle is safe for a reconnecting player.
    // Deduplicate in case mc_options already contains the correct answer (data entry error).
    const mcOptions = Array.isArray(question.mc_options) ? (question.mc_options as string[]) : [];
    const allOptions = Array.from(new Set([...mcOptions, question.answer_text]));
    for (let i = allOptions.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [allOptions[i], allOptions[j]] = [allOptions[j], allOptions[i]];
    }

    // Check if this player already answered this round.
    const { data: existingAnswer } = await serviceClient
      .from('pub_trivia_answers')
      .select('id')
      .eq('game_id', gameId)
      .eq('player_id', playerId)
      .eq('question_id', questionId)
      .maybeSingle();

    const phase: PubTriviaStatePhase = existingAnswer ? 'answered' : 'question';
    const durationMs = (game.timer_seconds ?? 20) * 1_000;
    const startedAt = new Date(game.current_question_started_at).getTime();

    const questionForPlayer: PubTriviaQuestionForPlayer = {
      id: question.id,
      questionText: question.question_text,
      category: question.category,
      options: allOptions,
    };

    logger.info('Pub trivia state recovered for reconnecting player', {
      operation: 'getPubTriviaState',
      gameId,
      playerId,
      phase,
      questionId,
    });

    return NextResponse.json({
      phase,
      score,
      question: questionForPlayer,
      durationMs,
      startedAt,
    } satisfies PubTriviaStateResponse);
  } catch (error) {
    logger.error('Unexpected error fetching pub trivia state', error, {
      operation: 'getPubTriviaState',
    });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
