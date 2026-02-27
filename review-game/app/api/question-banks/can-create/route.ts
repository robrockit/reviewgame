import { NextResponse } from 'next/server';
import { createAdminServerClient } from '@/lib/admin/auth';
import { logger } from '@/lib/logger';
import { canCreateCustomBank, getRemainingCustomBankSlots } from '@/lib/access-control/banks';

/**
 * GET /api/question-banks/can-create
 * Returns whether the authenticated user can create custom banks and remaining slots.
 *
 * This endpoint is optimized for UI components to:
 * - Enable/disable "Create Bank" buttons
 * - Show usage meters like "3 of 15 banks used"
 * - Display upgrade prompts when at limit
 *
 * Access Rules (RG-108):
 * - FREE: canCreate = false, slotsRemaining = 0
 * - BASIC: canCreate = true if count < 15, slotsRemaining = 15 - count
 * - PREMIUM: canCreate = true, slotsRemaining = null (unlimited)
 *
 * @returns {Object} JSON response with creation status
 * @returns {boolean} canCreate - Whether user can create a new custom bank
 * @returns {number|null} slotsRemaining - Remaining slots (null = unlimited, 0 = at limit)
 * @returns {string} currentTier - User's subscription tier
 * @returns {number} currentCount - Current custom bank count
 * @returns {number|null} maxLimit - Maximum custom banks allowed (null = unlimited)
 *
 * @example Response (BASIC user with 3 banks)
 * {
 *   "canCreate": true,
 *   "slotsRemaining": 12,
 *   "currentTier": "BASIC",
 *   "currentCount": 3,
 *   "maxLimit": 15
 * }
 *
 * @example Response (PREMIUM user)
 * {
 *   "canCreate": true,
 *   "slotsRemaining": null,
 *   "currentTier": "PREMIUM",
 *   "currentCount": 42,
 *   "maxLimit": null
 * }
 */
export async function GET() {
  try {
    const supabase = await createAdminServerClient();

    // 1. Authenticate user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // 2. Fetch profile for tier and count information
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('subscription_tier, custom_bank_count, custom_bank_limit')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      logger.error('Failed to fetch user profile', profileError, {
        operation: 'canCreateCustomBank',
        userId: user.id,
      });
      return NextResponse.json(
        { error: 'Failed to verify user profile' },
        { status: 500 }
      );
    }

    // 3. Check if user can create custom banks
    const canCreate = await canCreateCustomBank(user.id, supabase);

    // 4. Get remaining custom bank slots
    const slotsRemaining = await getRemainingCustomBankSlots(user.id, supabase);

    logger.info('Custom bank creation status fetched', {
      operation: 'canCreateCustomBank',
      userId: user.id,
      canCreate,
      slotsRemaining,
      tier: profile.subscription_tier,
    });

    // 5. Return creation status with tier information
    return NextResponse.json({
      canCreate,
      slotsRemaining,
      currentTier: profile.subscription_tier?.toUpperCase() || 'FREE',
      currentCount: profile.custom_bank_count ?? 0,
      maxLimit: profile.custom_bank_limit,
    });

  } catch (error) {
    logger.error('Failed to check custom bank creation status', error, {
      operation: 'canCreateCustomBank',
    });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
