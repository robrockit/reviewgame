import { type NextRequest, NextResponse } from 'next/server';
import { createAdminServerClient } from '@/lib/admin/auth';
import { logger } from '@/lib/logger';

/**
 * POST /api/games/[gameId]/final-jeopardy/reveal-question
 * Teacher reveals the Final Jeopardy question text to students (RG-183).
 *
 * No request body required.
 *
 * Verifies:
 * - User owns the game
 * - Game is in 'final_jeopardy_wager' phase
 *
 * Actions:
 * - Sets games.final_jeopardy_question_revealed = true
 * - Board page subscription detects the change and broadcasts to students
 */
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ gameId: string }> }
) {
  try {
    const supabase = await createAdminServerClient();

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { gameId } = await context.params;

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(gameId)) {
      return NextResponse.json(
        { error: 'Invalid game ID format' },
        { status: 400 }
      );
    }

    // Update the flag — also verifies teacher ownership and phase atomically.
    // Uses teacher_id filter so a non-owner gets 0 rows updated (treated as 404).
    // Type assertion required: final_jeopardy_question_revealed is a new column
    // added by migration 20260402 and not yet reflected in generated database types.
    const { data: updatedRows, error: updateError } = await supabase
      .from('games')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .update({ final_jeopardy_question_revealed: true } as any)
      .eq('id', gameId)
      .eq('teacher_id', user.id)
      .eq('current_phase', 'final_jeopardy_wager')
      .select('id');

    if (updateError) {
      logger.error('Database error revealing FJ question', updateError, {
        operation: 'revealFinalJeopardyQuestion',
        gameId,
        userId: user.id,
      });
      return NextResponse.json(
        { error: 'Failed to reveal question' },
        { status: 500 }
      );
    }

    if (!updatedRows || updatedRows.length === 0) {
      return NextResponse.json(
        { error: 'Game not found or not in wager phase' },
        { status: 404 }
      );
    }

    logger.info('Final Jeopardy question revealed', {
      operation: 'revealFinalJeopardyQuestion',
      gameId,
      userId: user.id,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Reveal Final Jeopardy question failed', error, {
      operation: 'revealFinalJeopardyQuestion',
    });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
