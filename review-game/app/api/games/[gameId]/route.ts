import { type NextRequest, NextResponse } from 'next/server';
import { createAdminServerClient } from '@/lib/admin/auth';
import type { TablesUpdate } from '@/types/database.types';
import { logger } from '@/lib/logger';

/**
 * DELETE /api/games/[gameId]
 * Deletes a game and decrements games_created_count for FREE tier users.
 *
 * Verifies user owns the game before deletion.
 * Related teams records are deleted via CASCADE foreign key constraint.
 */
export async function DELETE(
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

    // Check if game exists and user owns it (RLS-protected query)
    // Using eq('teacher_id', user.id) leverages RLS policies for defense in depth
    const { data: game, error: fetchError } = await supabase
      .from('games')
      .select('id, teacher_id')
      .eq('id', gameId)
      .eq('teacher_id', user.id) // RLS enforcement
      .single();

    if (fetchError || !game) {
      logger.error('Game not found or access denied', fetchError, {
        operation: 'deleteGame',
        gameId,
        userId: user.id,
      });
      // Use 404 instead of 403 to avoid leaking game existence
      return NextResponse.json(
        { error: 'Game not found' },
        { status: 404 }
      );
    }

    // Delete the game (teams will cascade delete)
    const { error: deleteError } = await supabase
      .from('games')
      .delete()
      .eq('id', gameId);

    if (deleteError) {
      logger.error('Failed to delete game', deleteError, {
        operation: 'deleteGame',
        gameId,
        userId: user.id,
      });
      return NextResponse.json(
        { error: 'Failed to delete game' },
        { status: 500 }
      );
    }

    // Decrement games_created_count for FREE tier users
    await supabase.rpc('decrement_game_count', { p_user_id: user.id });

    logger.info('Game deleted successfully', {
      operation: 'deleteGame',
      gameId,
      userId: user.id,
    });

    // Return 204 No Content
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    logger.error('Game deletion failed', error, {
      operation: 'deleteGame',
    });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/games/[gameId]
 * Updates game settings.
 *
 * Allows editing:
 * - team_names
 * - timer_enabled
 * - timer_seconds
 *
 * Prevents editing bank_id if game has started.
 */
export async function PATCH(
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
    const {
      team_names,
      timer_enabled,
      timer_seconds,
      bank_id,
    } = body;

    // Check if game exists and user owns it (RLS-protected query)
    // Using eq('teacher_id', user.id) leverages RLS policies for defense in depth
    const { data: game, error: fetchError } = await supabase
      .from('games')
      .select('id, teacher_id, status, started_at')
      .eq('id', gameId)
      .eq('teacher_id', user.id) // RLS enforcement
      .single();

    if (fetchError || !game) {
      logger.error('Game not found or access denied', fetchError, {
        operation: 'updateGame',
        gameId,
        userId: user.id,
      });
      // Use 404 instead of 403 to avoid leaking game existence
      return NextResponse.json(
        { error: 'Game not found' },
        { status: 404 }
      );
    }

    // Prevent editing bank_id if game has started
    if (bank_id && game.started_at) {
      return NextResponse.json(
        { error: 'Cannot change question bank after game has started' },
        { status: 400 }
      );
    }

    // Build update object with only allowed fields
    const updates: TablesUpdate<'games'> = {};

    if (team_names !== undefined) {
      updates.team_names = team_names;
    }

    if (timer_enabled !== undefined) {
      updates.timer_enabled = timer_enabled;
      // If timer is disabled, set timer_seconds to null
      if (!timer_enabled) {
        updates.timer_seconds = null;
      }
    }

    if (timer_seconds !== undefined && timer_enabled !== false) {
      updates.timer_seconds = timer_seconds;
    }

    // Only allow bank_id update if game hasn't started
    if (bank_id && !game.started_at) {
      updates.bank_id = bank_id;
    }

    // Check if there are any updates to apply
    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: 'No valid fields to update' },
        { status: 400 }
      );
    }

    // Update the game
    const { data: updatedGame, error: updateError } = await supabase
      .from('games')
      .update(updates)
      .eq('id', gameId)
      .select()
      .single();

    if (updateError) {
      logger.error('Failed to update game', updateError, {
        operation: 'updateGame',
        gameId,
        userId: user.id,
      });
      return NextResponse.json(
        { error: 'Failed to update game' },
        { status: 500 }
      );
    }

    logger.info('Game updated successfully', {
      operation: 'updateGame',
      gameId,
      userId: user.id,
      updates: Object.keys(updates),
    });

    // Return updated game
    return NextResponse.json(updatedGame);
  } catch (error) {
    logger.error('Game update failed', error, {
      operation: 'updateGame',
    });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
