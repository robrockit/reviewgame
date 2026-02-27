/**
 * Bank Access Control Module
 *
 * Implements granular access control for question banks using RG-107 schema.
 * Enforces tier-based restrictions on prebuilt and custom bank access.
 *
 * Access Control Rules:
 * - FREE: Only accessible_prebuilt_bank_ids OR owned custom banks
 * - BASIC: All prebuilt banks OR owned custom banks (max 15 custom)
 * - PREMIUM: All prebuilt banks OR owned custom banks (unlimited)
 *
 * @module lib/access-control/banks
 */

import type { Tables } from '@/types/database.types';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createAdminServerClient } from '@/lib/admin/auth';
import { logger } from '@/lib/logger';

// Type aliases for database tables
type Profile = Tables<'profiles'>;
type QuestionBank = Tables<'question_banks'>;

// Re-export helper types for convenience
export type { Profile, QuestionBank };

/**
 * Profile data required for bank access checks
 */
type BankAccessProfile = Pick<Profile, 'id' | 'subscription_tier' | 'accessible_prebuilt_bank_ids'>;

/**
 * Profile data required for creation limit checks
 */
type CreationLimitProfile = Pick<Profile, 'subscription_tier' | 'custom_bank_limit' | 'custom_bank_count'>;

/**
 * Bank data required for access checks
 */
type BankAccessInfo = Pick<QuestionBank, 'id' | 'is_custom' | 'owner_id'>;

/**
 * Synchronous utility to check if a user profile can access a specific bank.
 * Used for batching operations to avoid N+1 queries.
 *
 * @param profile - User profile with subscription data (partial)
 * @param bank - Question bank to check access for (partial)
 * @returns true if user can access the bank, false otherwise
 *
 * @remarks
 * This is a synchronous utility function for performance-critical batching.
 * For single bank checks, prefer the async {@link canAccessBank} function.
 *
 * Access Rules:
 * - Custom banks: Only owner can access (bank.owner_id === profile.id)
 * - Prebuilt banks (FREE): Only if bankId in accessible_prebuilt_bank_ids
 * - Prebuilt banks (BASIC/PREMIUM): All prebuilt banks accessible
 *
 * @example
 * ```typescript
 * // GOOD: Fetch once, check many
 * const profile = await fetchProfile(userId);
 * const accessibleBanks = banks.filter(bank => _checkCanAccessBank(profile, bank));
 *
 * // AVOID: N+1 queries
 * for (const bank of banks) {
 *   await canAccessBank(userId, bank.id); // Bad!
 * }
 * ```
 */
export function _checkCanAccessBank(profile: BankAccessProfile, bank: BankAccessInfo): boolean {
  // Custom banks: Only owner can access
  if (bank.is_custom) {
    return bank.owner_id === profile.id;
  }

  // Prebuilt banks: Check tier-based access
  const tier = profile.subscription_tier?.toUpperCase();

  // BASIC and PREMIUM can access all prebuilt banks
  if (tier === 'BASIC' || tier === 'PREMIUM') {
    return true;
  }

  // FREE tier: Check accessible_prebuilt_bank_ids array
  // Treat NULL as [] (no access) - fail-secure
  if (!profile.accessible_prebuilt_bank_ids) {
    return false;
  }

  // Check if bank ID is in the accessible array
  // JSONB columns can contain any JSON, so validate element types defensively
  const accessibleIds = profile.accessible_prebuilt_bank_ids;
  if (Array.isArray(accessibleIds)) {
    // Filter to only string elements (defensive programming)
    // If database contains malformed data like [{"id": "bank-1"}] or [123],
    // we safely skip non-string elements rather than failing open
    const stringIds = accessibleIds.filter((id): id is string => typeof id === 'string');
    return stringIds.includes(bank.id);
  }

  return false;
}

