import { type NextRequest, NextResponse } from 'next/server';
import { createAdminServerClient } from '@/lib/admin/auth';
import { logger } from '@/lib/logger';
import type { TablesUpdate } from '@/types/database.types';
import { QUESTION_BANK_VALIDATION } from '@/lib/constants/question-banks';

/**
 * PATCH /api/question-banks/[bankId]
 * Updates an existing question bank's metadata.
 *
 * Only the owner can update a bank.
 * Public banks cannot be modified by non-owners.
 *
 * Request Body (all optional):
 * - title: string (1-200 chars)
 * - subject: string (1-100 chars)
 * - description: string (max 1000 chars)
 * - difficulty: 'easy' | 'medium' | 'hard'
 */
export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ bankId: string }> }
) {
  try {
    const supabase = await createAdminServerClient();

    // 1. Verify authentication
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // 2. Get bankId from params
    const { bankId } = await context.params;

    // 3. Verify ownership (fetch the bank and check owner_id)
    const { data: existingBank, error: fetchError } = await supabase
      .from('question_banks')
      .select('*')
      .eq('id', bankId)
      .single();

    if (fetchError || !existingBank) {
      logger.error('Question bank not found', fetchError, {
        operation: 'updateQuestionBank',
        userId: user.id,
        bankId,
      });
      return NextResponse.json(
        { error: 'Question bank not found' },
        { status: 404 }
      );
    }

    // Check ownership
    if (existingBank.owner_id !== user.id) {
      logger.info('Question bank update denied - not owner', {
        operation: 'updateQuestionBank',
        userId: user.id,
        bankId,
        ownerId: existingBank.owner_id,
      });
      return NextResponse.json(
        { error: 'Only the owner can modify this question bank' },
        { status: 403 }
      );
    }

    // 4. Get and validate request body
    const body = await req.json();
    const { title, subject, description, difficulty } = body;

    // Build update object with only provided fields
    const updateData: TablesUpdate<'question_banks'> = {};

    // Validate and add title if provided
    if (title !== undefined) {
      if (typeof title !== 'string') {
        return NextResponse.json(
          { error: 'Title must be a string' },
          { status: 400 }
        );
      }
      if (title.length < QUESTION_BANK_VALIDATION.TITLE_MIN_LENGTH ||
          title.length > QUESTION_BANK_VALIDATION.TITLE_MAX_LENGTH) {
        return NextResponse.json(
          { error: `Title must be between ${QUESTION_BANK_VALIDATION.TITLE_MIN_LENGTH} and ${QUESTION_BANK_VALIDATION.TITLE_MAX_LENGTH} characters` },
          { status: 400 }
        );
      }
      updateData.title = title.trim();
    }

    // Validate and add subject if provided
    if (subject !== undefined) {
      if (typeof subject !== 'string') {
        return NextResponse.json(
          { error: 'Subject must be a string' },
          { status: 400 }
        );
      }
      if (subject.length < QUESTION_BANK_VALIDATION.SUBJECT_MIN_LENGTH ||
          subject.length > QUESTION_BANK_VALIDATION.SUBJECT_MAX_LENGTH) {
        return NextResponse.json(
          { error: `Subject must be between ${QUESTION_BANK_VALIDATION.SUBJECT_MIN_LENGTH} and ${QUESTION_BANK_VALIDATION.SUBJECT_MAX_LENGTH} characters` },
          { status: 400 }
        );
      }
      updateData.subject = subject.trim();
    }

    // Validate and add description if provided
    if (description !== undefined) {
      if (description !== null && typeof description !== 'string') {
        return NextResponse.json(
          { error: 'Description must be a string or null' },
          { status: 400 }
        );
      }
      if (description && description.length > QUESTION_BANK_VALIDATION.DESCRIPTION_MAX_LENGTH) {
        return NextResponse.json(
          { error: `Description must not exceed ${QUESTION_BANK_VALIDATION.DESCRIPTION_MAX_LENGTH} characters` },
          { status: 400 }
        );
      }
      updateData.description = description ? description.trim() : null;
    }

    // Validate and add difficulty if provided
    if (difficulty !== undefined) {
      if (difficulty !== null && !QUESTION_BANK_VALIDATION.DIFFICULTIES.includes(difficulty)) {
        return NextResponse.json(
          { error: `Difficulty must be one of: ${QUESTION_BANK_VALIDATION.DIFFICULTIES.join(', ')}` },
          { status: 400 }
        );
      }
      updateData.difficulty = difficulty;
    }

    // Check if there's anything to update
    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: 'No fields to update' },
        { status: 400 }
      );
    }

    // Add updated_at timestamp
    updateData.updated_at = new Date().toISOString();

    // 5. Update the bank
    const { data: updatedBank, error: updateError } = await supabase
      .from('question_banks')
      .update(updateData)
      .eq('id', bankId)
      .select()
      .single();

    if (updateError) {
      logger.error('Failed to update question bank', updateError, {
        operation: 'updateQuestionBank',
        userId: user.id,
        bankId,
      });
      return NextResponse.json(
        { error: 'Failed to update question bank' },
        { status: 500 }
      );
    }

    logger.info('Question bank updated successfully', {
      operation: 'updateQuestionBank',
      userId: user.id,
      bankId,
      updatedFields: Object.keys(updateData),
    });

    // 6. Return updated bank
    return NextResponse.json(updatedBank);

  } catch (error) {
    logger.error('Question bank update failed', error, {
      operation: 'updateQuestionBank',
    });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/question-banks/[bankId]
 * Deletes a question bank and all its questions (CASCADE).
 *
 * Only the owner can delete a bank.
 * Cannot delete if the bank is currently used in any games.
 */
export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ bankId: string }> }
) {
  try {
    const supabase = await createAdminServerClient();

    // 1. Verify authentication
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // 2. Get bankId from params
    const { bankId } = await context.params;

    // 3. Verify ownership
    const { data: existingBank, error: fetchError } = await supabase
      .from('question_banks')
      .select('*')
      .eq('id', bankId)
      .single();

    if (fetchError || !existingBank) {
      logger.error('Question bank not found', fetchError, {
        operation: 'deleteQuestionBank',
        userId: user.id,
        bankId,
      });
      return NextResponse.json(
        { error: 'Question bank not found' },
        { status: 404 }
      );
    }

    // Check ownership
    if (existingBank.owner_id !== user.id) {
      logger.info('Question bank deletion denied - not owner', {
        operation: 'deleteQuestionBank',
        userId: user.id,
        bankId,
        ownerId: existingBank.owner_id,
      });
      return NextResponse.json(
        { error: 'Only the owner can delete this question bank' },
        { status: 403 }
      );
    }

    // 4. Check if bank is used in any games
    const { data: games, error: gamesError } = await supabase
      .from('games')
      .select('id')
      .eq('bank_id', bankId)
      .limit(1);

    if (gamesError) {
      logger.error('Failed to check game usage', gamesError, {
        operation: 'deleteQuestionBank',
        userId: user.id,
        bankId,
      });
      return NextResponse.json(
        { error: 'Failed to verify bank usage' },
        { status: 500 }
      );
    }

    if (games && games.length > 0) {
      logger.info('Question bank deletion denied - used in games', {
        operation: 'deleteQuestionBank',
        userId: user.id,
        bankId,
        gameCount: games.length,
      });
      return NextResponse.json(
        { error: 'Cannot delete question bank that is used in games' },
        { status: 409 }
      );
    }

    // 5. Delete the bank (CASCADE will delete questions)
    const { error: deleteError } = await supabase
      .from('question_banks')
      .delete()
      .eq('id', bankId);

    if (deleteError) {
      logger.error('Failed to delete question bank', deleteError, {
        operation: 'deleteQuestionBank',
        userId: user.id,
        bankId,
      });
      return NextResponse.json(
        { error: 'Failed to delete question bank' },
        { status: 500 }
      );
    }

    logger.info('Question bank deleted successfully', {
      operation: 'deleteQuestionBank',
      userId: user.id,
      bankId,
    });

    // 6. Return success (204 No Content)
    return new NextResponse(null, { status: 204 });

  } catch (error) {
    logger.error('Question bank deletion failed', error, {
      operation: 'deleteQuestionBank',
    });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
