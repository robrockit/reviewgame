import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/api/auth';
import { validateAndSaveBankSelection } from '@/lib/api/banks';
import { logger } from '@/lib/logger';

/**
 * PUT /api/users/me/banks
 * Updates bank selection for an existing FREE user from settings.
 *
 * Body: { bankIds: string[] }
 * Validates: exactly 3 banks, all prebuilt (is_custom=false, is_public=true), user is FREE tier.
 */
export async function PUT(request: Request) {
  try {
    const { user, error: authError } = await getAuthenticatedUser();
    if (authError) return authError;

    const body = await request.json() as { bankIds?: unknown };

    const validationError = await validateAndSaveBankSelection(
      user.id,
      body.bankIds,
      'updateUserBanks'
    );
    if (validationError) return validationError;

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Unexpected error in user bank update', error, {
      operation: 'updateUserBanks',
    });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
