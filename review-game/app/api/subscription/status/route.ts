/**
 * @fileoverview API route for fetching user subscription status
 *
 * GET /api/subscription/status
 * Returns current subscription details for the authenticated user
 *
 * @module app/api/subscription/status/route
 */

import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { getAuthenticatedUser } from '@/lib/api/auth';
import { fetchWithTimeout, isValidSubscription, verifySubscriptionOwnership } from '@/lib/utils/stripe';
import { logger } from '@/lib/logger';
import type { SubscriptionStatusResponse } from '@/types/subscription.types';

// Validate Stripe API key is configured
if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('STRIPE_SECRET_KEY environment variable is not configured');
}

// Initialize Stripe with API version pinning for stability
// Using latest Clover version (2025-12-15) as of January 2026
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2025-12-15.clover',
  typescript: true,
});

/**
 * GET /api/subscription/status
 *
 * Fetches the authenticated user's subscription details
 */
export async function GET() {
  try {
    // Authenticate user using shared utility
    const { user, supabase, error } = await getAuthenticatedUser();
    if (error) return error;

    // Fetch user profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('stripe_subscription_id, stripe_customer_id, subscription_tier, subscription_status, current_period_end, trial_end_date, games_created_count')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      logger.error('Failed to fetch profile for subscription status', new Error(profileError?.message || 'Profile not found'), {
        userId: user.id,
        operation: 'getSubscriptionStatus',
      });
      return NextResponse.json(
        { error: 'Profile not found' },
        { status: 404 }
      );
    }

    // Initialize response with database data
    const tier = (profile.subscription_tier?.toUpperCase() as 'FREE' | 'BASIC' | 'PREMIUM') || 'FREE';
    const response: SubscriptionStatusResponse = {
      subscription_tier: tier,
      subscription_status: (profile.subscription_status?.toUpperCase() as 'TRIAL' | 'ACTIVE' | 'INACTIVE' | 'CANCELLED') || 'INACTIVE',
      billing_cycle: null,
      current_period_end: profile.current_period_end,
      trial_end_date: profile.trial_end_date,
      cancel_at_period_end: false,
      cancel_at: null,
      stripe_subscription: null,
      games_created_count: profile.games_created_count ?? 0,
      games_limit: tier === 'FREE' ? 3 : null,
    };

    // If user has a Stripe subscription ID, fetch additional details from Stripe
    if (profile.stripe_subscription_id) {
      try {
        const subscription = await fetchWithTimeout(
          stripe.subscriptions.retrieve(profile.stripe_subscription_id),
          10000
        );

        // Verify subscription ownership (security check)
        verifySubscriptionOwnership(
          subscription,
          profile.stripe_customer_id,
          user.id,
          'getSubscriptionStatus'
        );

        // Validate subscription structure with type guard
        if (!isValidSubscription(subscription)) {
          logger.error('Invalid subscription structure from Stripe', new Error('Type validation failed'), {
            operation: 'getSubscriptionStatus',
            subscriptionId: profile.stripe_subscription_id,
            userId: user.id,
          });
          throw new Error('Invalid subscription data');
        }

        // Determine billing cycle from subscription items
        const price = subscription.items.data[0]?.price;
        const billingInterval = price?.recurring?.interval;

        response.billing_cycle = billingInterval === 'month' ? 'monthly' : billingInterval === 'year' ? 'annual' : null;
        response.cancel_at_period_end = subscription.cancel_at_period_end || false;
        response.cancel_at = subscription.cancel_at;
        response.stripe_subscription = {
          id: subscription.id,
          current_period_end: subscription.current_period_end,
          current_period_start: subscription.current_period_start,
          items: subscription.items.data.map(item => ({
            price: {
              id: item.price.id,
              unit_amount: item.price.unit_amount,
              recurring: item.price.recurring,
            },
          })),
        };

        logger.info('Subscription status fetched successfully', {
          userId: user.id,
          subscriptionId: profile.stripe_subscription_id,
          operation: 'getSubscriptionStatus',
        });
      } catch (stripeError) {
        const err = stripeError instanceof Error ? stripeError : new Error(String(stripeError));
        logger.error('Failed to fetch subscription from Stripe', err, {
          userId: user.id,
          subscriptionId: profile.stripe_subscription_id,
          operation: 'fetchStripeSubscription',
        });
        // Don't fail the request - return database data without Stripe details
      }
    }

    return NextResponse.json(response);
  } catch (error) {
    logger.error('Error in GET /api/subscription/status', error instanceof Error ? error : new Error(String(error)), {
      operation: 'getSubscriptionStatus',
    });

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
