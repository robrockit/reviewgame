import { type NextRequest, NextResponse } from 'next/server';
import { createAdminServerClient, createAdminServiceClient } from '@/lib/admin/auth';
import { logger } from '@/lib/logger';
import type { PubTriviaQuestionForPlayer } from '@/types/pub-trivia';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * POST /api/games/[gameId]/pub-trivia/question/start
 *
 * Teacher advances to the next question (or the first):
 * 1. Verifies teacher auth and ownership
 * 2. Reads current_question_index and pub_trivia_question_order
 * 3. Fetches the question + mc_options
 * 4. Shuffles the 4 options (3 wrong + 1 correct)
 * 5. Stores current_question_started_at and index on the game row
 * 6. Returns the question payload (no correct answer) for broadcasting
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
      .select('teacher_id, status, game_type, current_question_index, pub_trivia_question_order, timer_seconds')
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
    if (game.status !== 'in_progress') {
      return NextResponse.json({ error: 'Game is not in progress' }, { status: 409 });
    }

    const questionOrder = game.pub_trivia_question_order as string[] | null;
    if (!questionOrder || questionOrder.length === 0) {
      return NextResponse.json({ error: 'No question order found' }, { status: 500 });
    }

    const index = game.current_question_index ?? 0;
    if (index >= questionOrder.length) {
      return NextResponse.json({ error: 'No more questions' }, { status: 422 });
    }

    const questionId = questionOrder[index];

    const { data: question, error: qError } = await serviceClient
      .from('questions')
      .select('id, question_text, answer_text, category, mc_options')
      .eq('id', questionId)
      .single();

    if (qError || !question) {
      logger.error('Failed to fetch pub trivia question', qError, {
        operation: 'startPubTriviaQuestion',
        gameId,
        questionId,
      });
      return NextResponse.json({ error: 'Question not found' }, { status: 404 });
    }

    const wrongOptions = (question.mc_options as string[]) ?? [];
    // Append correct answer at end before shuffling so we can track its final position
    const allOptions = [...wrongOptions, question.answer_text];
    let correctAnswerIndex = allOptions.length - 1; // starts at last position

    // Shuffle options (Fisher-Yates), tracking where the correct answer lands
    for (let i = allOptions.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [allOptions[i], allOptions[j]] = [allOptions[j], allOptions[i]];
      if (correctAnswerIndex === i) correctAnswerIndex = j;
      else if (correctAnswerIndex === j) correctAnswerIndex = i;
    }

    const startedAt = Date.now();
    const durationMs = (game.timer_seconds ?? 20) * 1_000;

    const { error: updateError } = await serviceClient
      .from('games')
      .update({
        current_question_started_at: new Date(startedAt).toISOString(),
      })
      .eq('id', gameId);

    if (updateError) {
      logger.error('Failed to persist question start timestamp', updateError, {
        operation: 'startPubTriviaQuestion',
        gameId,
      });
      return NextResponse.json({ error: 'Failed to start question' }, { status: 500 });
    }

    const questionForPlayer: PubTriviaQuestionForPlayer = {
      id: question.id,
      questionText: question.question_text,
      category: question.category,
      options: allOptions,
    };

    return NextResponse.json({
      questionIndex: index,
      question: questionForPlayer,
      startedAt,
      correctAnswerIndex,
      durationMs,
    });
  } catch (error) {
    logger.error('Unexpected error starting pub trivia question', error, {
      operation: 'startPubTriviaQuestion',
    });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