/**
 * Synchronous utility to check if a user profile can create custom banks.
 * Used for batching operations to avoid N+1 queries.
 *
 * @param profile - User profile with subscription data (partial)
 * @returns true if user can create custom banks, false otherwise
 *
 * @remarks
 * This is a synchronous utility function for performance-critical batching.
 * For single checks, prefer the async {@link canCreateCustomBank} function.
 *
 * Creation Rules:
 * - FREE: Never allowed (custom_bank_limit = 0)
 * - BASIC: Allowed if custom_bank_count < 15
 * - PREMIUM: Always allowed (custom_bank_limit = NULL = unlimited)
 *
 * @example
 * ```typescript
 * const profile = await fetchProfile(userId);
 * if (_checkCanCreateCustomBank(profile)) {
 *   // Show create bank UI
 * }
 * ```
 */
export function _checkCanCreateCustomBank(profile: CreationLimitProfile): boolean {
  const tier = profile.subscription_tier?.toUpperCase();

  // FREE tier: Never allowed
  if (tier === 'FREE') {
    return false;
  }

  // PREMIUM tier: Always unlimited, regardless of custom_bank_limit value
  // This handles edge cases where custom_bank_limit is non-null due to
  // migration issues, manual DB edits, or subscription tier changes
  if (tier === 'PREMIUM') {
    return true;
  }

  // BASIC tier: Check if under limit
  if (tier === 'BASIC') {
    // custom_bank_limit should be 15 for BASIC, but check defensively
    const limit = profile.custom_bank_limit ?? 15;
    const count = profile.custom_bank_count ?? 0;
    return count < limit;
  }

  // Unknown tier: fail-secure
  return false;
}

/**
 * Checks if a user can access a specific question bank.
 * Handles both prebuilt and custom bank access rules based on subscription tier.
 *
 * @param userId - UUID of the user
 * @param bankId - UUID of the question bank
 * @param supabase - Optional Supabase client (creates new if not provided)
 * @returns Promise<boolean> - true if user can access the bank, false otherwise
 *
 * @remarks
 * - Returns false for missing profile or bank (fail-secure)
 * - Uses single JOIN query for optimal performance
 * - Custom banks: Only owner can access
 * - Prebuilt banks: Tier-based filtering (FREE limited, BASIC/PREMIUM full access)
 *
 * @throws {Error} Only throws for unexpected database errors, not for access denial
 *
 * @example
 * ```typescript
 * const canAccess = await canAccessBank(user.id, bankId);
 * if (!canAccess) {
 *   return NextResponse.json({ error: 'Access denied' }, { status: 403 });
 * }
 * ```
 */
export async function canAccessBank(
  userId: string,
  bankId: string,
  supabase?: SupabaseClient
): Promise<boolean> {
  const client = supabase ?? (await createAdminServerClient());

  try {
    // Fetch profile and bank separately (two queries)
    // Note: Could be optimized to a single JOIN query in the future,
    // but separate queries are simpler and performance is acceptable
    const { data: profile, error: profileError } = await client
      .from('profiles')
      .select('id, subscription_tier, accessible_prebuilt_bank_ids')
      .eq('id', userId)
      .single();

    if (profileError || !profile) {
      logger.error('Profile not found in canAccessBank', profileError || new Error('Profile not found'), {
        operation: 'canAccessBank',
        userId,
        bankId,
      });
      return false; // Fail-secure
    }

    const { data: bank, error: bankError } = await client
      .from('question_banks')
      .select('id, is_custom, owner_id')
      .eq('id', bankId)
      .single();

    if (bankError || !bank) {
      logger.error('Bank not found in canAccessBank', bankError || new Error('Bank not found'), {
        operation: 'canAccessBank',
        userId,
        bankId,
      });
      return false; // Fail-secure
    }

    // Use synchronous utility for the actual check
    return _checkCanAccessBank(profile, bank);
  } catch (error) {
    logger.error('Unexpected error in canAccessBank', error, {
      operation: 'canAccessBank',
      userId,
      bankId,
    });
    throw error; // Re-throw system errors
  }
}

