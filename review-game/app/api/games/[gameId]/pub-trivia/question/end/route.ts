import { type NextRequest, NextResponse } from 'next/server';
import { createAdminServerClient, createAdminServiceClient } from '@/lib/admin/auth';
import { logger } from '@/lib/logger';
import type { QuestionEndResponse } from '@/types/pub-trivia';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * POST /api/games/[gameId]/pub-trivia/question/end
 *
 * Teacher ends the current question round:
 * 1. Verifies teacher auth and ownership
 * 2. Fetches all pub_trivia_answers for the current question
 * 3. Fetches the correct answer
 * 4. Increments current_question_index, clears current_question_started_at
 * 5. Returns results array and hasNextQuestion flag (caller broadcasts to players)
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
      .select('teacher_id, status, game_type, current_question_index, pub_trivia_question_order')
      .eq('id', gameId)
      .single();

    if (gameError || !game) {
      return NextResponse.json({ error: 'Game not found' }, { status: 404 });
    }
    if (game.teacher_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (game.game_type !== 'pub_trivia' || game.status !== 'in_progress') {
      return NextResponse.json({ error: 'Game is not in progress' }, { status: 409 });
    }

    const questionOrder = game.pub_trivia_question_order as string[] | null;
    if (!questionOrder) {
      return NextResponse.json({ error: 'No question order found' }, { status: 500 });
    }

    const index = game.current_question_index ?? 0;
    const questionId = questionOrder[index];

    // Fetch correct answer
    const { data: question, error: qError } = await serviceClient
      .from('questions')
      .select('answer_text')
      .eq('id', questionId)
      .single();

    if (qError || !question) {
      return NextResponse.json({ error: 'Question not found' }, { status: 500 });
    }

    // Fetch all answers submitted for this round with player names and icons
    const { data: answers, error: answersError } = await serviceClient
      .from('pub_trivia_answers')
      .select('player_id, answer_text, is_correct, points_earned, teams(team_name, player_icon)')
      .eq('game_id', gameId)
      .eq('question_id', questionId);

    if (answersError) {
      logger.error('Failed to fetch round answers', answersError, {
        operation: 'endPubTriviaQuestion',
        gameId,
        questionId,
      });
      return NextResponse.json({ error: 'Failed to fetch answers' }, { status: 500 });
    }

    const nextIndex = index + 1;
    const hasNextQuestion = nextIndex < questionOrder.length;

    // Advance to next question index, clear started_at
    const { error: updateError } = await serviceClient
      .from('games')
      .update({
        current_question_index: nextIndex,
        current_question_started_at: null,
      })
      .eq('id', gameId);

    if (updateError) {
      logger.error('Failed to advance question index', updateError, {
        operation: 'endPubTriviaQuestion',
        gameId,
      });
      return NextResponse.json({ error: 'Failed to advance round' }, { status: 500 });
    }

    type AnswerRow = {
      player_id: string;
      answer_text: string;
      is_correct: boolean;
      points_earned: number;
      teams: { team_name: string | null; player_icon: string | null } | { team_name: string | null; player_icon: string | null }[] | null;
    };

    const results = (answers as AnswerRow[] ?? []).map((a) => {
      const team = Array.isArray(a.teams) ? a.teams[0] : a.teams;
      return {
        playerId: a.player_id,
        playerName: team?.team_name ?? 'Player',
        playerIcon: team?.player_icon ?? null,
        answerText: a.answer_text,
        isCorrect: a.is_correct,
        pointsEarned: a.points_earned,
      };
    });

    const response: QuestionEndResponse = {
      correctAnswer: question.answer_text,
      results,
      hasNextQuestion,
    };

    return NextResponse.json(response);
  } catch (error) {
    logger.error('Unexpected error ending pub trivia question', error, {
      operation: 'endPubTriviaQuestion',
    });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
