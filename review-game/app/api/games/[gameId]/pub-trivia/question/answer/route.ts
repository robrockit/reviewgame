import { type NextRequest, NextResponse } from 'next/server';
import { createAdminServiceClient } from '@/lib/admin/auth';
import { calcPointsEarned } from '@/types/pub-trivia';
import { logger } from '@/lib/logger';
import type { SubmitAnswerRequest, SubmitAnswerResponse } from '@/types/pub-trivia';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * POST /api/games/[gameId]/pub-trivia/question/answer
 *
 * Individual player submits a multiple-choice answer:
 * 1. Validates deviceId and playerId (no auth session for students)
 * 2. Verifies player belongs to game and device matches
 * 3. Verifies game is in_progress with an active question
 * 4. Checks for duplicate submission (UNIQUE constraint → 409)
 * 5. Computes elapsed fraction → point bracket → points_earned
 * 6. Inserts into pub_trivia_answers
 * 7. Increments teams.score
 * 8. Returns result (isCorrect, pointsEarned, totalScore)
 */
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ gameId: string }> }
) {
  try {
    const { gameId } = await context.params;

    if (!UUID_RE.test(gameId)) {
      return NextResponse.json({ error: 'Invalid game ID' }, { status: 400 });
    }

    const body = (await req.json()) as Partial<SubmitAnswerRequest>;
    const { playerId, answerText, deviceId, questionId: submittedQuestionId } = body;

    if (!playerId || !answerText || !deviceId || !submittedQuestionId) {
      return NextResponse.json(
        { error: 'playerId, answerText, deviceId, and questionId are required' },
        { status: 400 }
      );
    }
    if (!UUID_RE.test(playerId) || !UUID_RE.test(deviceId) || !UUID_RE.test(submittedQuestionId)) {
      return NextResponse.json({ error: 'Invalid ID format' }, { status: 400 });
    }
    if (typeof answerText !== 'string' || answerText.trim().length === 0) {
      return NextResponse.json({ error: 'answerText must be a non-empty string' }, { status: 400 });
    }

    const serviceClient = createAdminServiceClient();

    // Load game state
    const { data: game, error: gameError } = await serviceClient
      .from('games')
      .select('status, game_type, current_question_index, pub_trivia_question_order, current_question_started_at, timer_seconds')
      .eq('id', gameId)
      .single();

    if (gameError || !game) {
      return NextResponse.json({ error: 'Game not found' }, { status: 404 });
    }
    if (game.game_type !== 'pub_trivia' || game.status !== 'in_progress') {
      return NextResponse.json({ error: 'Game is not accepting answers' }, { status: 409 });
    }
    if (!game.current_question_started_at) {
      return NextResponse.json({ error: 'No active question' }, { status: 409 });
    }

    // Verify player belongs to this game and device matches
    const { data: player, error: playerError } = await serviceClient
      .from('teams')
      .select('id, device_id, score, game_id')
      .eq('id', playerId)
      .single();

    if (playerError || !player) {
      return NextResponse.json({ error: 'Player not found' }, { status: 404 });
    }
    if (player.game_id !== gameId) {
      return NextResponse.json({ error: 'Player does not belong to this game' }, { status: 403 });
    }
    if (player.device_id !== deviceId) {
      return NextResponse.json({ error: 'Device ID mismatch' }, { status: 403 });
    }

    // Get the current question to check correct answer
    const questionOrder = game.pub_trivia_question_order as string[] | null;
    if (!questionOrder) {
      return NextResponse.json({ error: 'Question order not initialized' }, { status: 500 });
    }
    const questionId = questionOrder[game.current_question_index ?? 0];

    // Reject if the client is answering a question that is no longer active
    // (teacher advanced while the HTTP request was in-flight)
    if (submittedQuestionId !== questionId) {
      return NextResponse.json({ error: 'Question is no longer active' }, { status: 409 });
    }

    const { data: question, error: qError } = await serviceClient
      .from('questions')
      .select('id, answer_text')
      .eq('id', questionId)
      .single();

    if (qError || !question) {
      return NextResponse.json({ error: 'Question not found' }, { status: 500 });
    }

    // Compute time-based score (server-side, immune to client clock manipulation)
    const questionDurationMs = (game.timer_seconds ?? 20) * 1_000;
    const startedAt = new Date(game.current_question_started_at).getTime();
    const answeredAt = Date.now();
    const elapsedMs = answeredAt - startedAt;
    const elapsedFraction = Math.min(1, Math.max(0, elapsedMs / questionDurationMs));

    const isCorrect = answerText.trim().toLowerCase() === question.answer_text.trim().toLowerCase();
    const pointsEarned = isCorrect ? calcPointsEarned(elapsedFraction) : 0;

    // Insert answer (UNIQUE constraint on game_id+player_id+question_id rejects duplicates)
    const { error: insertError } = await serviceClient
      .from('pub_trivia_answers')
      .insert({
        game_id: gameId,
        player_id: playerId,
        question_id: questionId,
        answer_text: answerText.trim(),
        is_correct: isCorrect,
        points_earned: pointsEarned,
        answered_at: new Date(answeredAt).toISOString(),
      });

    if (insertError) {
      // Unique constraint violation = duplicate submission
      if (insertError.code === '23505') {
        return NextResponse.json({ error: 'Answer already submitted' }, { status: 409 });
      }
      logger.error('Failed to insert pub trivia answer', insertError, {
        operation: 'submitPubTriviaAnswer',
        gameId,
        playerId,
      });
      return NextResponse.json({ error: 'Failed to record answer' }, { status: 500 });
    }

    // Atomically increment player score (eliminates read-modify-write race on concurrent retries)
    const { data: newScoreData, error: scoreError } = await serviceClient.rpc('increment_pub_trivia_score', {
      p_player_id: playerId,
      p_points_earned: pointsEarned,
    });

    if (scoreError) {
      logger.error('Failed to update player score', scoreError, {
        operation: 'submitPubTriviaAnswer',
        gameId,
        playerId,
      });
      // Non-fatal: answer is already recorded; score update can be reconciled
    }

    const totalScore = (newScoreData as number | null) ?? ((player.score ?? 0) + pointsEarned);

    // Fire-and-forget: query tally and broadcast to teacher without blocking the student response.
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (supabaseUrl && serviceKey) {
      void (async () => {
        const { data: tallyCounts } = await serviceClient
          .from('pub_trivia_answers')
          .select('answer_text')
          .eq('game_id', gameId)
          .eq('question_id', questionId);

        const tally: Record<string, number> = {};
        for (const row of tallyCounts ?? []) {
          tally[row.answer_text] = (tally[row.answer_text] ?? 0) + 1;
        }
        const totalAnswered = tallyCounts?.length ?? 0;

        await fetch(`${supabaseUrl}/realtime/v1/api/broadcast`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': serviceKey,
            'Authorization': `Bearer ${serviceKey}`,
          },
          body: JSON.stringify({
            messages: [
              {
                topic: `pub-trivia:${gameId}`,
                event: 'pt_answer_tally',
                payload: { tally, totalAnswered },
              },
            ],
          }),
        });
      })().catch(() => {}); // Non-fatal — teacher updates on next answer if this misses
    }

    const response: SubmitAnswerResponse = {
      isCorrect,
      pointsEarned,
      totalScore,
    };

    return NextResponse.json(response);
  } catch (error) {
    logger.error('Unexpected error submitting pub trivia answer', error, {
      operation: 'submitPubTriviaAnswer',
    });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
