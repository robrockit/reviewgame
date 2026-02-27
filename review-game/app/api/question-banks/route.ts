import { type NextRequest, NextResponse } from 'next/server';
import { createAdminServerClient } from '@/lib/admin/auth';
import { logger } from '@/lib/logger';
import { canAccessCustomQuestionBanks } from '@/lib/utils/feature-access';
import { QUESTION_BANK_VALIDATION } from '@/lib/constants/question-banks';
import { getAccessibleBanks, canCreateCustomBank } from '@/lib/access-control/banks';

/**
 * GET /api/question-banks
 * Fetches available question banks for the authenticated user.
 *
 * Returns tier-appropriate banks:
 * - FREE: Only banks in accessible_prebuilt_bank_ids + owned custom banks
 * - BASIC: All prebuilt banks + owned custom banks
 * - PREMIUM: All prebuilt banks + owned custom banks
 */
export async function GET() {
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

    // Fetch accessible banks using RG-108 access control
    const banks = await getAccessibleBanks(user.id, supabase);

    logger.info('Question banks fetched successfully', {
      operation: 'getQuestionBanks',
      userId: user.id,
      count: banks.length,
    });

    return NextResponse.json({ data: banks });
  } catch (error) {
    logger.error('Question banks fetch failed', error, {
      operation: 'getQuestionBanks',
    });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/question-banks
 * Creates a new custom question bank.
 *
 * Feature Gate: Requires BASIC or PREMIUM subscription tier
 *
 * Request Body:
 * - title: string (required, 1-200 chars)
 * - subject: string (required, 1-100 chars)
 * - description: string (optional, max 1000 chars)
 * - difficulty: 'easy' | 'medium' | 'hard' (optional)
 */
export async function POST(req: NextRequest) {
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
        operation: 'createQuestionBank',
        userId: user.id,
      });
      return NextResponse.json(
        { error: 'Failed to verify user profile' },
        { status: 500 }
      );
    }

    // 3. Check feature access (BASIC or PREMIUM required)
    if (!canAccessCustomQuestionBanks(profile)) {
      logger.info('Custom question bank creation denied - insufficient tier', {
        operation: 'createQuestionBank',
        userId: user.id,
        tier: profile.subscription_tier,
        status: profile.subscription_status,
      });
      return NextResponse.json(
        { error: 'Custom question banks require BASIC or PREMIUM subscription' },
        { status: 403 }
      );
    }

    // 4. Check custom bank limit (RG-108)
    const canCreate = await canCreateCustomBank(user.id, supabase);
    if (!canCreate) {
      logger.info('Custom question bank creation denied - limit reached', {
        operation: 'createQuestionBank',
        userId: user.id,
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

    // 5. Get and validate request body
    const body = await req.json();
    const { title, subject, description, difficulty } = body;

    // Validate title
    if (!title || typeof title !== 'string') {
      return NextResponse.json(
        { error: 'Title is required and must be a string' },
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

    // Validate subject
    if (!subject || typeof subject !== 'string') {
      return NextResponse.json(
        { error: 'Subject is required and must be a string' },
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

    // Validate description (optional)
    if (description !== undefined && description !== null) {
      if (typeof description !== 'string') {
        return NextResponse.json(
          { error: 'Description must be a string' },
          { status: 400 }
        );
      }
      if (description.length > QUESTION_BANK_VALIDATION.DESCRIPTION_MAX_LENGTH) {
        return NextResponse.json(
          { error: `Description must not exceed ${QUESTION_BANK_VALIDATION.DESCRIPTION_MAX_LENGTH} characters` },
          { status: 400 }
        );
      }
    }

    // Validate difficulty (optional)
    if (difficulty !== undefined && difficulty !== null) {
      if (!QUESTION_BANK_VALIDATION.DIFFICULTIES.includes(difficulty)) {
        return NextResponse.json(
          { error: `Difficulty must be one of: ${QUESTION_BANK_VALIDATION.DIFFICULTIES.join(', ')}` },
          { status: 400 }
        );
      }
    }

    // 6. Create question bank using RPC (atomic limit enforcement)
    const { data: bankId, error: rpcError } = await supabase.rpc(
      'create_custom_bank_with_limit_check',
      {
        p_owner_id: user.id,
        p_title: title.trim(),
        p_subject: subject.trim(),
        p_description: description?.trim() || null,
        p_difficulty: difficulty || null,
      }
    );

    if (rpcError) {
      // Check if error is limit exceeded
      if (rpcError.message?.includes('Custom bank limit exceeded')) {
        logger.info('Custom question bank creation denied - limit exceeded (concurrent)', {
          operation: 'createQuestionBank',
          userId: user.id,
          error: rpcError.message,
        });
        return NextResponse.json(
          { error: 'Custom bank limit reached. Another bank was created concurrently.' },
          { status: 403 }
        );
      }

      // Other database errors
      logger.error('Failed to create question bank', rpcError, {
        operation: 'createQuestionBank',
        userId: user.id,
      });
      return NextResponse.json(
        { error: 'Failed to create question bank' },
        { status: 500 }
      );
    }

    // 7. Fetch the created bank to return full details
    const { data: newBank, error: fetchError } = await supabase
      .from('question_banks')
      .select('*')
      .eq('id', bankId)
      .single();

    if (fetchError || !newBank) {
      logger.error('Failed to fetch created question bank', fetchError, {
        operation: 'createQuestionBank',
        userId: user.id,
        bankId,
      });
      // Bank was created but we can't fetch it - return minimal response
      return NextResponse.json(
        { id: bankId, message: 'Bank created but details unavailable' },
        { status: 201 }
      );
    }

    logger.info('Question bank created successfully', {
      operation: 'createQuestionBank',
      userId: user.id,
      bankId: newBank.id,
    });

    // 8. Return created bank
    return NextResponse.json(newBank, { status: 201 });

  } catch (error) {
    logger.error('Question bank creation failed', error, {
      operation: 'createQuestionBank',
    });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
