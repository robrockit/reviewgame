/**
 * @fileoverview API route for users to reactivate canceled subscriptions
 *
 * POST /api/subscription/reactivate
 * Removes scheduled cancellation and restores ongoing billing
 *
 * @module app/api/subscription/reactivate
 */

import { NextResponse, type NextRequest } from 'next/server';
import Stripe from 'stripe';
import { getAuthenticatedUser } from '@/lib/api/auth';
import { fetchWithTimeout, verifySubscriptionOwnership } from '@/lib/utils/stripe';
import { logger } from '@/lib/logger';
import type { ReactivateSubscriptionResponse } from '@/types/subscription.types';

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
  cancel_at_period_end: boolean;
  current_period_end: number;
}

/**
 * POST /api/subscription/reactivate
 *
 * Removes scheduled cancellation from the authenticated user's subscription
 */
export async function POST(_req: NextRequest) {
  try {
    // Authenticate user using shared utility
    const { user, supabase, error } = await getAuthenticatedUser();
    if (error) return error;

    // Fetch user's profile from database
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('stripe_subscription_id, stripe_customer_id, email, subscription_status')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      logger.error('Failed to fetch profile for subscription reactivation', new Error(profileError?.message || 'Profile not found'), {
        userId: user.id,
        operation: 'reactivateSubscription',
      });
      return NextResponse.json(
        { error: 'Profile not found' },
        { status: 404 }
      );
    }

    // Check if user has a subscription
    if (!profile.stripe_subscription_id) {
      return NextResponse.json(
        { error: 'No subscription found to reactivate' },
        { status: 400 }
      );
    }

    const response: ReactivateSubscriptionResponse = {
      success: false,
    };

    try {
      // First, retrieve and verify ownership
      const existingSubscription = await fetchWithTimeout(
        stripe.subscriptions.retrieve(profile.stripe_subscription_id),
        10000
      );

      verifySubscriptionOwnership(
        existingSubscription,
        profile.stripe_customer_id,
        user.id,
        'reactivateSubscription'
      );

      // Reactivate subscription in Stripe by removing cancel_at_period_end
      const subscription = await fetchWithTimeout(
        stripe.subscriptions.update(profile.stripe_subscription_id, {
          cancel_at_period_end: false,
        }),
        10000
      ) as unknown as StripeSubscriptionWithFields;

      // Update database to reflect reactivation
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          subscription_status: subscription.status,
        })
        .eq('id', user.id);

      if (updateError) {
        logger.error('Failed to update database after subscription reactivation', new Error(updateError.message), {
          userId: user.id,
          subscriptionId: profile.stripe_subscription_id,
          operation: 'updateDatabaseAfterReactivate',
        });
        // Don't fail the request - Stripe is updated, webhook will sync eventually
      }

      response.success = true;
      response.subscription = {
        id: subscription.id,
        status: subscription.status,
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
        currentPeriodEnd: new Date(subscription.current_period_end * 1000).toISOString(),
      };

      logger.info('User reactivated their subscription', {
        userId: user.id,
        subscriptionId: profile.stripe_subscription_id,
        operation: 'reactivateSubscription',
      });
    } catch (stripeError) {
      const err = stripeError instanceof Error ? stripeError : new Error(String(stripeError));
      logger.error('Failed to reactivate subscription in Stripe', err, {
        userId: user.id,
        subscriptionId: profile.stripe_subscription_id,
        operation: 'reactivateStripeSubscription',
      });
      response.error = err.message === 'Stripe API request timeout'
        ? 'Stripe API timeout - please try again'
        : err.message.includes('Unauthorized')
        ? 'Unauthorized access to subscription'
        : 'Failed to reactivate subscription';
      return NextResponse.json(response, { status: 500 });
    }

    return NextResponse.json(response);
  } catch (error) {
    logger.error('Error in POST /api/subscription/reactivate', error instanceof Error ? error : new Error(String(error)), {
      operation: 'reactivateSubscription',
    });

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
