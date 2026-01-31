import { type NextRequest, NextResponse } from 'next/server';
import { createAdminServerClient } from '@/lib/admin/auth';
import { logger } from '@/lib/logger';

/**
 * GET /api/question-banks
 * Fetches available question banks for the authenticated user.
 *
 * Returns:
 * - Public question banks (is_public = true)
 * - User's own question banks (owner_id = user.id)
 */
export async function GET(req: NextRequest) {
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

    // Fetch public banks and user's own banks
    const { data: banks, error: fetchError } = await supabase
      .from('question_banks')
      .select('id, title, subject, is_custom, is_public, owner_id')
      .or(`is_public.eq.true,owner_id.eq.${user.id}`)
      .order('title', { ascending: true });

    if (fetchError) {
      logger.error('Failed to fetch question banks', fetchError, {
        operation: 'getQuestionBanks',
        userId: user.id,
      });
      return NextResponse.json(
        { error: 'Failed to fetch question banks' },
        { status: 500 }
      );
    }

    logger.info('Question banks fetched successfully', {
      operation: 'getQuestionBanks',
      userId: user.id,
      count: banks?.length || 0,
    });

    return NextResponse.json({ data: banks || [] });
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
