import { type NextRequest, NextResponse } from 'next/server';
import { createAdminServerClient } from '@/lib/admin/auth';
import { logger } from '@/lib/logger';

/**
 * POST /api/games/[gameId]/final-jeopardy/answer
 * Submits a team's answer for Final Jeopardy.
 *
 * Body: { teamId: string, answer: string }
 *
 * Verifies:
 * - Team belongs to game
 * - Game phase is 'final_jeopardy_answer'
 * - Team has submitted a wager
 *
 * Actions:
 * - Updates teams table with answer
 * - Updates wagers table with answer text
 */
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ gameId: string }> }
) {
  try {
    const supabase = await createAdminServerClient();

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
    const { teamId, answer } = body;

    // Validate required fields
    if (!teamId || answer === undefined) {
      return NextResponse.json(
        { error: 'teamId and answer are required' },
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

    // Validate answer is a string
    if (typeof answer !== 'string') {
      return NextResponse.json(
        { error: 'Answer must be a string' },
        { status: 400 }
      );
    }

    // Validate answer length (max 500 characters)
    if (answer.length > 500) {
      return NextResponse.json(
        { error: 'Answer must be 500 characters or less' },
        { status: 400 }
      );
    }

    // Use atomic database function to submit answer (consistent timestamps)
    const { data: result, error: submitError } = await supabase
      .rpc('submit_final_jeopardy_answer', {
        p_game_id: gameId,
        p_team_id: teamId,
        p_answer: answer,
      });

    if (submitError) {
      logger.error('Database error during answer submission', submitError, {
        operation: 'submitFinalJeopardyAnswer',
        gameId,
        teamId,
      });
      return NextResponse.json(
        { error: 'Failed to submit answer' },
        { status: 500 }
      );
    }

    // Validate result
    if (!Array.isArray(result) || result.length === 0) {
      logger.error('Invalid result from submit_final_jeopardy_answer', new Error('Empty result'), {
        operation: 'submitFinalJeopardyAnswer',
        gameId,
        teamId,
        result,
      });
      return NextResponse.json(
        { error: 'Failed to submit answer' },
        { status: 500 }
      );
    }

    const answerResult = result[0];

    // Check if submission was successful
    if (!answerResult.success) {
      return NextResponse.json(
        { error: answerResult.error_message || 'Failed to submit answer' },
        { status: 400 }
      );
    }

    logger.info('Final Jeopardy answer submitted successfully', {
      operation: 'submitFinalJeopardyAnswer',
      gameId,
      teamId,
      answerLength: answer.length,
    });

    return NextResponse.json({
      success: true,
      teamId,
      submittedAt: answerResult.submitted_at,
    });
  } catch (error) {
    logger.error('Submit Final Jeopardy answer failed', error, {
      operation: 'submitFinalJeopardyAnswer',
    });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
