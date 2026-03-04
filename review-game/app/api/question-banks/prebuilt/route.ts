import { NextResponse } from 'next/server';
import { createAdminServerClient } from '@/lib/admin/auth';
import { logger } from '@/lib/logger';
import type { PrebuiltBank } from '@/types/question-banks';

// Re-export so callers can import from this route module if preferred
export type { PrebuiltBank };

/**
 * GET /api/question-banks/prebuilt
 * Returns all public prebuilt banks with question counts.
 * No auth required — used by onboarding and settings to display all options.
 *
 * Note: uses anon key (createAdminServerClient) — public banks are readable
 * without authentication because RLS allows reads on is_public=true rows.
 */
export async function GET() {
  try {
    const supabase = await createAdminServerClient();

    const { data: banks, error } = await supabase
      .from('question_banks')
      .select('id, title, subject, description, difficulty, questions(count)')
      .eq('is_custom', false)
      .eq('is_public', true)
      .order('title');

    if (error) {
      logger.error('Failed to fetch prebuilt question banks', error, {
        operation: 'getPrebuiltQuestionBanks',
      });
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }

    const transformed: PrebuiltBank[] = (banks ?? []).map((bank) => ({
      id: bank.id,
      title: bank.title,
      subject: bank.subject,
      description: bank.description,
      difficulty: bank.difficulty,
      question_count: Array.isArray(bank.questions) && bank.questions.length > 0
        ? (bank.questions[0] as { count: number }).count
        : 0,
    }));

    logger.info('Prebuilt question banks fetched', {
      operation: 'getPrebuiltQuestionBanks',
      count: transformed.length,
    });

    return NextResponse.json({ data: transformed });
  } catch (error) {
    logger.error('Unexpected error fetching prebuilt banks', error, {
      operation: 'getPrebuiltQuestionBanks',
    });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
