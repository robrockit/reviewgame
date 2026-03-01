import { type NextRequest, NextResponse } from 'next/server';
import { createAdminServerClient } from '@/lib/admin/auth';
import { logger } from '@/lib/logger';
import { canAccessCustomQuestionBanks } from '@/lib/utils/feature-access';
import { canAccessBank, _checkCanCreateCustomBank } from '@/lib/access-control/banks';

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

    // 5. Verify user can access the source bank (RG-108)
    // NOTE: canAccessBank returns false for both "bank doesn't exist" and "user lacks access"
    // This is intentional security-by-obscurity to prevent bank ID enumeration.
    // A 403 response doesn't reveal whether the bank exists or not.
    // Trade-off: Genuine typos also get 403 instead of 404, but this prevents
    // attackers from discovering valid bank IDs through enumeration attacks.
    const hasAccess = await canAccessBank(user.id, bankId, supabase);
    if (!hasAccess) {
      logger.info('Question bank duplication denied - no access to source bank', {
        operation: 'duplicateQuestionBank',
        userId: user.id,
        bankId,
      });
      return NextResponse.json(
        { error: 'You do not have access to this question bank' },
        { status: 403 }
      );
    }

    // 6. Check custom bank creation limit (RG-108)
    // NOTE: This check provides fast feedback but has a TOCTOU race condition.
    // If the duplicate_question_bank RPC doesn't atomically check limits,
    // concurrent requests could exceed the limit. The check here is defensive
    // to provide user-friendly errors before calling the RPC.
    // Use sync utility since we already have the profile (avoids redundant DB query)
    const canCreate = _checkCanCreateCustomBank(profile);
    if (!canCreate) {
      logger.info('Question bank duplication denied - custom bank limit reached', {
        operation: 'duplicateQuestionBank',
        userId: user.id,
        bankId,
        tier: profile.subscription_tier,
        customBankCount: profile.custom_bank_count,
        customBankLimit: profile.custom_bank_limit,
      });
      return NextResponse.json(
        {
          error: 'Custom bank limit reached',
          message: profile.custom_bank_limit === 0
            ? 'Custom question banks require a BASIC or PREMIUM subscription. Upgrade to create custom banks.'
            : 'You have reached your custom bank limit. Upgrade to PREMIUM for unlimited banks.'
        },
        { status: 403 }
      );
    }

    // 7. Call atomic database function to duplicate bank + questions
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
        errorDetails: rpcError?.details,
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

      // Handle limit exceeded errors (concurrent duplication)
      if (rpcError?.message?.includes('limit exceeded') || rpcError?.message?.includes('limit reached')) {
        return NextResponse.json(
          { error: 'Custom bank limit reached. Another bank may have been created concurrently.' },
          { status: 403 }
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

    // 8. Return the new bank
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
