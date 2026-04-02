import { type NextRequest, NextResponse } from 'next/server';
import { createAdminServerClient, createAdminServiceClient } from '@/lib/admin/auth';
import { logger } from '@/lib/logger';
import { verifyDeviceOwnsTeam, getDeviceIdFromRequest } from '@/lib/auth/device';

/**
 * POST /api/games/[gameId]/final-jeopardy/submit
 * Submits a team's wager AND answer together for Final Jeopardy (RG-183).
 *
 * Body: { teamId: string, wager: number, answer: string }
 *
 * Verifies:
 * - Team belongs to game (device ID ownership check)
 * - Game phase is 'final_jeopardy_wager' (enforced by RPC)
 * - Wager is valid: 0 <= wager <= team.score (enforced by RPC)
 * - Answer is non-empty and <= 500 chars
 *
 * Actions:
 * - Atomically updates teams.final_jeopardy_wager, final_jeopardy_answer, final_jeopardy_submitted_at
 * - Inserts a single wager audit record with both wager_amount and answer_text
 *
 * Security: createAdminServiceClient (service role) is only constructed AFTER
 * device ownership passes, preserving the two-client invariant.
 */
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ gameId: string }> }
) {
  try {
    const supabase = await createAdminServerClient();

    const { gameId } = await context.params;

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(gameId)) {
      return NextResponse.json(
        { error: 'Invalid game ID format' },
        { status: 400 }
      );
    }

    // Parse body
    const body = await req.json();
    const { teamId, wager, answer } = body;

    // Required field checks (pre-auth)
    if (!teamId || wager === undefined || wager === null || answer === undefined) {
      return NextResponse.json(
        { error: 'teamId, wager, and answer are required' },
        { status: 400 }
      );
    }

    if (!uuidRegex.test(teamId)) {
      return NextResponse.json(
        { error: 'Invalid team ID format' },
        { status: 400 }
      );
    }

    // SECURITY: Verify device owns this team before constructing service client
    const deviceId = getDeviceIdFromRequest(req);
    const isAuthorized = await verifyDeviceOwnsTeam(supabase, teamId, deviceId, gameId);

    if (!isAuthorized) {
      logger.warn('Unauthorized FJ submission attempt', {
        operation: 'submitFinalJeopardy',
        gameId,
        teamId,
        deviceId,
      });
      return NextResponse.json(
        { error: 'Unauthorized: This device does not control this team' },
        { status: 403 }
      );
    }

    // Post-auth type/range validation
    if (typeof wager !== 'number' || !Number.isInteger(wager)) {
      return NextResponse.json(
        { error: 'Wager must be an integer' },
        { status: 400 }
      );
    }

    if (wager < 0) {
      return NextResponse.json(
        { error: 'Wager cannot be negative' },
        { status: 400 }
      );
    }

    if (typeof answer !== 'string') {
      return NextResponse.json(
        { error: 'Answer must be a string' },
        { status: 400 }
      );
    }

    if (answer.length > 500) {
      return NextResponse.json(
        { error: 'Answer must be 500 characters or less' },
        { status: 400 }
      );
    }

    // Service role required: students are anonymous so anon key lacks EXECUTE
    // on submit_final_jeopardy. Constructed after auth to honour the two-client invariant.
    //
    // Type assertions below: submit_final_jeopardy is a new RPC added by migration
    // 20260402 and is not yet reflected in the generated database types.
    const serviceSupabase = createAdminServiceClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: result, error: submitError } = await (serviceSupabase as any)
      .rpc('submit_final_jeopardy', {
        p_game_id: gameId,
        p_team_id: teamId,
        p_wager: wager,
        p_answer: answer,
      });

    if (submitError) {
      logger.error('Database error during FJ submission', submitError, {
        operation: 'submitFinalJeopardy',
        gameId,
        teamId,
      });
      return NextResponse.json(
        { error: 'Failed to submit' },
        { status: 500 }
      );
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const resultRows = result as any[];

    if (!Array.isArray(resultRows) || resultRows.length === 0) {
      logger.error('Invalid result from submit_final_jeopardy', new Error('Empty result'), {
        operation: 'submitFinalJeopardy',
        gameId,
        teamId,
        result,
      });
      return NextResponse.json(
        { error: 'Failed to submit' },
        { status: 500 }
      );
    }

    const submitResult = resultRows[0];

    if (!submitResult.success) {
      return NextResponse.json(
        { error: (submitResult.error_message as string) || 'Failed to submit' },
        { status: 400 }
      );
    }

    logger.info('Final Jeopardy submission successful', {
      operation: 'submitFinalJeopardy',
      gameId,
      teamId,
      wager,
      answerLength: answer.length,
    });

    return NextResponse.json({
      success: true,
      teamId,
      wager,
      submittedAt: submitResult.submitted_at as string,
    });
  } catch (error) {
    logger.error('Submit Final Jeopardy failed', error, {
      operation: 'submitFinalJeopardy',
    });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
