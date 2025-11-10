/**
 * @fileoverview Stripe client-side configuration and initialization.
 *
 * This module provides a singleton Stripe instance for client-side operations
 * such as payment processing, checkout sessions, and subscription management.
 *
 * @module lib/stripe/client
 */

import { loadStripe, Stripe } from "@stripe/stripe-js";

/**
 * Cached Stripe instance promise to prevent multiple initializations.
 * @type {Promise<Stripe | null>}
 */
let stripePromise: Promise<Stripe | null>;

/**
 * Gets or initializes the Stripe client instance.
 *
 * This function implements a singleton pattern to ensure Stripe is only loaded once.
 * It uses the publishable key from environment variables, checking for the live key
 * first, then falling back to the test key.
 *
 * The function returns a promise that resolves to the Stripe instance, which can
 * be used for client-side payment operations like redirectToCheckout or confirmCardPayment.
 *
 * Required environment variables:
 * - NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY_LIVE (production)
 * - NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY (development/test)
 *
 * @returns {Promise<Stripe | null>} Promise that resolves to the Stripe instance
 *
 * @example
 * ```tsx
 * import { getStripe } from '@/lib/stripe/client';
 *
 * const handleCheckout = async () => {
 *   const stripe = await getStripe();
 *   if (stripe) {
 *     await stripe.redirectToCheckout({ sessionId: 'cs_test_...' });
 *   }
 * };
 * ```
 */
export const getStripe = () => {
  if (!stripePromise) {
    stripePromise = loadStripe(
      process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY_LIVE ??
        process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ??
        ""
    );
  }
  return stripePromise;
};