/**
 * Checks if a user can create a new custom question bank.
 * Enforces tier-based limits on custom bank creation.
 *
 * @param userId - UUID of the user
 * @param supabase - Optional Supabase client (creates new if not provided)
 * @returns Promise<boolean> - true if user can create custom banks, false otherwise
 *
 * @remarks
 * - Returns false for missing profile (fail-secure)
 * - FREE: Never allowed (custom_bank_limit = 0)
 * - BASIC: Allowed if custom_bank_count < 15
 * - PREMIUM: Always allowed (custom_bank_limit = NULL = unlimited)
 *
 * @throws {Error} Only throws for unexpected database errors, not for access denial
 *
 * @example
 * ```typescript
 * const canCreate = await canCreateCustomBank(user.id);
 * if (!canCreate) {
 *   return NextResponse.json({ error: 'Custom bank limit reached' }, { status: 403 });
 * }
 * ```
 */
export async function canCreateCustomBank(
  userId: string,
  supabase?: SupabaseClient
): Promise<boolean> {
  const client = supabase ?? (await createAdminServerClient());

  try {
    const { data: profile, error } = await client
      .from('profiles')
      .select('subscription_tier, custom_bank_limit, custom_bank_count')
      .eq('id', userId)
      .single();

    if (error || !profile) {
      logger.error('Profile not found in canCreateCustomBank', error || new Error('Profile not found'), {
        operation: 'canCreateCustomBank',
        userId,
      });
      return false; // Fail-secure
    }

    // Use synchronous utility for the actual check
    return _checkCanCreateCustomBank(profile);
  } catch (error) {
    logger.error('Unexpected error in canCreateCustomBank', error, {
      operation: 'canCreateCustomBank',
      userId,
    });
    throw error; // Re-throw system errors
  }
}

/**
 * Gets all question banks accessible to a user.
 * Returns prebuilt banks (filtered by tier) + owned custom banks.
 *
 * @param userId - UUID of the user
 * @param supabase - Optional Supabase client (creates new if not provided)
 * @returns Promise<QuestionBank[]> - Array of accessible banks
 *
 * @remarks
 * - Returns empty array for missing profile (fail-secure)
 * - FREE: Only banks in accessible_prebuilt_bank_ids + owned custom banks
 * - BASIC: All prebuilt banks + owned custom banks
 * - PREMIUM: All prebuilt banks + owned custom banks
 * - Optimized query with OR conditions for single database round-trip
 *
 * @throws {Error} Only throws for unexpected database errors
 *
 * @example
 * ```typescript
 * const banks = await getAccessibleBanks(user.id);
 * return NextResponse.json({ data: banks });
 * ```
 */
export async function getAccessibleBanks(
  userId: string,
  supabase?: SupabaseClient
): Promise<QuestionBank[]> {
  const client = supabase ?? (await createAdminServerClient());

  try {
    // First, fetch profile to determine tier
    const { data: profile, error: profileError } = await client
      .from('profiles')
      .select('id, subscription_tier, accessible_prebuilt_bank_ids')
      .eq('id', userId)
      .single();

    if (profileError || !profile) {
      logger.error('Profile not found in getAccessibleBanks', profileError || new Error('Profile not found'), {
        operation: 'getAccessibleBanks',
        userId,
      });
      return []; // Fail-secure
    }

    const tier = profile.subscription_tier?.toUpperCase();

    // Validate userId is a valid UUID (defense in depth)
    // While userId comes from supabase.auth.getUser() (trusted source),
    // we validate it for consistency with bankIds validation and defense in depth
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(userId)) {
      logger.error('Invalid userId format in getAccessibleBanks', new Error('Invalid UUID'), {
        operation: 'getAccessibleBanks',
        userId,
      });
      return []; // Fail-secure
    }

    // Build query based on tier
    let query = client.from('question_banks').select('*');

    if (tier === 'FREE') {
      // FREE: Only accessible prebuilt banks OR owned custom banks
      const accessibleIds = profile.accessible_prebuilt_bank_ids;
      const bankIds = Array.isArray(accessibleIds) ? accessibleIds : [];

      if (bankIds.length > 0) {
        // Validate that all IDs are strings and match UUID format before string interpolation
        // This prevents SQL injection through malformed JSONB data
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        const validBankIds = bankIds
          .filter((id): id is string => typeof id === 'string')
          .filter(id => uuidRegex.test(id));

        if (validBankIds.length > 0) {
          // Has accessible banks: (id IN validBankIds AND is_custom = false) OR (owner_id = userId AND is_custom = true)
          query = query.or(
            `and(id.in.(${validBankIds.join(',')}),is_custom.eq.false),and(owner_id.eq.${userId},is_custom.eq.true)`
          );
        } else {
          // No valid bank IDs: Only owned custom banks
          logger.warn('No valid UUIDs in accessible_prebuilt_bank_ids', {
            operation: 'getAccessibleBanks',
            userId,
            rawBankIds: bankIds,
          });
          query = query.eq('owner_id', userId).eq('is_custom', true);
        }
      } else {
        // No accessible banks: Only owned custom banks
        query = query.eq('owner_id', userId).eq('is_custom', true);
      }
    } else {
      // BASIC/PREMIUM: All prebuilt banks OR owned custom banks
      query = query.or(`is_custom.eq.false,and(owner_id.eq.${userId},is_custom.eq.true)`);
    }

    const { data: banks, error: banksError } = await query.order('title');

    if (banksError) {
      logger.error('Failed to fetch accessible banks', banksError, {
        operation: 'getAccessibleBanks',
        userId,
        tier,
      });
      throw banksError;
    }

    return banks || [];
  } catch (error) {
    logger.error('Unexpected error in getAccessibleBanks', error, {
      operation: 'getAccessibleBanks',
      userId,
    });
    throw error; // Re-throw system errors
  }
}

