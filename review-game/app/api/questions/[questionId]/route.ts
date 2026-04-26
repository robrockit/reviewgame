import { type NextRequest, NextResponse } from 'next/server';
import { createAdminServerClient } from '@/lib/admin/auth';
import { logger } from '@/lib/logger';
import type { TablesUpdate } from '@/types/database.types';
import { canAccessVideoImages } from '@/lib/utils/feature-access';
import { QUESTION_VALIDATION } from '@/lib/constants/question-banks';
import { isSafeImageUrl } from '@/lib/utils/url';

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
    const { category, point_value, question_text, answer_text, teacher_notes, image_url, image_alt_text, mc_options } = body;

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

    // Validate and add image_alt_text if provided
    if (image_alt_text !== undefined) {
      if (image_alt_text !== null && typeof image_alt_text !== 'string') {
        return NextResponse.json(
          { error: 'Image alt text must be a string or null' },
          { status: 400 }
        );
      }
      if (image_alt_text && image_alt_text.length > QUESTION_VALIDATION.IMAGE_ALT_TEXT_MAX_LENGTH) {
        return NextResponse.json(
          { error: `Image alt text must not exceed ${QUESTION_VALIDATION.IMAGE_ALT_TEXT_MAX_LENGTH} characters` },
          { status: 400 }
        );
      }
      updateData.image_alt_text = image_alt_text ? image_alt_text.trim() : null;
    }

    // Validate and add mc_options if provided
    if (mc_options !== undefined) {
      if (mc_options !== null) {
        if (!Array.isArray(mc_options) || mc_options.length !== 3) {
          return NextResponse.json(
            { error: 'mc_options must be an array of exactly 3 strings or null' },
            { status: 400 }
          );
        }
        for (const opt of mc_options) {
          if (typeof opt !== 'string' || opt.trim().length === 0) {
            return NextResponse.json(
              { error: 'Each mc_options entry must be a non-empty string' },
              { status: 400 }
            );
          }
          if (opt.length > QUESTION_VALIDATION.ANSWER_TEXT_MAX_LENGTH) {
            return NextResponse.json(
              { error: `Each wrong answer must not exceed ${QUESTION_VALIDATION.ANSWER_TEXT_MAX_LENGTH} characters` },
              { status: 400 }
            );
          }
        }
        // Cross-validate against answer_text (use provided value if being updated, else existing DB value)
        const effectiveAnswerText = typeof answer_text === 'string' ? answer_text : (existingQuestion.answer_text as string);
        if (mc_options.some((opt: string) => opt.trim().toLowerCase() === effectiveAnswerText.trim().toLowerCase())) {
          return NextResponse.json(
            { error: 'Wrong answers must differ from the correct answer' },
            { status: 400 }
          );
        }
        const uniqueOpts = new Set(mc_options.map((o: string) => o.trim().toLowerCase()));
        if (uniqueOpts.size !== mc_options.length) {
          return NextResponse.json(
            { error: 'Wrong answers must all be distinct' },
            { status: 400 }
          );
        }
        updateData.mc_options = mc_options.map((opt: string) => opt.trim());
      } else {
        updateData.mc_options = null;
      }
    }

    // Validate and add image_url if provided
    if (image_url !== undefined) {
      if (image_url !== null && image_url !== '') {
        // Validate type before checking feature access to return accurate status codes
        if (typeof image_url !== 'string') {
          return NextResponse.json(
            { error: 'Image URL must be a string' },
            { status: 400 }
          );
        }
        if (!isSafeImageUrl(image_url)) {
          return NextResponse.json(
            { error: 'Image URL must be a valid HTTPS URL' },
            { status: 400 }
          );
        }

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

    // Guard: never persist alt text without an image.
    // If the resulting image_url after this PATCH is null, force alt text to null.
    const effectiveImageUrl = 'image_url' in updateData
      ? updateData.image_url
      : existingQuestion.image_url;
    if (!effectiveImageUrl) {
      updateData.image_alt_text = null;
    }

    // 6. Add updated_at timestamp (database unique constraint will enforce uniqueness)
    updateData.updated_at = new Date().toISOString();

    // 7. Update the question (database constraint will catch duplicates)
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
