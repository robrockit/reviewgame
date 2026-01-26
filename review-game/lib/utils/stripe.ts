/**
 * @fileoverview Stripe utility functions
 *
 * Provides reusable utilities for Stripe API interactions
 *
 * @module lib/utils/stripe
 */

import Stripe from 'stripe';
import { logger } from '@/lib/logger';

/**
 * Timeout wrapper for Stripe API calls
 * Prevents requests from hanging indefinitely
 *
 * @param promise - The Stripe API promise to wrap
 * @param timeoutMs - Timeout in milliseconds (default: 10000ms)
 * @returns The promise result or throws timeout error
 *
 * @example
 * ```typescript
 * const subscription = await fetchWithTimeout(
 *   stripe.subscriptions.retrieve(subscriptionId),
 *   10000
 * );
 * ```
 */
export async function fetchWithTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number = 10000
): Promise<T> {
  const timeout = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error('Stripe API request timeout')), timeoutMs);
  });

  return Promise.race([promise, timeout]);
}

/**
 * Extended Stripe Subscription interface with guaranteed properties
 */
export interface StripeSubscriptionWithFields extends Stripe.Subscription {
  current_period_end: number;
  current_period_start: number;
  cancel_at_period_end: boolean;
  cancel_at: number | null;
}

/**
 * Type guard to validate Stripe subscription has required fields
 *
 * @param sub - Stripe subscription object to validate
 * @returns true if subscription has all required fields
 *
 * @example
 * ```typescript
 * const subscription = await stripe.subscriptions.retrieve(id);
 * if (!isValidSubscription(subscription)) {
 *   throw new Error('Invalid subscription structure');
 * }
 * // TypeScript now knows subscription has required fields
 * const periodEnd = subscription.current_period_end;
 * ```
 */
export function isValidSubscription(
  sub: Stripe.Subscription
): sub is StripeSubscriptionWithFields {
  // Use type assertion to check properties that TypeScript doesn't recognize
  const s = sub as unknown as StripeSubscriptionWithFields;
  return (
    typeof s.current_period_end === 'number' &&
    typeof s.current_period_start === 'number' &&
    typeof s.cancel_at_period_end === 'boolean' &&
    (s.cancel_at === null || typeof s.cancel_at === 'number')
  );
}

/**
 * Verify subscription ownership
 *
 * Ensures the subscription belongs to the user making the request.
 * This is a critical security check to prevent unauthorized subscription manipulation.
 *
 * @param subscription - Stripe subscription object
 * @param expectedCustomerId - Expected Stripe customer ID
 * @param userId - User ID for logging
 * @param operation - Operation name for logging
 * @returns true if ownership is verified
 * @throws Error if ownership verification fails
 *
 * @example
 * ```typescript
 * const subscription = await stripe.subscriptions.retrieve(subscriptionId);
 * verifySubscriptionOwnership(
 *   subscription,
 *   profile.stripe_customer_id,
 *   user.id,
 *   'cancelSubscription'
 * );
 * ```
 */
export function verifySubscriptionOwnership(
  subscription: Stripe.Subscription,
  expectedCustomerId: string | null,
  userId: string,
  operation: string
): void {
  if (!expectedCustomerId) {
    logger.error('User has no Stripe customer ID', new Error('Missing customer ID'), {
      operation,
      userId,
    });
    throw new Error('No billing account found');
  }

  if (subscription.customer !== expectedCustomerId) {
    logger.error('Subscription ownership mismatch', new Error('Security violation'), {
      operation,
      userId,
      subscriptionCustomer: subscription.customer,
      profileCustomer: expectedCustomerId,
    });
    throw new Error('Unauthorized access to subscription');
  }
}

/**
 * Validation constant for Stripe price IDs
 */
export const STRIPE_PRICE_ID_PATTERN = /^price_[a-zA-Z0-9]{24,}$/;

/**
 * Validate Stripe price ID format
 *
 * @param priceId - Price ID to validate
 * @returns true if format is valid
 *
 * @example
 * ```typescript
 * if (!isValidPriceId(priceId)) {
 *   throw new Error('Invalid price ID format');
 * }
 * ```
 */
export function isValidPriceId(priceId: string): boolean {
  return STRIPE_PRICE_ID_PATTERN.test(priceId);
}
