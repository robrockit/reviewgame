import { NextResponse } from 'next/server';
import { createAdminServerClient } from '@/lib/admin/auth';
import { logger } from '@/lib/logger';
import { getAccessibleBanks } from '@/lib/access-control/banks';

/**
 * GET /api/question-banks/accessible
 * Returns question banks accessible to the authenticated user based on subscription tier.
 *
 * This endpoint is optimized for UI components like dropdowns and selection lists.
 * It applies RG-108 access control rules:
 * - FREE: Only banks in accessible_prebuilt_bank_ids + owned custom banks
 * - BASIC: All prebuilt banks + owned custom banks (max 15 custom)
 * - PREMIUM: All prebuilt banks + owned custom banks (unlimited)
 *
 * @returns {Object} JSON response with accessible banks array
 * @returns {Array} data - Array of accessible question banks
 *
 * @example Response
 * {
 *   "data": [
 *     {
 *       "id": "uuid",
 *       "title": "Math Basics",
 *       "subject": "Mathematics",
 *       "is_custom": false,
 *       "is_public": true,
 *       ...
 *     }
 *   ]
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

    // 2. Get accessible banks using RG-108 access control
    const banks = await getAccessibleBanks(user.id, supabase);

    // 3. Transform to lightweight format for UI dropdowns (id, title, subject, is_custom only)
    // This reduces payload size compared to the main GET /api/question-banks route
    const lightweightBanks = banks.map(bank => ({
      id: bank.id,
      title: bank.title,
      subject: bank.subject,
      is_custom: bank.is_custom,
      is_public: bank.is_public,
    }));

    logger.info('Accessible question banks fetched', {
      operation: 'getAccessibleQuestionBanks',
      userId: user.id,
      count: lightweightBanks.length,
    });

    // 4. Return lightweight bank list optimized for UI components
    return NextResponse.json({ data: lightweightBanks });

  } catch (error) {
    logger.error('Failed to fetch accessible question banks', error, {
      operation: 'getAccessibleQuestionBanks',
    });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
