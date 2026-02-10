import { type NextRequest, NextResponse } from 'next/server';
import { createAdminServerClient } from '@/lib/admin/auth';
import { logger } from '@/lib/logger';
import type { TablesUpdate } from '@/types/database.types';
import { canAccessVideoImages } from '@/lib/utils/feature-access';
import { QUESTION_VALIDATION, URL_REGEX } from '@/lib/constants/question-banks';

/**
 * PATCH /api/questions/[questionId]
 * Updates an existing question.
 *
 * Only the bank owner can update questions.
 * If category or point_value changes, enforces unique constraint.
 *
 * Request Body (all optional):
 * - category: string (1-100 chars)
 * - point_value: number (100, 200, 300, 400, or 500)
 * - question_text: string (1-500 chars)
 * - answer_text: string (1-300 chars)
 * - teacher_notes: string (max 1000 chars)
 * - image_url: string (requires BASIC/PREMIUM, valid URL)
 */
export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ questionId: string }> }
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

    // 2. Get user profile for feature access check
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      logger.error('Failed to fetch user profile', profileError, {
        operation: 'updateQuestion',
        userId: user.id,
      });
      return NextResponse.json(
        { error: 'Failed to verify user profile' },
        { status: 500 }
      );
    }

    // 3. Get questionId from params
    const { questionId } = await context.params;

    // 4. Fetch the question with its bank info
    const { data: existingQuestion, error: fetchError } = await supabase
      .from('questions')
      .select(`
        *,
        question_banks (
          owner_id
        )
      `)
      .eq('id', questionId)
      .single();

    if (fetchError || !existingQuestion) {
      logger.error('Question not found', fetchError, {
        operation: 'updateQuestion',
        userId: user.id,
        questionId,
      });
      return NextResponse.json(
        { error: 'Question not found' },
        { status: 404 }
      );
    }

    // Type assertion for the joined data
    type QuestionWithBank = typeof existingQuestion & {
      question_banks: { owner_id: string } | null;
    };
    const questionWithBank = existingQuestion as QuestionWithBank;

    // Check ownership via bank
    if (!questionWithBank.question_banks || questionWithBank.question_banks.owner_id !== user.id) {
      logger.info('Question update denied - not owner', {
        operation: 'updateQuestion',
        userId: user.id,
        questionId,
      });
      return NextResponse.json(
        { error: 'Only the bank owner can modify questions' },
        { status: 403 }
      );
    }

    // 5. Get and validate request body
    const body = await req.json();
    const { category, point_value, question_text, answer_text, teacher_notes, image_url } = body;

    // Build update object with only provided fields
    const updateData: TablesUpdate<'questions'> = {};

    // Validate and add category if provided
    if (category !== undefined) {
      if (typeof category !== 'string') {
        return NextResponse.json(
          { error: 'Category must be a string' },
          { status: 400 }
        );
      }
      if (category.length < QUESTION_VALIDATION.CATEGORY_MIN_LENGTH ||
          category.length > QUESTION_VALIDATION.CATEGORY_MAX_LENGTH) {
        return NextResponse.json(
          { error: `Category must be between ${QUESTION_VALIDATION.CATEGORY_MIN_LENGTH} and ${QUESTION_VALIDATION.CATEGORY_MAX_LENGTH} characters` },
          { status: 400 }
        );
      }
      updateData.category = category.trim();
    }

    // Validate and add point_value if provided
    if (point_value !== undefined) {
      if (typeof point_value !== 'number') {
        return NextResponse.json(
          { error: 'Point value must be a number' },
          { status: 400 }
        );
      }
      if (!QUESTION_VALIDATION.POINT_VALUES.includes(point_value as typeof QUESTION_VALIDATION.POINT_VALUES[number])) {
        return NextResponse.json(
          { error: `Point value must be one of: ${QUESTION_VALIDATION.POINT_VALUES.join(', ')}` },
          { status: 400 }
        );
      }
      updateData.point_value = point_value;
    }

    // Validate and add question_text if provided
    if (question_text !== undefined) {
      if (typeof question_text !== 'string') {
        return NextResponse.json(
          { error: 'Question text must be a string' },
          { status: 400 }
        );
      }
      if (question_text.length < QUESTION_VALIDATION.QUESTION_TEXT_MIN_LENGTH ||
          question_text.length > QUESTION_VALIDATION.QUESTION_TEXT_MAX_LENGTH) {
        return NextResponse.json(
          { error: `Question text must be between ${QUESTION_VALIDATION.QUESTION_TEXT_MIN_LENGTH} and ${QUESTION_VALIDATION.QUESTION_TEXT_MAX_LENGTH} characters` },
          { status: 400 }
        );
      }
      updateData.question_text = question_text.trim();
    }

    // Validate and add answer_text if provided
    if (answer_text !== undefined) {
      if (typeof answer_text !== 'string') {
        return NextResponse.json(
          { error: 'Answer text must be a string' },
          { status: 400 }
        );
      }
      if (answer_text.length < QUESTION_VALIDATION.ANSWER_TEXT_MIN_LENGTH ||
          answer_text.length > QUESTION_VALIDATION.ANSWER_TEXT_MAX_LENGTH) {
        return NextResponse.json(
          { error: `Answer text must be between ${QUESTION_VALIDATION.ANSWER_TEXT_MIN_LENGTH} and ${QUESTION_VALIDATION.ANSWER_TEXT_MAX_LENGTH} characters` },
          { status: 400 }
        );
      }
      updateData.answer_text = answer_text.trim();
    }

    // Validate and add teacher_notes if provided
    if (teacher_notes !== undefined) {
      if (teacher_notes !== null && typeof teacher_notes !== 'string') {
        return NextResponse.json(
          { error: 'Teacher notes must be a string or null' },
          { status: 400 }
        );
      }
      if (teacher_notes && teacher_notes.length > QUESTION_VALIDATION.TEACHER_NOTES_MAX_LENGTH) {
        return NextResponse.json(
          { error: `Teacher notes must not exceed ${QUESTION_VALIDATION.TEACHER_NOTES_MAX_LENGTH} characters` },
          { status: 400 }
        );
      }
      updateData.teacher_notes = teacher_notes ? teacher_notes.trim() : null;
    }

    // Validate and add image_url if provided
    if (image_url !== undefined) {
      if (image_url !== null && image_url !== '') {
        // Check feature access for images
        if (!canAccessVideoImages(profile)) {
          logger.info('Image URL denied - insufficient tier', {
            operation: 'updateQuestion',
            userId: user.id,
            tier: profile.subscription_tier,
            status: profile.subscription_status,
          });
          return NextResponse.json(
            { error: 'Image URLs require BASIC or PREMIUM subscription' },
            { status: 403 }
          );
        }

        // Validate URL format
        if (typeof image_url !== 'string') {
          return NextResponse.json(
            { error: 'Image URL must be a string' },
            { status: 400 }
          );
        }
        if (!URL_REGEX.test(image_url)) {
          return NextResponse.json(
            { error: 'Image URL must be a valid HTTP/HTTPS URL' },
            { status: 400 }
          );
        }
        updateData.image_url = image_url.trim();
      } else {
        updateData.image_url = null;
      }
    }

    // Check if there's anything to update
    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: 'No fields to update' },
        { status: 400 }
      );
    }

    // 6. If category or point_value changed, check unique constraint
    if (updateData.category !== undefined || updateData.point_value !== undefined) {
      const newCategory = updateData.category ?? existingQuestion.category;
      const newPointValue = updateData.point_value ?? existingQuestion.point_value;

      // Only check if the combination actually changed
      if (newCategory !== existingQuestion.category || newPointValue !== existingQuestion.point_value) {
        const { data: duplicate, error: duplicateCheckError } = await supabase
          .from('questions')
          .select('id')
          .eq('bank_id', existingQuestion.bank_id)
          .eq('category', newCategory)
          .eq('point_value', newPointValue)
          .neq('id', questionId)
          .maybeSingle();

        if (duplicateCheckError) {
          logger.error('Failed to check for duplicate question', duplicateCheckError, {
            operation: 'updateQuestion',
            userId: user.id,
            questionId,
          });
          return NextResponse.json(
            { error: 'Failed to verify question uniqueness' },
            { status: 500 }
          );
        }

        if (duplicate) {
          return NextResponse.json(
            { error: `A question already exists for category "${newCategory}" with ${newPointValue} points` },
            { status: 409 }
          );
        }
      }
    }

    // Add updated_at timestamp
    updateData.updated_at = new Date().toISOString();

    // 7. Update the question
    const { data: updatedQuestion, error: updateError } = await supabase
      .from('questions')
      .update(updateData)
      .eq('id', questionId)
      .select()
      .single();

    if (updateError) {
      logger.error('Failed to update question', updateError, {
        operation: 'updateQuestion',
        userId: user.id,
        questionId,
      });

      // Check if it's a unique constraint violation
      if (updateError.code === '23505') {
        return NextResponse.json(
          { error: 'A question with this category and point value already exists' },
          { status: 409 }
        );
      }

      return NextResponse.json(
        { error: 'Failed to update question' },
        { status: 500 }
      );
    }

    logger.info('Question updated successfully', {
      operation: 'updateQuestion',
      userId: user.id,
      questionId,
      updatedFields: Object.keys(updateData),
    });

    // 8. Return updated question
    return NextResponse.json(updatedQuestion);

  } catch (error) {
    logger.error('Question update failed', error, {
      operation: 'updateQuestion',
    });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/questions/[questionId]
 * Deletes a question.
 *
 * Only the bank owner can delete questions.
 */
export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ questionId: string }> }
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

    // 2. Get questionId from params
    const { questionId } = await context.params;

    // 3. Fetch the question with its bank info
    const { data: existingQuestion, error: fetchError } = await supabase
      .from('questions')
      .select(`
        *,
        question_banks (
          owner_id
        )
      `)
      .eq('id', questionId)
      .single();

    if (fetchError || !existingQuestion) {
      logger.error('Question not found', fetchError, {
        operation: 'deleteQuestion',
        userId: user.id,
        questionId,
      });
      return NextResponse.json(
        { error: 'Question not found' },
        { status: 404 }
      );
    }

    // Type assertion for the joined data
    type QuestionWithBank = typeof existingQuestion & {
      question_banks: { owner_id: string } | null;
    };
    const questionWithBank = existingQuestion as QuestionWithBank;

    // Check ownership via bank
    if (!questionWithBank.question_banks || questionWithBank.question_banks.owner_id !== user.id) {
      logger.info('Question deletion denied - not owner', {
        operation: 'deleteQuestion',
        userId: user.id,
        questionId,
      });
      return NextResponse.json(
        { error: 'Only the bank owner can delete questions' },
        { status: 403 }
      );
    }

    // 4. Delete the question
    const { error: deleteError } = await supabase
      .from('questions')
      .delete()
      .eq('id', questionId);

    if (deleteError) {
      logger.error('Failed to delete question', deleteError, {
        operation: 'deleteQuestion',
        userId: user.id,
        questionId,
      });
      return NextResponse.json(
        { error: 'Failed to delete question' },
        { status: 500 }
      );
    }

    logger.info('Question deleted successfully', {
      operation: 'deleteQuestion',
      userId: user.id,
      questionId,
    });

    // 5. Return success (204 No Content)
    return new NextResponse(null, { status: 204 });

  } catch (error) {
    logger.error('Question deletion failed', error, {
      operation: 'deleteQuestion',
    });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
