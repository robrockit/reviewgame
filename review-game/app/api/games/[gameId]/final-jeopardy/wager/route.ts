import { type NextRequest, NextResponse } from 'next/server';
import { createAdminServerClient } from '@/lib/admin/auth';
import { logger } from '@/lib/logger';

/**
 * POST /api/games/[gameId]/final-jeopardy/wager
 * Submits a team's wager for Final Jeopardy.
 *
 * Body: { teamId: string, wager: number }
 *
 * Verifies:
 * - Team belongs to game
 * - Game phase is 'final_jeopardy_wager'
 * - Wager is valid (0 <= wager <= max(team.score, 0))
 *
 * Actions:
 * - Updates teams table with wager and submission timestamp
 * - Creates wager record for audit trail
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
    const { teamId, wager } = body;

    // Validate required fields
    if (!teamId || wager === undefined || wager === null) {
      return NextResponse.json(
        { error: 'teamId and wager are required' },
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

    // Validate wager is a number
    if (typeof wager !== 'number' || !Number.isInteger(wager)) {
      return NextResponse.json(
        { error: 'Wager must be an integer' },
        { status: 400 }
      );
    }

    // Basic validation: wager must be non-negative (detailed validation in DB function)
    if (wager < 0) {
      return NextResponse.json(
        { error: 'Wager cannot be negative' },
        { status: 400 }
      );
    }

    // Use atomic database function to submit wager (prevents race conditions)
    const { data: result, error: submitError } = await supabase
      .rpc('submit_final_jeopardy_wager', {
        p_game_id: gameId,
        p_team_id: teamId,
        p_wager: wager,
      });

    if (submitError) {
      logger.error('Database error during wager submission', submitError, {
        operation: 'submitFinalJeopardyWager',
        gameId,
        teamId,
        wager,
      });
      return NextResponse.json(
        { error: 'Failed to submit wager' },
        { status: 500 }
      );
    }

    // Validate result
    if (!Array.isArray(result) || result.length === 0) {
      logger.error('Invalid result from submit_final_jeopardy_wager', new Error('Empty result'), {
        operation: 'submitFinalJeopardyWager',
        gameId,
        teamId,
        result,
      });
      return NextResponse.json(
        { error: 'Failed to submit wager' },
        { status: 500 }
      );
    }

    const wagerResult = result[0];

    // Check if submission was successful
    if (!wagerResult.success) {
      return NextResponse.json(
        { error: wagerResult.error_message || 'Failed to submit wager' },
        { status: 400 }
      );
    }

    // Note: Wager audit record is created atomically within the database function

    logger.info('Final Jeopardy wager submitted successfully', {
      operation: 'submitFinalJeopardyWager',
      gameId,
      teamId,
      wager,
    });

    return NextResponse.json({
      success: true,
      teamId,
      wager,
      submittedAt: wagerResult.submitted_at,
    });
  } catch (error) {
    logger.error('Submit Final Jeopardy wager failed', error, {
      operation: 'submitFinalJeopardyWager',
    });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
