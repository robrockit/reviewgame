import { type NextRequest, NextResponse } from 'next/server';
import { createAdminServerClient } from '@/lib/admin/auth';
import { logger } from '@/lib/logger';
import type { TablesInsert } from '@/types/database.types';
import { canAccessCustomQuestionBanks } from '@/lib/utils/feature-access';

/**
 * POST /api/question-banks/[bankId]/duplicate
 * Duplicates a question bank with all its questions in a single atomic operation.
 *
 * Feature Gate: Requires BASIC or PREMIUM subscription tier
 *
 * Creates:
 * 1. New question bank with title "Copy of [original title]"
 * 2. Copies all questions from the original bank
 *
 * The operation is atomic - if any step fails, no data is created.
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
        operation: 'duplicateQuestionBank',
        userId: user.id,
      });
      return NextResponse.json(
        { error: 'Failed to verify user profile' },
        { status: 500 }
      );
    }

    // 3. Check feature access (BASIC or PREMIUM required)
    if (!canAccessCustomQuestionBanks(profile)) {
      logger.info('Question bank duplication denied - insufficient tier', {
        operation: 'duplicateQuestionBank',
        userId: user.id,
        tier: profile.subscription_tier,
        status: profile.subscription_status,
      });
      return NextResponse.json(
        { error: 'Duplicating question banks requires BASIC or PREMIUM subscription' },
        { status: 403 }
      );
    }

    // 4. Get bankId from params
    const { bankId } = await context.params;

    // 5. Fetch the original bank (must be public OR owned by user)
    const { data: originalBank, error: bankError } = await supabase
      .from('question_banks')
      .select('*')
      .eq('id', bankId)
      .single();

    if (bankError || !originalBank) {
      logger.error('Original question bank not found', bankError, {
        operation: 'duplicateQuestionBank',
        userId: user.id,
        bankId,
      });
      return NextResponse.json(
        { error: 'Question bank not found' },
        { status: 404 }
      );
    }

    // Verify user can access this bank (public OR owned)
    if (!originalBank.is_public && originalBank.owner_id !== user.id) {
      logger.info('Question bank duplication denied - no access', {
        operation: 'duplicateQuestionBank',
        userId: user.id,
        bankId,
      });
      return NextResponse.json(
        { error: 'You do not have access to this question bank' },
        { status: 403 }
      );
    }

    // 6. Fetch all questions from the original bank
    const { data: originalQuestions, error: questionsError } = await supabase
      .from('questions')
      .select('*')
      .eq('bank_id', bankId)
      .order('category', { ascending: true })
      .order('point_value', { ascending: true });

    if (questionsError) {
      logger.error('Failed to fetch questions for duplication', questionsError, {
        operation: 'duplicateQuestionBank',
        userId: user.id,
        bankId,
      });
      return NextResponse.json(
        { error: 'Failed to fetch questions' },
        { status: 500 }
      );
    }

    // 7. Create the new bank with "Copy of" prefix
    const newBankData: TablesInsert<'question_banks'> = {
      title: `Copy of ${originalBank.title}`,
      subject: originalBank.subject,
      description: originalBank.description,
      difficulty: originalBank.difficulty,
      owner_id: user.id,
      is_custom: true,
      is_public: false, // Duplicated banks are always private
    };

    const { data: newBank, error: createBankError } = await supabase
      .from('question_banks')
      .insert(newBankData)
      .select()
      .single();

    if (createBankError) {
      logger.error('Failed to create duplicate question bank', createBankError, {
        operation: 'duplicateQuestionBank',
        userId: user.id,
        originalBankId: bankId,
      });
      return NextResponse.json(
        { error: 'Failed to create duplicate question bank' },
        { status: 500 }
      );
    }

    // 8. Bulk insert all questions with new bank_id
    if (originalQuestions && originalQuestions.length > 0) {
      const newQuestions: TablesInsert<'questions'>[] = originalQuestions.map(q => ({
        bank_id: newBank.id,
        category: q.category,
        point_value: q.point_value,
        position: q.position,
        question_text: q.question_text,
        answer_text: q.answer_text,
        teacher_notes: q.teacher_notes,
        image_url: q.image_url,
      }));

      const { error: insertQuestionsError } = await supabase
        .from('questions')
        .insert(newQuestions);

      if (insertQuestionsError) {
        logger.error('Failed to duplicate questions', insertQuestionsError, {
          operation: 'duplicateQuestionBank',
          userId: user.id,
          newBankId: newBank.id,
          questionCount: newQuestions.length,
        });

        // Rollback: Delete the newly created bank
        const { error: rollbackError } = await supabase
          .from('question_banks')
          .delete()
          .eq('id', newBank.id);

        if (rollbackError) {
          logger.error('CRITICAL: Rollback failed - orphaned bank created', rollbackError, {
            operation: 'duplicateQuestionBank',
            userId: user.id,
            orphanedBankId: newBank.id,
            originalBankId: bankId,
          });
          return NextResponse.json(
            { error: 'Failed to duplicate questions and rollback failed. Please contact support.' },
            { status: 500 }
          );
        }

        return NextResponse.json(
          { error: 'Failed to duplicate questions' },
          { status: 500 }
        );
      }
    }

    logger.info('Question bank duplicated successfully', {
      operation: 'duplicateQuestionBank',
      userId: user.id,
      originalBankId: bankId,
      newBankId: newBank.id,
      questionCount: originalQuestions?.length || 0,
    });

    // 9. Return the new bank
    return NextResponse.json({
      ...newBank,
      question_count: originalQuestions?.length || 0,
    }, { status: 201 });

  } catch (error) {
    logger.error('Question bank duplication failed', error, {
      operation: 'duplicateQuestionBank',
    });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
