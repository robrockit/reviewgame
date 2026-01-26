/**
 * @fileoverview API route for users to change their subscription plan
 *
 * POST /api/subscription/update-plan
 * Allows users to upgrade, downgrade, or change billing cycle
 *
 * @module app/api/subscription/update-plan
 */

import { NextResponse, type NextRequest } from 'next/server';
import Stripe from 'stripe';
import { getAuthenticatedUser } from '@/lib/api/auth';
import { fetchWithTimeout, verifySubscriptionOwnership, isValidPriceId } from '@/lib/utils/stripe';
import { logger } from '@/lib/logger';
import type { UpdatePlanRequest, UpdatePlanResponse } from '@/types/subscription.types';

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
 * Extended Stripe Subscription interface with properties we need
 */
interface StripeSubscriptionWithFields extends Stripe.Subscription {
  current_period_end: number;
}

/**
 * POST /api/subscription/update-plan
 *
 * Updates the authenticated user's subscription to a new plan
 */
export async function POST(req: NextRequest) {
  try {
    // Authenticate user using shared utility
    const { user, supabase, error } = await getAuthenticatedUser();
    if (error) return error;

    // Parse request body
    const body: UpdatePlanRequest = await req.json();
    const { new_price_id } = body;

    // Validate new_price_id
    if (!new_price_id) {
      return NextResponse.json(
        { error: 'Missing required field: new_price_id' },
        { status: 400 }
      );
    }

    // Validate price ID format (defense in depth)
    if (!isValidPriceId(new_price_id)) {
      logger.warn('Invalid price ID format detected', {
        operation: 'updateSubscriptionPlan',
        userId: user.id,
        invalidPriceId: new_price_id,
      });
      return NextResponse.json(
        { error: 'Invalid price ID format' },
        { status: 400 }
      );
    }

    // Validate price_id against whitelist of known price IDs
    const validPriceIds = [
      process.env.NEXT_PUBLIC_STRIPE_BASIC_MONTHLY_PRICE_ID,
      process.env.NEXT_PUBLIC_STRIPE_BASIC_ANNUAL_PRICE_ID,
      process.env.NEXT_PUBLIC_STRIPE_PREMIUM_MONTHLY_PRICE_ID,
      process.env.NEXT_PUBLIC_STRIPE_PREMIUM_ANNUAL_PRICE_ID,
    ].filter(Boolean);

    if (!validPriceIds.includes(new_price_id)) {
      logger.warn('Price ID not in whitelist', {
        operation: 'updateSubscriptionPlan',
        userId: user.id,
        rejectedPriceId: new_price_id,
      });
      return NextResponse.json(
        { error: 'Invalid price ID' },
        { status: 400 }
      );
    }

    // Fetch user's profile from database
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('stripe_subscription_id, stripe_customer_id, email')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      logger.error('Failed to fetch profile for plan update', new Error(profileError?.message || 'Profile not found'), {
        userId: user.id,
        operation: 'updateSubscriptionPlan',
      });
      return NextResponse.json(
        { error: 'Profile not found' },
        { status: 404 }
      );
    }

    // Check if user has an active subscription
    if (!profile.stripe_subscription_id) {
      return NextResponse.json(
        { error: 'No active subscription found. Please subscribe first.' },
        { status: 400 }
      );
    }

    const response: UpdatePlanResponse = {
      success: false,
    };

    try {
      // Get current subscription from Stripe and verify ownership
      const currentSubscription = await fetchWithTimeout(
        stripe.subscriptions.retrieve(profile.stripe_subscription_id),
        10000
      );

      verifySubscriptionOwnership(
        currentSubscription,
        profile.stripe_customer_id,
        user.id,
        'updateSubscriptionPlan'
      );

      // Get the current subscription item ID
      const subscriptionItemId = currentSubscription.items.data[0]?.id;

      if (!subscriptionItemId) {
        throw new Error('No subscription items found');
      }

      // Update subscription with proration
      const updatedSubscription = await fetchWithTimeout(
        stripe.subscriptions.update(profile.stripe_subscription_id, {
          items: [
            {
              id: subscriptionItemId,
              price: new_price_id,
            },
          ],
          proration_behavior: 'always_invoice',
        }),
        10000
      );

      // Type assertion for Stripe subscription properties
      const sub = updatedSubscription as unknown as StripeSubscriptionWithFields;
      const prorationDescription = 'Proration will be applied on your next invoice';

      response.success = true;
      response.subscription = {
        id: sub.id,
        status: sub.status,
        priceId: new_price_id,
        currentPeriodEnd: new Date(sub.current_period_end * 1000).toISOString(),
      };
      response.proration = {
        amount: 0, // Actual amount will be calculated by Stripe on next invoice
        description: prorationDescription,
      };

      logger.info('User updated their subscription plan', {
        userId: user.id,
        subscriptionId: profile.stripe_subscription_id,
        newPriceId: new_price_id,
        operation: 'updateSubscriptionPlan',
      });
    } catch (stripeError) {
      const err = stripeError instanceof Error ? stripeError : new Error(String(stripeError));
      logger.error('Failed to update subscription plan in Stripe', err, {
        userId: user.id,
        subscriptionId: profile.stripe_subscription_id,
        newPriceId: new_price_id,
        operation: 'updateStripeSubscriptionPlan',
      });
      response.error = err.message === 'Stripe API request timeout'
        ? 'Stripe API timeout - please try again'
        : err.message.includes('Unauthorized')
        ? 'Unauthorized access to subscription'
        : 'Failed to update subscription plan';
      return NextResponse.json(response, { status: 500 });
    }

    return NextResponse.json(response);
  } catch (error) {
    logger.error('Error in POST /api/subscription/update-plan', error instanceof Error ? error : new Error(String(error)), {
      operation: 'updateSubscriptionPlan',
    });

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
