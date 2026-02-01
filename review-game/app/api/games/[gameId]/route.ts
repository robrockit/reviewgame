import { type NextRequest, NextResponse } from 'next/server';
import { createAdminServerClient } from '@/lib/admin/auth';
import type { TablesUpdate } from '@/types/database.types';
import { logger } from '@/lib/logger';
import { getMaxTeams, canAccessCustomTeamNames } from '@/lib/utils/feature-access';
import { GAME_BOARD } from '@/lib/constants/game';

/**
 * GET /api/games/[gameId]
 * Fetches a single game by ID with question bank information.
 *
 * Verifies user owns the game before returning data.
 */
export async function GET(
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

    // Fetch game with question bank info (RLS-protected query)
    const { data: game, error: fetchError } = await supabase
      .from('games')
      .select(`
        *,
        question_banks (
          id,
          title,
          subject
        )
      `)
      .eq('id', gameId)
      .eq('teacher_id', user.id)
      .single();

    if (fetchError || !game) {
      logger.error('Game not found or access denied', fetchError, {
        operation: 'getGame',
        gameId,
        userId: user.id,
      });
      return NextResponse.json(
        { error: 'Game not found' },
        { status: 404 }
      );
    }

    // Flatten the response to include bank info at top level
    const formattedGame = {
      ...game,
      bank_title: game.question_banks?.title || 'Unknown',
      bank_subject: game.question_banks?.subject || 'Unknown',
    };

    logger.info('Game fetched successfully', {
      operation: 'getGame',
      gameId,
      userId: user.id,
    });

    return NextResponse.json(formattedGame);
  } catch (error) {
    logger.error('Game fetch failed', error, {
      operation: 'getGame',
    });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

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
 * - bank_id (only if game hasn't started)
 * - num_teams (creates/removes team records as needed)
 * - team_names
 * - timer_enabled
 * - timer_seconds
 * - daily_double_positions
 * - final_jeopardy_question
 *
 * Validates all inputs and handles team record synchronization.
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
      num_teams,
      daily_double_positions,
      final_jeopardy_question,
    } = body;

    // Check if game exists and user owns it (RLS-protected query)
    // Using eq('teacher_id', user.id) leverages RLS policies for defense in depth
    const { data: game, error: fetchError } = await supabase
      .from('games')
      .select('id, teacher_id, status, started_at, num_teams')
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

    // Fetch user profile for subscription-based validation
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      logger.error('User profile not found', profileError, {
        operation: 'updateGame',
        userId: user.id,
        gameId,
      });
      return NextResponse.json(
        { error: 'User profile not found' },
        { status: 500 }
      );
    }

    // Prevent editing bank_id if game has started
    if (bank_id && game.started_at) {
      return NextResponse.json(
        { error: 'Cannot change question bank after game has started' },
        { status: 400 }
      );
    }

    // Validate bank_id foreign key and user access
    if (bank_id && !game.started_at) {
      // Validate UUID format
      if (!uuidRegex.test(bank_id)) {
        return NextResponse.json(
          { error: 'Invalid question bank ID format' },
          { status: 400 }
        );
      }

      // Verify bank exists and user has access
      const { data: bank, error: bankError } = await supabase
        .from('question_banks')
        .select('id, is_public, owner_id')
        .eq('id', bank_id)
        .single();

      if (bankError || !bank) {
        return NextResponse.json(
          { error: 'Question bank not found' },
          { status: 404 }
        );
      }

      // Verify user has access (public or owned by user)
      if (!bank.is_public && bank.owner_id !== user.id) {
        return NextResponse.json(
          { error: 'You do not have access to this question bank' },
          { status: 403 }
        );
      }
    }

    // Validate num_teams against subscription limits
    if (num_teams !== undefined) {
      if (typeof num_teams !== 'number' || num_teams < 2) {
        return NextResponse.json(
          { error: 'num_teams must be a number greater than or equal to 2' },
          { status: 400 }
        );
      }

      // Use centralized utility to get max teams
      const maxTeams = getMaxTeams(profile);

      if (num_teams > maxTeams) {
        return NextResponse.json(
          { error: `Your subscription allows a maximum of ${maxTeams} teams. Upgrade to increase this limit.` },
          { status: 403 }
        );
      }
    }

    // Validate daily_double_positions if provided
    if (daily_double_positions !== undefined) {
      if (!Array.isArray(daily_double_positions) || daily_double_positions.length !== GAME_BOARD.DAILY_DOUBLE_COUNT) {
        return NextResponse.json(
          { error: `daily_double_positions must be an array of ${GAME_BOARD.DAILY_DOUBLE_COUNT} numbers` },
          { status: 400 }
        );
      }

      // Determine which bank to validate against
      const effectiveBankId = bank_id || game.bank_id;

      // Fetch question count from the bank
      const { count: questionCount, error: countError } = await supabase
        .from('questions')
        .select('*', { count: 'exact', head: true })
        .eq('bank_id', effectiveBankId);

      if (countError) {
        logger.error('Failed to count questions in bank', countError, {
          operation: 'updateGame',
          gameId,
          bankId: effectiveBankId,
        });
        return NextResponse.json(
          { error: 'Failed to validate daily double positions' },
          { status: 500 }
        );
      }

      // Validate positions against actual question count
      const maxPosition = (questionCount || GAME_BOARD.TOTAL_QUESTIONS) - 1;
      for (const pos of daily_double_positions) {
        if (typeof pos !== 'number' || pos < 0 || pos > maxPosition) {
          return NextResponse.json(
            { error: `daily_double_positions must contain numbers between 0 and ${maxPosition} (bank has ${questionCount || GAME_BOARD.TOTAL_QUESTIONS} questions)` },
            { status: 400 }
          );
        }
      }

      if (daily_double_positions[0] === daily_double_positions[1]) {
        return NextResponse.json(
          { error: 'daily_double_positions must be unique' },
          { status: 400 }
        );
      }
    }

    // Validate final_jeopardy_question if provided
    if (final_jeopardy_question !== undefined && final_jeopardy_question !== null) {
      if (typeof final_jeopardy_question !== 'object') {
        return NextResponse.json(
          { error: 'final_jeopardy_question must be an object' },
          { status: 400 }
        );
      }
      const { category, question, answer } = final_jeopardy_question;

      // Validate category
      if (typeof category !== 'string' || category.length === 0 || category.length > 100) {
        return NextResponse.json(
          { error: 'final_jeopardy_question.category must be a string (1-100 chars)' },
          { status: 400 }
        );
      }
      // XSS prevention for category
      const allowedCharsPattern = /^[\w\s\-'.,!?@()\[\]]+$/;
      if (!allowedCharsPattern.test(category)) {
        return NextResponse.json(
          { error: 'final_jeopardy_question.category contains invalid characters' },
          { status: 400 }
        );
      }

      // Validate question
      if (typeof question !== 'string' || question.length === 0 || question.length > 500) {
        return NextResponse.json(
          { error: 'final_jeopardy_question.question must be a string (1-500 chars)' },
          { status: 400 }
        );
      }
      // XSS prevention for question - allow broader set for question text
      const questionAllowedChars = /^[\w\s\-'.,!?@()\[\]:;"\/]+$/;
      if (!questionAllowedChars.test(question)) {
        return NextResponse.json(
          { error: 'final_jeopardy_question.question contains invalid characters' },
          { status: 400 }
        );
      }

      // Validate answer
      if (typeof answer !== 'string' || answer.length === 0 || answer.length > 200) {
        return NextResponse.json(
          { error: 'final_jeopardy_question.answer must be a string (1-200 chars)' },
          { status: 400 }
        );
      }
      // XSS prevention for answer
      if (!allowedCharsPattern.test(answer)) {
        return NextResponse.json(
          { error: 'final_jeopardy_question.answer contains invalid characters' },
          { status: 400 }
        );
      }
    }

    // Validate team_names input sanitization and premium access
    if (team_names !== undefined) {
      // Validate team_names is an array
      if (!Array.isArray(team_names)) {
        return NextResponse.json(
          { error: 'team_names must be an array' },
          { status: 400 }
        );
      }

      // Validate each team name
      for (let i = 0; i < team_names.length; i++) {
        const name = team_names[i];

        if (typeof name !== 'string') {
          return NextResponse.json(
            { error: 'All team names must be strings' },
            { status: 400 }
          );
        }

        if (name.length === 0 || name.length > 50) {
          return NextResponse.json(
            { error: 'Team names must be between 1 and 50 characters' },
            { status: 400 }
          );
        }

        // XSS prevention using character whitelist
        // Allow: letters, numbers, spaces, and safe punctuation only
        // Whitelist approach is more secure than blacklist
        // Excludes & and # to prevent HTML entity encoding attacks (&lt;, &#60;, etc.)
        const allowedCharsPattern = /^[\w\s\-'.,!?@()\[\]]+$/;
        if (!allowedCharsPattern.test(name)) {
          return NextResponse.json(
            { error: 'Team names can only contain letters, numbers, spaces, and common punctuation (- _ \' . , ! ? @ ( ) [ ])' },
            { status: 400 }
          );
        }
      }

      // Check if custom team names are being used (premium feature)
      const hasCustomNames = team_names.some((name, i) => name !== `Team ${i + 1}`);
      if (hasCustomNames && !canAccessCustomTeamNames(profile)) {
        return NextResponse.json(
          { error: 'Custom team names require BASIC or PREMIUM subscription' },
          { status: 403 }
        );
      }

      // Validate length matches num_teams if both provided
      if (num_teams !== undefined && team_names.length !== num_teams) {
        return NextResponse.json(
          { error: 'team_names length must match num_teams' },
          { status: 400 }
        );
      }
    }

    // Handle team synchronization BEFORE updating game to prevent race conditions
    // If team sync fails, game record remains unchanged (atomic operation)
    if (num_teams !== undefined && num_teams !== game.num_teams) {
      const oldNumTeams = game.num_teams || 0;

      if (num_teams > oldNumTeams) {
        // Add new team records with correct names from team_names array
        const newTeamRecords = Array.from(
          { length: num_teams - oldNumTeams },
          (_, i) => ({
            game_id: gameId,
            team_number: oldNumTeams + i + 1,
            team_name: team_names?.[oldNumTeams + i] || `Team ${oldNumTeams + i + 1}`,
            score: 0,
            connection_status: 'pending' as const,
          })
        );

        const { error: teamsError } = await supabase
          .from('teams')
          .insert(newTeamRecords);

        if (teamsError) {
          logger.error('Failed to add new team records', teamsError, {
            operation: 'updateGame',
            gameId,
            userId: user.id,
            newTeamsCount: newTeamRecords.length,
          });
          return NextResponse.json(
            { error: 'Failed to create new teams. Please try again.' },
            { status: 500 }
          );
        }

        // Update existing team names if team_names provided
        // (new teams already have correct names from insertion above)
        if (team_names && Array.isArray(team_names) && oldNumTeams > 0) {
          const updatePromises = [];

          for (let i = 0; i < oldNumTeams; i++) {
            if (team_names[i]) {
              updatePromises.push(
                supabase
                  .from('teams')
                  .update({ team_name: team_names[i] })
                  .eq('game_id', gameId)
                  .eq('team_number', i + 1)
              );
            }
          }

          if (updatePromises.length > 0) {
            const results = await Promise.allSettled(updatePromises);
            const failures = results.filter(r => r.status === 'rejected');

            if (failures.length > 0) {
              logger.error('Failed to update existing team names', new Error('Batch update failed'), {
                operation: 'updateGame',
                gameId,
                userId: user.id,
                failureCount: failures.length,
                totalUpdates: updatePromises.length,
              });
              return NextResponse.json(
                { error: 'Failed to update team names. Please try again.' },
                { status: 500 }
              );
            }
          }
        }
      } else if (num_teams < oldNumTeams) {
        // Remove excess team records
        const { error: teamsError } = await supabase
          .from('teams')
          .delete()
          .eq('game_id', gameId)
          .gt('team_number', num_teams);

        if (teamsError) {
          logger.error('Failed to remove excess team records', teamsError, {
            operation: 'updateGame',
            gameId,
            userId: user.id,
            teamsToRemove: oldNumTeams - num_teams,
          });
          return NextResponse.json(
            { error: 'Failed to remove teams. Please try again.' },
            { status: 500 }
          );
        }

        // Update remaining team names if team_names provided
        if (team_names && Array.isArray(team_names)) {
          const updatePromises = [];

          for (let i = 0; i < Math.min(num_teams, team_names.length); i++) {
            if (team_names[i]) {
              updatePromises.push(
                supabase
                  .from('teams')
                  .update({ team_name: team_names[i] })
                  .eq('game_id', gameId)
                  .eq('team_number', i + 1)
              );
            }
          }

          if (updatePromises.length > 0) {
            const results = await Promise.allSettled(updatePromises);
            const failures = results.filter(r => r.status === 'rejected');

            if (failures.length > 0) {
              logger.error('Failed to update team names after deletion', new Error('Batch update failed'), {
                operation: 'updateGame',
                gameId,
                userId: user.id,
                failureCount: failures.length,
                totalUpdates: updatePromises.length,
              });
              return NextResponse.json(
                { error: 'Failed to update team names. Please try again.' },
                { status: 500 }
              );
            }
          }
        }
      }
    } else if (team_names && Array.isArray(team_names)) {
      // num_teams didn't change, but team_names provided - update names only
      const effectiveNumTeams = num_teams !== undefined ? num_teams : game.num_teams || 0;
      const updatePromises = [];

      for (let i = 0; i < Math.min(effectiveNumTeams, team_names.length); i++) {
        if (team_names[i]) {
          updatePromises.push(
            supabase
              .from('teams')
              .update({ team_name: team_names[i] })
              .eq('game_id', gameId)
              .eq('team_number', i + 1)
          );
        }
      }

      if (updatePromises.length > 0) {
        const results = await Promise.allSettled(updatePromises);
        const failures = results.filter(r => r.status === 'rejected');

        if (failures.length > 0) {
          logger.error('Failed to update team names', new Error('Batch update failed'), {
            operation: 'updateGame',
            gameId,
            userId: user.id,
            failureCount: failures.length,
            totalUpdates: updatePromises.length,
          });
          return NextResponse.json(
            { error: 'Failed to update team names. Please try again.' },
            { status: 500 }
          );
        }
      }
    }

    // Build updates object for game record
    const updates: TablesUpdate<'games'> = {};

    if (team_names !== undefined) {
      updates.team_names = team_names;
    }

    if (timer_enabled !== undefined) {
      updates.timer_enabled = timer_enabled;
      if (!timer_enabled) {
        updates.timer_seconds = null;
      }
    }

    if (timer_seconds !== undefined && timer_enabled !== false) {
      updates.timer_seconds = timer_seconds;
    }

    if (bank_id && !game.started_at) {
      updates.bank_id = bank_id;
    }

    if (daily_double_positions !== undefined) {
      updates.daily_double_positions = daily_double_positions;
    }

    if (final_jeopardy_question !== undefined) {
      updates.final_jeopardy_question = final_jeopardy_question;
    }

    if (num_teams !== undefined) {
      updates.num_teams = num_teams;
    }

    // Check if there are any updates to apply
    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: 'No valid fields to update' },
        { status: 400 }
      );
    }

    // Update game record AFTER team sync succeeds
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
