/**
 * @fileoverview Helper functions for handling impersonation context.
 *
 * These utilities check for active impersonation sessions and return the effective
 * user ID to use for queries. This enables admins to view the application as another user.
 *
 * @module lib/admin/impersonation
 */

import { headers } from 'next/headers';
import { logger } from '@/lib/logger';

/**
 * Information about the current request context (admin or impersonated user)
 */
export interface RequestContext {
  /** The user ID to use for queries (impersonated user if active, otherwise current user) */
  effectiveUserId: string;
  /** The actual authenticated admin user ID (always present) */
  adminUserId: string;
  /** Whether impersonation is active */
  isImpersonating: boolean;
  /** The impersonated user's ID (only present during impersonation) */
  impersonatedUserId?: string;
  /** The impersonation session ID (only present during impersonation) */
  sessionId?: string;
}

/**
 * Gets the current request context, checking for active impersonation.
 *
 * This function should be called in server components and API routes to determine
 * which user's data to show. During impersonation, queries should use the
 * impersonated user's ID instead of the admin's ID.
 *
 * SECURITY: This function assumes the middleware has already validated that:
 * - The user is authenticated
 * - If impersonating, the user is an admin with an active session
 *
 * @param currentUserId - The authenticated user's ID (from auth.uid())
 * @returns {Promise<RequestContext>} Context information for the current request
 *
 * @example
 * ```typescript
 * // In a server component or API route
 * const { data: { user } } = await supabase.auth.getUser();
 * const context = await getRequestContext(user.id);
 *
 * // Use context.effectiveUserId for queries
 * const { data: games } = await supabase
 *   .from('games')
 *   .select('*')
 *   .eq('created_by', context.effectiveUserId);
 *
 * if (context.isImpersonating) {
 *   console.log('Viewing as user:', context.impersonatedUserId);
 * }
 * ```
 */
export async function getRequestContext(currentUserId: string): Promise<RequestContext> {
  const headersList = await headers();

  // Check for impersonation headers set by middleware
  const impersonatedUserId = headersList.get('x-impersonating-user-id');
  const adminUserId = headersList.get('x-admin-user-id');
  const sessionId = headersList.get('x-impersonation-session-id');

  const isImpersonating = Boolean(impersonatedUserId && adminUserId && sessionId);

  if (isImpersonating) {
    // Log impersonation context usage for audit
    logger.info('Using impersonation context', {
      operation: 'getRequestContext',
      adminUserId,
      impersonatedUserId,
      sessionId,
    });

    return {
      effectiveUserId: impersonatedUserId!,
      adminUserId: adminUserId!,
      isImpersonating: true,
      impersonatedUserId: impersonatedUserId!,
      sessionId: sessionId!,
    };
  }

  // No impersonation - return current user
  return {
    effectiveUserId: currentUserId,
    adminUserId: currentUserId,
    isImpersonating: false,
  };
}

/**
 * Gets just the effective user ID (the user whose data should be shown).
 *
 * Convenience function that returns only the user ID to use for queries,
 * without the full context object.
 *
 * @param currentUserId - The authenticated user's ID (from auth.uid())
 * @returns {Promise<string>} The user ID to use for queries
 *
 * @example
 * ```typescript
 * const { data: { user } } = await supabase.auth.getUser();
 * const userId = await getEffectiveUserId(user.id);
 *
 * // Use this ID for all user-scoped queries
 * const { data: profile } = await supabase
 *   .from('profiles')
 *   .select('*')
 *   .eq('id', userId)
 *   .single();
 * ```
 */
export async function getEffectiveUserId(currentUserId: string): Promise<string> {
  const context = await getRequestContext(currentUserId);
  return context.effectiveUserId;
}

/**
 * Checks if the current request is in an impersonation context.
 *
 * @returns {Promise<boolean>} True if currently impersonating another user
 *
 * @example
 * ```typescript
 * const isImpersonating = await isImpersonatingUser();
 * if (isImpersonating) {
 *   console.log('Admin is viewing as another user');
 * }
 * ```
 */
export async function isImpersonatingUser(): Promise<boolean> {
  const headersList = await headers();
  return Boolean(
    headersList.get('x-impersonating-user-id') &&
    headersList.get('x-admin-user-id') &&
    headersList.get('x-impersonation-session-id')
  );
}
