import { type NextRequest, NextResponse } from 'next/server';
import { createAdminServerClient } from '@/lib/admin/auth';
import { logger } from '@/lib/logger';
import { SCORE_OVERRIDE_MAX_DELTA } from '@/types/game.types';
import type { ScoreOverrideRequest, ScoreOverrideResponse } from '@/types/game.types';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * POST /api/games/[gameId]/teacher-score
 *
 * Manually award or deduct points for a team during a live Jeopardy game.
 * Intended for classrooms where students answer verbally and the teacher
 * needs to update scores without a student device.
 *
 * Body: { teamId: string, delta: number }  (delta = signed point change)
 *
 * Auth: teacher must own the game (verified inside update_team_score RPC via auth.uid()).
 */
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ gameId: string }> }
) {
  try {
    const supabase = await createAdminServerClient();

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { gameId } = await context.params;

    if (!UUID_RE.test(gameId)) {
      return NextResponse.json({ error: 'Invalid game ID format' }, { status: 400 });
    }

    const body = (await req.json()) as Partial<ScoreOverrideRequest>;
    const { teamId, delta } = body;

    if (!teamId || delta === undefined || delta === null) {
      return NextResponse.json(
        { error: 'teamId and delta are required' },
        { status: 400 }
      );
    }

    if (!UUID_RE.test(teamId)) {
      return NextResponse.json({ error: 'Invalid team ID format' }, { status: 400 });
    }

    if (!Number.isInteger(delta) || delta === 0) {
      return NextResponse.json(
        { error: 'delta must be a non-zero integer' },
        { status: 400 }
      );
    }

    if (delta < -SCORE_OVERRIDE_MAX_DELTA || delta > SCORE_OVERRIDE_MAX_DELTA) {
      return NextResponse.json(
        { error: `delta must be between -${SCORE_OVERRIDE_MAX_DELTA} and ${SCORE_OVERRIDE_MAX_DELTA}` },
        { status: 400 }
      );
    }

    const { data: result, error: rpcError } = await supabase.rpc('update_team_score', {
      p_team_id: teamId,
      p_score_change: delta,
      p_game_id: gameId,
    });

    if (rpcError) {
      logger.error('RPC error during teacher score override', rpcError, {
        operation: 'teacherScoreOverride',
        gameId,
        teamId,
        delta,
      });
      return NextResponse.json({ error: 'Failed to update score' }, { status: 500 });
    }

    if (!Array.isArray(result) || result.length === 0) {
      logger.error('Empty result from update_team_score', new Error('Empty result'), {
        operation: 'teacherScoreOverride',
        gameId,
        teamId,
        delta,
      });
      return NextResponse.json({ error: 'Failed to update score' }, { status: 500 });
    }

    const row = result[0] as { team_id: string; new_score: number; success: boolean; error_message: string | null };

    if (!row.success) {
      const msg = row.error_message ?? 'Failed to update score';
      const status =
        msg === 'Unauthorized' ? 403 :
        msg === 'Game not found' || msg === 'Team not found' ? 404 : 400;
      logger.warn('update_team_score returned failure', {
        operation: 'teacherScoreOverride',
        gameId,
        teamId,
        delta,
        errorMessage: msg,
      });
      return NextResponse.json({ error: msg }, { status });
    }

    logger.info('Teacher score override applied', {
      operation: 'teacherScoreOverride',
      gameId,
      teamId,
      delta,
      newScore: row.new_score,
    });

    const response: ScoreOverrideResponse = {
      success: true,
      teamId,
      delta,
      newScore: row.new_score,
    };

    return NextResponse.json(response);
  } catch (error) {
    logger.error('Unexpected error during teacher score override', error, {
      operation: 'teacherScoreOverride',
    });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
