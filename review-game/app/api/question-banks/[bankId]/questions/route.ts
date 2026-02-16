import { type NextRequest, NextResponse } from 'next/server';
import { createAdminServerClient } from '@/lib/admin/auth';
import { logger } from '@/lib/logger';
import type { TablesInsert } from '@/types/database.types';
import { canAccessVideoImages } from '@/lib/utils/feature-access';
import { QUESTION_VALIDATION, URL_REGEX } from '@/lib/constants/question-banks';

/**
 * GET /api/question-banks/[bankId]/questions
 * Fetches all questions for a specific question bank.
 *
 * Access: Public banks OR owned banks
 */
export async function GET(
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

    // 3. Verify access to the bank (public OR owned)
    const { data: bank, error: bankError } = await supabase
      .from('question_banks')
      .select('is_public, owner_id')
      .eq('id', bankId)
      .single();

    if (bankError || !bank) {
      logger.error('Question bank not found', bankError, {
        operation: 'getQuestions',
        userId: user.id,
        bankId,
      });
      return NextResponse.json(
        { error: 'Question bank not found' },
        { status: 404 }
      );
    }

    // Check access
    if (!bank.is_public && bank.owner_id !== user.id) {
      logger.info('Question access denied - not public or owned', {
        operation: 'getQuestions',
        userId: user.id,
        bankId,
      });
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      );
    }

    // 4. Fetch questions ordered by category and point value
    const { data: questions, error: questionsError } = await supabase
      .from('questions')
      .select('*')
      .eq('bank_id', bankId)
      .order('category', { ascending: true })
      .order('point_value', { ascending: true });

    if (questionsError) {
      logger.error('Failed to fetch questions', questionsError, {
        operation: 'getQuestions',
        userId: user.id,
        bankId,
      });
      return NextResponse.json(
        { error: 'Failed to fetch questions' },
        { status: 500 }
      );
    }

    logger.info('Questions fetched successfully', {
      operation: 'getQuestions',
      userId: user.id,
      bankId,
      count: questions?.length || 0,
    });

    // 5. Return questions array
    return NextResponse.json({ data: questions || [] });

  } catch (error) {
    logger.error('Questions fetch failed', error, {
      operation: 'getQuestions',
    });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/question-banks/[bankId]/questions
 * Creates a new question in the specified question bank.
 *
 * Only the bank owner can add questions.
 * Enforces unique constraint: (bank_id, category, point_value)
 *
 * Request Body:
 * - category: string (required, 1-100 chars)
 * - point_value: number (required, must be 100, 200, 300, 400, or 500)
 * - question_text: string (required, 1-500 chars)
 * - answer_text: string (required, 1-300 chars)
 * - teacher_notes: string (optional, max 1000 chars)
 * - image_url: string (optional, requires BASIC/PREMIUM, must be valid URL)
 */
export async function POST(
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

    // 2. Get user profile for feature access check
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      logger.error('Failed to fetch user profile', profileError, {
        operation: 'createQuestion',
        userId: user.id,
      });
      return NextResponse.json(
        { error: 'Failed to verify user profile' },
        { status: 500 }
      );
    }

    // 3. Get bankId from params
    const { bankId } = await context.params;

    // 4. Verify ownership of the bank
    const { data: bank, error: bankError } = await supabase
      .from('question_banks')
      .select('owner_id')
      .eq('id', bankId)
      .single();

    if (bankError || !bank) {
      logger.error('Question bank not found', bankError, {
        operation: 'createQuestion',
        userId: user.id,
        bankId,
      });
      return NextResponse.json(
        { error: 'Question bank not found' },
        { status: 404 }
      );
    }

    // Check ownership
    if (bank.owner_id !== user.id) {
      logger.info('Question creation denied - not owner', {
        operation: 'createQuestion',
        userId: user.id,
        bankId,
        ownerId: bank.owner_id,
      });
      return NextResponse.json(
        { error: 'Only the bank owner can add questions' },
        { status: 403 }
      );
    }

    // 5. Get and validate request body
    const body = await req.json();
    const { category, point_value, question_text, answer_text, teacher_notes, image_url } = body;

    // Validate category
    if (!category || typeof category !== 'string') {
      return NextResponse.json(
        { error: 'Category is required and must be a string' },
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

    // Validate point_value
    if (typeof point_value !== 'number') {
      return NextResponse.json(
        { error: 'Point value is required and must be a number' },
        { status: 400 }
      );
    }
    if (!QUESTION_VALIDATION.POINT_VALUES.includes(point_value as typeof QUESTION_VALIDATION.POINT_VALUES[number])) {
      return NextResponse.json(
        { error: `Point value must be one of: ${QUESTION_VALIDATION.POINT_VALUES.join(', ')}` },
        { status: 400 }
      );
    }

    // Validate question_text
    if (!question_text || typeof question_text !== 'string') {
      return NextResponse.json(
        { error: 'Question text is required and must be a string' },
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

    // Validate answer_text
    if (!answer_text || typeof answer_text !== 'string') {
      return NextResponse.json(
        { error: 'Answer text is required and must be a string' },
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

    // Validate teacher_notes (optional)
    if (teacher_notes !== undefined && teacher_notes !== null) {
      if (typeof teacher_notes !== 'string') {
        return NextResponse.json(
          { error: 'Teacher notes must be a string' },
          { status: 400 }
        );
      }
      if (teacher_notes.length > QUESTION_VALIDATION.TEACHER_NOTES_MAX_LENGTH) {
        return NextResponse.json(
          { error: `Teacher notes must not exceed ${QUESTION_VALIDATION.TEACHER_NOTES_MAX_LENGTH} characters` },
          { status: 400 }
        );
      }
    }

    // Validate image_url (optional, requires feature access)
    if (image_url !== undefined && image_url !== null && image_url !== '') {
      // Check feature access for images
      if (!canAccessVideoImages(profile)) {
        logger.info('Image URL denied - insufficient tier', {
          operation: 'createQuestion',
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
    }

    // 6. Calculate position (total count of questions in the bank)
    const { count, error: countError } = await supabase
      .from('questions')
      .select('*', { count: 'exact', head: true })
      .eq('bank_id', bankId);

    if (countError) {
      logger.error('Failed to count questions', countError, {
        operation: 'createQuestion',
        userId: user.id,
        bankId,
      });
      return NextResponse.json(
        { error: 'Failed to calculate question position' },
        { status: 500 }
      );
    }

    // 7. Create the question (database unique constraint will enforce uniqueness)
    const questionData: TablesInsert<'questions'> = {
      bank_id: bankId,
      category: category.trim(),
      point_value,
      position: (count || 0) + 1,
      question_text: question_text.trim(),
      answer_text: answer_text.trim(),
      teacher_notes: teacher_notes?.trim() || null,
      image_url: image_url?.trim() || null,
    };

    const { data: newQuestion, error: createError } = await supabase
      .from('questions')
      .insert(questionData)
      .select()
      .single();

    if (createError) {
      logger.error('Failed to create question', createError, {
        operation: 'createQuestion',
        userId: user.id,
        bankId,
      });

      // Check if it's a unique constraint violation
      if (createError.code === '23505') {
        return NextResponse.json(
          { error: `A question already exists for category "${category}" with ${point_value} points` },
          { status: 409 }
        );
      }

      return NextResponse.json(
        { error: 'Failed to create question' },
        { status: 500 }
      );
    }

    logger.info('Question created successfully', {
      operation: 'createQuestion',
      userId: user.id,
      bankId,
      questionId: newQuestion.id,
      category: category.trim(),
      pointValue: point_value,
    });

    // 8. Return created question
    return NextResponse.json(newQuestion, { status: 201 });

  } catch (error) {
    logger.error('Question creation failed', error, {
      operation: 'createQuestion',
    });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