/**
 * Gets the remaining custom bank creation slots for a user.
 * Used to display "X of Y banks used" in the UI.
 *
 * @param userId - UUID of the user
 * @param supabase - Optional Supabase client (creates new if not provided)
 * @returns Promise<number | null> - Remaining slots (number), unlimited (null), or at limit (0)
 *
 * @remarks
 * - Returns 0 for missing profile (fail-secure)
 * - FREE: Always returns 0 (no custom banks allowed)
 * - BASIC: Returns (15 - custom_bank_count)
 * - PREMIUM: Returns null (unlimited)
 *
 * @throws {Error} Only throws for unexpected database errors
 *
 * @example
 * ```typescript
 * const remaining = await getRemainingCustomBankSlots(user.id);
 * if (remaining === null) {
 *   console.log('Unlimited banks');
 * } else if (remaining === 0) {
 *   console.log('At limit');
 * } else {
 *   console.log(`${remaining} banks remaining`);
 * }
 * ```
 */
export async function getRemainingCustomBankSlots(
  userId: string,
  supabase?: SupabaseClient
): Promise<number | null> {
  const client = supabase ?? (await createAdminServerClient());

  try {
    const { data: profile, error } = await client
      .from('profiles')
      .select('subscription_tier, custom_bank_limit, custom_bank_count')
      .eq('id', userId)
      .single();

    if (error || !profile) {
      logger.error('Profile not found in getRemainingCustomBankSlots', error || new Error('Profile not found'), {
        operation: 'getRemainingCustomBankSlots',
        userId,
      });
      return 0; // Fail-secure
    }

    const tier = profile.subscription_tier?.toUpperCase();

    // FREE tier: No custom banks allowed
    if (tier === 'FREE') {
      return 0;
    }

    // PREMIUM tier: Always unlimited, regardless of custom_bank_limit value
    // This handles edge cases where custom_bank_limit is non-null due to
    // migration issues, manual DB edits, or subscription tier changes
    if (tier === 'PREMIUM') {
      return null; // null = unlimited
    }

    // BASIC tier: Calculate remaining slots
    const limit = profile.custom_bank_limit ?? 15;
    const count = profile.custom_bank_count ?? 0;
    const remaining = Math.max(0, limit - count);

    return remaining;
  } catch (error) {
    logger.error('Unexpected error in getRemainingCustomBankSlots', error, {
      operation: 'getRemainingCustomBankSlots',
      userId,
    });
    throw error; // Re-throw system errors
  }
}
