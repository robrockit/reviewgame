import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { logger } from '@/lib/logger';
import type { PrebuiltBank } from '@/types/question-banks';
import type { Database } from '@/types/database.types';

// Re-export so callers can import from this route module if preferred
export type { PrebuiltBank };

/**
 * GET /api/question-banks/prebuilt
 * Returns all public prebuilt banks with question counts.
 * No auth required — used by onboarding and settings to display all options.
 *
 * Uses a minimal no-cookie anon client (no session needed for a public read).
 * RLS permits reads on is_public=true rows for the anon role.
 */
export async function GET() {
  try {
    // No cookies — this is a public endpoint, no user session required.
    // Do NOT use createAdminServerClient (anon+cookies) or
    // createAdminServiceClient (service role) here; anon key with no session
    // context is the correct least-privilege choice for a public read.
    const supabase = createServerClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { get: () => undefined, set: () => {}, remove: () => {} } }
    );

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

    const transformed: PrebuiltBank[] = (banks ?? []).map((bank) => {
      // Supabase returns embedded aggregate counts as [{ count: N }].
      // Guard defensively against shape changes rather than casting blindly.
      const countRow = Array.isArray(bank.questions) ? bank.questions[0] : undefined;
      const question_count =
        typeof countRow === 'object' && countRow !== null && 'count' in countRow
          ? Number((countRow as { count: number }).count)
          : 0;

      return {
        id: bank.id,
        title: bank.title,
        subject: bank.subject,
        description: bank.description,
        difficulty: bank.difficulty,
        question_count,
      };
    });

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
