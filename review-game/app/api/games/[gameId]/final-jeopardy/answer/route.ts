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

    // Verify team belongs to game and has submitted wager
    const { data: team, error: teamError } = await supabase
      .from('teams')
      .select('id, game_id, final_jeopardy_wager, team_name')
      .eq('id', teamId)
      .eq('game_id', gameId)
      .single();

    if (teamError || !team) {
      logger.error('Team not found or does not belong to game', teamError, {
        operation: 'submitFinalJeopardyAnswer',
        gameId,
        teamId,
      });
      return NextResponse.json(
        { error: 'Team not found' },
        { status: 404 }
      );
    }

    // Verify game phase
    const { data: game, error: gameError } = await supabase
      .from('games')
      .select('current_phase')
      .eq('id', gameId)
      .single();

    if (gameError || !game) {
      logger.error('Game not found', gameError, {
        operation: 'submitFinalJeopardyAnswer',
        gameId,
      });
      return NextResponse.json(
        { error: 'Game not found' },
        { status: 404 }
      );
    }

    if (game.current_phase !== 'final_jeopardy_answer') {
      return NextResponse.json(
        { error: 'Not in answering phase' },
        { status: 400 }
      );
    }

    // Verify team has submitted wager
    if (team.final_jeopardy_wager === null) {
      return NextResponse.json(
        { error: 'Must submit wager before answering' },
        { status: 400 }
      );
    }

    // Update team with answer
    const { error: updateError } = await supabase
      .from('teams')
      .update({
        final_jeopardy_answer: answer,
        final_jeopardy_submitted_at: new Date().toISOString(),
      })
      .eq('id', teamId);

    if (updateError) {
      logger.error('Failed to update team answer', updateError, {
        operation: 'submitFinalJeopardyAnswer',
        gameId,
        teamId,
      });
      return NextResponse.json(
        { error: 'Failed to submit answer' },
        { status: 500 }
      );
    }

    // Update wager record with answer text
    const { error: wagerUpdateError } = await supabase
      .from('wagers')
      .update({
        answer_text: answer,
      })
      .eq('game_id', gameId)
      .eq('team_id', teamId)
      .eq('wager_type', 'final_jeopardy');

    if (wagerUpdateError) {
      logger.error('Failed to update wager record with answer', wagerUpdateError, {
        operation: 'submitFinalJeopardyAnswer',
        gameId,
        teamId,
      });
      // Non-critical - answer was submitted successfully, continue
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
      submittedAt: new Date().toISOString(),
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
