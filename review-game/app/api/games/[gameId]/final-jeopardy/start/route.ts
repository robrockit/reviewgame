import { type NextRequest, NextResponse } from 'next/server';
import { createAdminServerClient } from '@/lib/admin/auth';
import { logger } from '@/lib/logger';

/**
 * POST /api/games/[gameId]/final-jeopardy/start
 * Initiates Final Jeopardy round for a game.
 *
 * Verifies:
 * - User owns the game
 * - Final Jeopardy question exists
 *
 * Actions:
 * - Sets current_phase to 'final_jeopardy_wager'
 * - Resets teams' Final Jeopardy fields
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

    // Use atomic database function to start Final Jeopardy (prevents inconsistent state)
    const { data: result, error: startError } = await supabase
      .rpc('start_final_jeopardy', {
        p_game_id: gameId,
        p_teacher_id: user.id,
      });

    if (startError) {
      logger.error('Database error during Final Jeopardy start', startError, {
        operation: 'startFinalJeopardy',
        gameId,
        userId: user.id,
      });
      return NextResponse.json(
        { error: 'Failed to start Final Jeopardy' },
        { status: 500 }
      );
    }

    // Validate result
    if (!Array.isArray(result) || result.length === 0) {
      logger.error('Invalid result from start_final_jeopardy', new Error('Empty result'), {
        operation: 'startFinalJeopardy',
        gameId,
        result,
      });
      return NextResponse.json(
        { error: 'Failed to start Final Jeopardy' },
        { status: 500 }
      );
    }

    const startResult = result[0];

    // Check if start was successful
    if (!startResult.success) {
      const statusCode = startResult.error_message === 'Unauthorized' ? 403 : 400;
      return NextResponse.json(
        { error: startResult.error_message || 'Failed to start Final Jeopardy' },
        { status: statusCode }
      );
    }

    // Extract question from result
    const fjQuestion = startResult.question as { category: string; question: string; answer: string };

    logger.info('Final Jeopardy started successfully', {
      operation: 'startFinalJeopardy',
      gameId,
      userId: user.id,
    });

    return NextResponse.json({
      success: true,
      phase: 'final_jeopardy_wager',
      question: fjQuestion,
    });
  } catch (error) {
    logger.error('Start Final Jeopardy failed', error, {
      operation: 'startFinalJeopardy',
    });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
