import { type NextRequest, NextResponse } from 'next/server';
import { createAdminServerClient } from '@/lib/admin/auth';
import { logger } from '@/lib/logger';
import type { GamePhase } from '@/types/game';

/**
 * POST /api/games/[gameId]/final-jeopardy/advance
 * Advances the game to the next Final Jeopardy phase.
 *
 * Phase transitions:
 * - wager → answer
 * - answer → reveal
 * - reveal → regular (and set status to 'completed')
 *
 * Verifies:
 * - User owns the game
 * - Game is in a valid Final Jeopardy phase
 *
 * Actions:
 * - Updates current_phase to next phase
 * - If completing (reveal → regular), also sets status to 'completed'
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

    // Fetch game and verify ownership
    const { data: game, error: fetchError } = await supabase
      .from('games')
      .select('id, teacher_id, current_phase, status')
      .eq('id', gameId)
      .eq('teacher_id', user.id)
      .single();

    if (fetchError || !game) {
      logger.error('Game not found or access denied', fetchError, {
        operation: 'advanceFinalJeopardyPhase',
        gameId,
        userId: user.id,
      });
      return NextResponse.json(
        { error: 'Game not found' },
        { status: 404 }
      );
    }

    // Determine next phase based on current phase
    const currentPhase = game.current_phase as GamePhase;
    let nextPhase: GamePhase;
    let shouldComplete = false;

    switch (currentPhase) {
      case 'final_jeopardy_wager':
        nextPhase = 'final_jeopardy_answer';
        break;
      case 'final_jeopardy_answer':
        nextPhase = 'final_jeopardy_reveal';
        break;
      case 'final_jeopardy_reveal':
        nextPhase = 'regular';
        shouldComplete = true;
        break;
      default:
        return NextResponse.json(
          { error: 'Not in a Final Jeopardy phase' },
          { status: 400 }
        );
    }

    // Update game phase (and status if completing)
    const updates: {
      current_phase: GamePhase;
      status?: string;
      completed_at?: string;
    } = {
      current_phase: nextPhase,
    };

    if (shouldComplete) {
      updates.status = 'completed';
      updates.completed_at = new Date().toISOString();
    }

    const { error: updateError } = await supabase
      .from('games')
      .update(updates)
      .eq('id', gameId);

    if (updateError) {
      logger.error('Failed to advance Final Jeopardy phase', updateError, {
        operation: 'advanceFinalJeopardyPhase',
        gameId,
        userId: user.id,
        currentPhase,
        nextPhase,
      });
      return NextResponse.json(
        { error: 'Failed to advance phase' },
        { status: 500 }
      );
    }

    logger.info('Final Jeopardy phase advanced successfully', {
      operation: 'advanceFinalJeopardyPhase',
      gameId,
      userId: user.id,
      from: currentPhase,
      to: nextPhase,
      completed: shouldComplete,
    });

    return NextResponse.json({
      success: true,
      previousPhase: currentPhase,
      currentPhase: nextPhase,
      completed: shouldComplete,
    });
  } catch (error) {
    logger.error('Advance Final Jeopardy phase failed', error, {
      operation: 'advanceFinalJeopardyPhase',
    });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
