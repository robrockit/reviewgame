/**
 * @fileoverview Shared bank selection validation for API routes.
 *
 * Used by both /api/onboarding/select-banks (POST) and /api/users/me/banks (PUT)
 * to avoid duplicating the same validation and write logic.
 */

import { NextResponse } from 'next/server';
import { createAdminServerClient } from '@/lib/admin/auth';
import { logger } from '@/lib/logger';

/**
 * Validates that `bankIds` contains exactly 3 valid prebuilt public bank IDs,
 * that the user is on the FREE tier, and writes the selection to `profiles`.
 *
 * @param userId - Authenticated user's ID
 * @param bankIds - Unvalidated input from request body
 * @param operation - Operation name for logging context
 * @returns NextResponse error on any failure, null on success
 */
export async function validateAndSaveBankSelection(
  userId: string,
  bankIds: unknown,
  operation: string
): Promise<NextResponse | null> {
  if (!Array.isArray(bankIds) || bankIds.length !== 3) {
    return NextResponse.json(
      { error: 'Exactly 3 banks must be selected' },
      { status: 400 }
    );
  }

  if (!bankIds.every((id): id is string => typeof id === 'string')) {
    return NextResponse.json({ error: 'Invalid bank selection' }, { status: 400 });
  }

  // createAdminServerClient uses the ANON key + request cookies (not service role).
  // The caller (route handler) has already authenticated the user via
  // getAuthenticatedUser(), so the session cookie is present. RLS therefore
  // scopes the profile UPDATE to rows where auth.uid() = userId, which is exactly
  // what we want — users can only update their own bank selection.
  const supabase = await createAdminServerClient();

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('subscription_tier')
    .eq('id', userId)
    .single();

  if (profileError || !profile) {
    logger.error('Profile not found during bank selection', profileError, {
      operation,
      userId,
    });
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
  }

  if (profile.subscription_tier?.toUpperCase() !== 'FREE') {
    return NextResponse.json(
      { error: 'Only FREE tier users select specific banks' },
      { status: 403 }
    );
  }

  // Validate all selected banks exist and are prebuilt/public
  const { data: banks, error: bankError } = await supabase
    .from('question_banks')
    .select('id')
    .in('id', bankIds)
    .eq('is_custom', false)
    .eq('is_public', true);

  if (bankError) {
    logger.error('Failed to validate bank selection', bankError, {
      operation,
      userId,
    });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }

  if (!banks || banks.length !== 3) {
    return NextResponse.json({ error: 'Invalid bank selection' }, { status: 400 });
  }

  const { error: updateError } = await supabase
    .from('profiles')
    .update({ accessible_prebuilt_bank_ids: bankIds })
    .eq('id', userId);

  if (updateError) {
    logger.error('Failed to save bank selection', updateError, {
      operation,
      userId,
    });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }

  logger.info('Bank selection saved', {
    operation,
    userId,
    bankIds,
  });

  return null;
}
