/**
 * @fileoverview Stripe server-side configuration and initialization.
 *
 * This module provides a configured Stripe server-side instance for handling
 * payment processing, webhooks, subscriptions, and customer management.
 *
 * @module lib/stripe/server
 */

import Stripe from "stripe";

/**
 * Configured Stripe server-side instance.
 *
 * This instance is initialized with the secret API key from environment variables.
 * It checks for the live key first, then falls back to the test key.
 *
 * The instance is configured with app metadata for better tracking in Stripe logs
 * and analytics.
 *
 * Required environment variables:
 * - STRIPE_SECRET_KEY_LIVE (production)
 * - STRIPE_SECRET_KEY (development/test)
 *
 * @constant {Stripe}
 *
 * @example
 * ```tsx
 * import { stripe } from '@/lib/stripe/server';
 *
 * // Create a customer
 * const customer = await stripe.customers.create({
 *   email: 'user@example.com'
 * });
 *
 * // Create a checkout session
 * const session = await stripe.checkout.sessions.create({
 *   customer: customer.id,
 *   line_items: [{ price: 'price_123', quantity: 1 }],
 *   mode: 'subscription'
 * });
 * ```
 */
export const stripe = new Stripe(
  process.env.STRIPE_SECRET_KEY_LIVE ?? process.env.STRIPE_SECRET_KEY ?? "",
  {
    // https://github.com/stripe/stripe-node#configuration
    appInfo: {
      name: "Review Game",
      version: "0.1.0",
    },
  }
);