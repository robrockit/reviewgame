/**
 * @fileoverview Server-side Supabase utilities for Stripe integration.
 *
 * This module provides server-side functions for managing the relationship
 * between Supabase user profiles and Stripe customer records.
 *
 * @module lib/supabase/server
 */

import { stripe } from "@/lib/stripe/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { logger } from "@/lib/logger";

/**
 * Creates a new Stripe customer or retrieves an existing one for a Supabase user.
 *
 * This function checks if the user profile already has a Stripe customer ID.
 * If not, it creates a new Stripe customer with the user's email and UUID metadata,
 * then updates the Supabase profile with the new customer ID.
 *
 * This is essential for subscription management and payment processing.
 *
 * @param {SupabaseClient} supabase - Authenticated Supabase client instance
 * @param {Object} params - User identification parameters
 * @param {string} params.email - User's email address
 * @param {string} params.uuid - User's Supabase UUID
 * @returns {Promise<string>} The Stripe customer ID (existing or newly created)
 * @throws {Error} If there's an error updating the Supabase profile
 *
 * @example
 * ```tsx
 * const customerId = await createOrRetrieveCustomer(supabase, {
 *   email: 'user@example.com',
 *   uuid: 'abc-123-def-456'
 * });
 * ```
 */
export const createOrRetrieveCustomer = async (
  supabase: SupabaseClient,
  {
    email,
    uuid,
  }: {
    email: string;
    uuid: string;
  }
) => {

  const { data, error } = await supabase
    .from("profiles")
    .select("stripe_customer_id")
    .eq("id", uuid)
    .single();

  if (error || !data?.stripe_customer_id) {
    const customerData: { metadata: { supabaseUUID: string }; email?: string } =
      {
        metadata: {
          supabaseUUID: uuid,
        },
      };

    if (email) customerData.email = email;

    const customer = await stripe.customers.create(customerData);
    const { error: supabaseError } = await supabase
      .from("profiles")
      .update({ stripe_customer_id: customer.id })
      .eq("id", uuid);

    if (supabaseError) {
      throw supabaseError;
    }

    logger.info('New Stripe customer created and linked to profile', {
      userId: uuid,
      stripeCustomerId: customer.id,
      operation: 'createStripeCustomer',
    });
    return customer.id;
  }

  return data.stripe_customer_id;
};