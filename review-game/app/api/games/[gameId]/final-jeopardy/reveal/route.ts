import { type NextRequest, NextResponse } from 'next/server';
import { createAdminServerClient } from '@/lib/admin/auth';
import { logger } from '@/lib/logger';

/**
 * POST /api/games/[gameId]/final-jeopardy/reveal
 * Reveals and grades a team's Final Jeopardy answer.
 *
 * Body: { teamId: string, isCorrect: boolean }
 *
 * Verifies:
 * - User owns the game
 * - Game phase is 'final_jeopardy_reveal'
 * - Team has submitted wager and answer
 *
 * Actions:
 * - Calculates score change: +wager if correct, -wager if incorrect
 * - Updates team score using update_team_score function
 * - Updates wagers table with is_correct and revealed flags
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

    // Get request body
    const body = await req.json();
    const { teamId, isCorrect } = body;

    // Validate required fields
    if (!teamId || typeof isCorrect !== 'boolean') {
      return NextResponse.json(
        { error: 'teamId and isCorrect (boolean) are required' },
        { status: 400 }
      );
    }

    // Validate teamId UUID format
    if (!uuidRegex.test(teamId)) {
      return NextResponse.json(
        { error: 'Invalid team ID format' },
        { status: 400 }
      );
    }

    // Use atomic database function to reveal answer and update score (single transaction)
    const { data: result, error: revealError } = await supabase
      .rpc('reveal_final_jeopardy_answer', {
        p_game_id: gameId,
        p_team_id: teamId,
        p_is_correct: isCorrect,
        p_teacher_id: user.id,
      });

    if (revealError) {
      logger.error('Database error during reveal', revealError, {
        operation: 'revealFinalJeopardyAnswer',
        gameId,
        teamId,
        isCorrect,
      });
      return NextResponse.json(
        { error: 'Failed to reveal answer' },
        { status: 500 }
      );
    }

    // Validate result structure
    if (!Array.isArray(result) || result.length === 0) {
      logger.error('Invalid result from reveal_final_jeopardy_answer', new Error('Empty result'), {
        operation: 'revealFinalJeopardyAnswer',
        gameId,
        teamId,
        result,
      });
      return NextResponse.json(
        { error: 'Failed to reveal answer' },
        { status: 500 }
      );
    }

    const revealResult = result[0];

    // Check if reveal was successful
    if (!revealResult.success) {
      const statusCode = revealResult.error_message === 'Unauthorized' ? 403 : 400;
      return NextResponse.json(
        { error: revealResult.error_message || 'Failed to reveal answer' },
        { status: statusCode }
      );
    }

    // Validate response fields
    if (typeof revealResult.new_score !== 'number' || typeof revealResult.score_change !== 'number') {
      logger.error('Invalid fields in reveal result', new Error('Type error'), {
        operation: 'revealFinalJeopardyAnswer',
        gameId,
        teamId,
        newScore: revealResult.new_score,
        scoreChange: revealResult.score_change,
      });
      return NextResponse.json(
        { error: 'Failed to reveal answer - invalid response' },
        { status: 500 }
      );
    }

    const newScore = revealResult.new_score;
    const scoreChange = revealResult.score_change;
    const wager = Math.abs(scoreChange); // Wager is absolute value of score change

    logger.info('Final Jeopardy answer revealed successfully', {
      operation: 'revealFinalJeopardyAnswer',
      gameId,
      teamId,
      isCorrect,
      scoreChange,
      newScore,
    });

    return NextResponse.json({
      success: true,
      teamId,
      isCorrect,
      scoreChange,
      newScore,
      wager,
    });
  } catch (error) {
    logger.error('Reveal Final Jeopardy answer failed', error, {
      operation: 'revealFinalJeopardyAnswer',
    });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
