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

    // Fetch game and verify ownership
    const { data: game, error: gameError } = await supabase
      .from('games')
      .select('id, teacher_id, current_phase')
      .eq('id', gameId)
      .eq('teacher_id', user.id)
      .single();

    if (gameError || !game) {
      logger.error('Game not found or access denied', gameError, {
        operation: 'revealFinalJeopardyAnswer',
        gameId,
        userId: user.id,
      });
      return NextResponse.json(
        { error: 'Game not found' },
        { status: 404 }
      );
    }

    // Verify game phase
    if (game.current_phase !== 'final_jeopardy_reveal') {
      return NextResponse.json(
        { error: 'Not in reveal phase' },
        { status: 400 }
      );
    }

    // Verify team belongs to game and has wager/answer
    const { data: team, error: teamError } = await supabase
      .from('teams')
      .select('id, game_id, score, final_jeopardy_wager, final_jeopardy_answer, team_name')
      .eq('id', teamId)
      .eq('game_id', gameId)
      .single();

    if (teamError || !team) {
      logger.error('Team not found or does not belong to game', teamError, {
        operation: 'revealFinalJeopardyAnswer',
        gameId,
        teamId,
      });
      return NextResponse.json(
        { error: 'Team not found' },
        { status: 404 }
      );
    }

    // Verify team has submitted wager and answer
    if (team.final_jeopardy_wager === null) {
      return NextResponse.json(
        { error: 'Team has not submitted a wager' },
        { status: 400 }
      );
    }

    if (team.final_jeopardy_answer === null) {
      return NextResponse.json(
        { error: 'Team has not submitted an answer' },
        { status: 400 }
      );
    }

    // Calculate score change
    const wager = team.final_jeopardy_wager;
    const scoreChange = isCorrect ? wager : -wager;

    // Update team score using the database function
    const { data: scoreData, error: scoreError } = await supabase
      .rpc('update_team_score', {
        p_game_id: gameId,
        p_team_id: teamId,
        p_score_change: scoreChange,
      });

    if (scoreError) {
      logger.error('Database error during score update', scoreError, {
        operation: 'revealFinalJeopardyAnswer',
        gameId,
        teamId,
        scoreChange,
      });
      return NextResponse.json(
        { error: 'Failed to update score' },
        { status: 500 }
      );
    }

    // Validate the RPC response structure
    if (!Array.isArray(scoreData)) {
      logger.error('Invalid response from update_team_score - not an array', new Error('Type error'), {
        operation: 'revealFinalJeopardyAnswer',
        gameId,
        teamId,
        scoreDataType: typeof scoreData,
      });
      return NextResponse.json(
        { error: 'Failed to update score - invalid response' },
        { status: 500 }
      );
    }

    if (scoreData.length === 0) {
      logger.error('Empty response from update_team_score', new Error('Empty array'), {
        operation: 'revealFinalJeopardyAnswer',
        gameId,
        teamId,
      });
      return NextResponse.json(
        { error: 'Failed to update score - no result' },
        { status: 500 }
      );
    }

    const result = scoreData[0];

    // Validate result object structure
    if (!result || typeof result !== 'object') {
      logger.error('Invalid result object from update_team_score', new Error('Invalid object'), {
        operation: 'revealFinalJeopardyAnswer',
        gameId,
        teamId,
        result,
      });
      return NextResponse.json(
        { error: 'Failed to update score - invalid result' },
        { status: 500 }
      );
    }

    // Check if the operation was successful
    if (!result.success) {
      logger.error('Score update failed - function returned error', new Error(result.error_message || 'Unknown error'), {
        operation: 'revealFinalJeopardyAnswer',
        gameId,
        teamId,
        errorMessage: result.error_message,
      });
      return NextResponse.json(
        { error: result.error_message || 'Failed to update score' },
        { status: 400 }
      );
    }

    // Validate new_score field
    if (typeof result.new_score !== 'number') {
      logger.error('Invalid new_score in result', new Error('Type error'), {
        operation: 'revealFinalJeopardyAnswer',
        gameId,
        teamId,
        newScore: result.new_score,
        newScoreType: typeof result.new_score,
      });
      return NextResponse.json(
        { error: 'Failed to update score - invalid new score' },
        { status: 500 }
      );
    }

    const newScore = result.new_score;

    // Update wager record with correctness and revealed flag
    const { error: wagerUpdateError } = await supabase
      .from('wagers')
      .update({
        is_correct: isCorrect,
        revealed: true,
      })
      .eq('game_id', gameId)
      .eq('team_id', teamId)
      .eq('wager_type', 'final_jeopardy');

    if (wagerUpdateError) {
      logger.error('Failed to update wager record', wagerUpdateError, {
        operation: 'revealFinalJeopardyAnswer',
        gameId,
        teamId,
      });
      // Non-critical - score was updated successfully, continue
    }

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
