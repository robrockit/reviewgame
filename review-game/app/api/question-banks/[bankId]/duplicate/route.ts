import { type NextRequest, NextResponse } from 'next/server';
import { createAdminServerClient } from '@/lib/admin/auth';
import { logger } from '@/lib/logger';
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

    // 6. Call atomic database function to duplicate bank + questions
    // This ensures no orphaned banks are created if question insertion fails
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- RPC function not in generated types yet
    const { data: result, error: rpcError } = await (supabase as any)
      .rpc('duplicate_question_bank', {
        source_bank_id: bankId,
        new_owner_id: user.id,
      });

    if (rpcError || !result) {
      logger.error('Failed to duplicate question bank', rpcError, {
        operation: 'duplicateQuestionBank',
        userId: user.id,
        bankId,
        errorCode: rpcError?.code,
        errorMessage: rpcError?.message,
      });

      // Check for specific error types
      if (rpcError?.message?.includes('Access denied')) {
        return NextResponse.json(
          { error: 'You do not have access to this question bank' },
          { status: 403 }
        );
      }

      if (rpcError?.message?.includes('not found')) {
        return NextResponse.json(
          { error: 'Question bank not found' },
          { status: 404 }
        );
      }

      return NextResponse.json(
        { error: 'Failed to duplicate question bank' },
        { status: 500 }
      );
    }

    logger.info('Question bank duplicated successfully', {
      operation: 'duplicateQuestionBank',
      userId: user.id,
      originalBankId: bankId,
      newBankId: result.id,
      questionCount: result.questions_count,
    });

    // 7. Return the new bank
    return NextResponse.json(result, { status: 201 });

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
