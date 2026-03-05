import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/api/auth';
import { validateAndSaveBankSelection } from '@/lib/api/banks';
import { logger } from '@/lib/logger';

/**
 * POST /api/onboarding/select-banks
 * Saves initial bank selection for a new FREE user.
 *
 * Body: { bankIds: string[] }
 * Validates: exactly 3 banks, all prebuilt (is_custom=false, is_public=true), user is FREE tier.
 */
export async function POST(request: Request) {
  try {
    const { user, error: authError } = await getAuthenticatedUser();
    if (authError) return authError;

    const body = await request.json() as { bankIds?: unknown };

    const validationError = await validateAndSaveBankSelection(
      user.id,
      body.bankIds,
      'onboardingSelectBanks'
    );
    if (validationError) return validationError;

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Unexpected error in onboarding bank selection', error, {
      operation: 'onboardingSelectBanks',
    });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
