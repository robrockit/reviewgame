import { type NextRequest, NextResponse } from 'next/server';
import { createAdminServerClient } from '@/lib/admin/auth';
import { logger } from '@/lib/logger';

/**
 * POST /api/games/[gameId]/final-jeopardy/skip
 * Skips Final Jeopardy and returns to regular gameplay.
 *
 * Verifies:
 * - User owns the game
 *
 * Actions:
 * - Resets current_phase to 'regular'
 * - Clears teams' Final Jeopardy fields
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

    // Use atomic database function to skip Final Jeopardy (includes cleanup)
    const { data: result, error: skipError } = await supabase
      .rpc('skip_final_jeopardy', {
        p_game_id: gameId,
        p_teacher_id: user.id,
      });

    if (skipError) {
      logger.error('Database error during Final Jeopardy skip', skipError, {
        operation: 'skipFinalJeopardy',
        gameId,
        userId: user.id,
      });
      return NextResponse.json(
        { error: 'Failed to skip Final Jeopardy' },
        { status: 500 }
      );
    }

    // Validate result
    if (!Array.isArray(result) || result.length === 0) {
      logger.error('Invalid result from skip_final_jeopardy', new Error('Empty result'), {
        operation: 'skipFinalJeopardy',
        gameId,
        result,
      });
      return NextResponse.json(
        { error: 'Failed to skip Final Jeopardy' },
        { status: 500 }
      );
    }

    const skipResult = result[0];

    // Check if skip was successful
    if (!skipResult.success) {
      const statusCode = skipResult.error_message === 'Unauthorized' ? 403 : 400;
      return NextResponse.json(
        { error: skipResult.error_message || 'Failed to skip Final Jeopardy' },
        { status: statusCode }
      );
    }

    logger.info('Final Jeopardy skipped successfully', {
      operation: 'skipFinalJeopardy',
      gameId,
      userId: user.id,
    });

    return NextResponse.json({
      success: true,
      phase: 'regular',
    });
  } catch (error) {
    logger.error('Skip Final Jeopardy failed', error, {
      operation: 'skipFinalJeopardy',
    });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
