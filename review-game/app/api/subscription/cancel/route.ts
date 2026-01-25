/**
 * @fileoverview API route for users to cancel their own subscriptions
 *
 * POST /api/subscription/cancel
 * Allows users to cancel their subscription immediately or at period end
 *
 * @module app/api/subscription/cancel
 */

import { NextResponse, type NextRequest } from 'next/server';
import Stripe from 'stripe';
import { getAuthenticatedUser } from '@/lib/api/auth';
import { fetchWithTimeout, verifySubscriptionOwnership } from '@/lib/utils/stripe';
import { logger } from '@/lib/logger';
import type { CancelSubscriptionRequest, CancelSubscriptionResponse } from '@/types/subscription.types';

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
  canceled_at: number | null;
  current_period_end: number;
}

/**
 * Validation constants for input sanitization
 */
const VALIDATION = {
  REASON_MAX_LENGTH: 500,
  // Patterns to detect and reject potentially dangerous content
  FORBIDDEN_PATTERNS: [
    /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, // Control characters (except \t, \n, \r)
    /<script[^>]*>.*?<\/script>/gi, // Script tags
    /javascript:/gi, // JavaScript protocol
    /on\w+\s*=/gi, // Event handlers like onclick=, onload=, etc.
  ],
} as const;

/**
 * POST /api/subscription/cancel
 *
 * Cancels the authenticated user's subscription immediately or at period end
 */
export async function POST(req: NextRequest) {
  try {
    // Authenticate user using shared utility
    const { user, supabase, error } = await getAuthenticatedUser();
    if (error) return error;

    // Parse request body
    const body: CancelSubscriptionRequest = await req.json();
    const { immediate, reason } = body;

    // Validate immediate field
    if (typeof immediate !== 'boolean') {
      return NextResponse.json(
        { error: 'Invalid request: immediate must be a boolean' },
        { status: 400 }
      );
    }

    // Sanitize and validate reason if provided
    let sanitizedReason = '';
    if (reason) {
      sanitizedReason = reason.trim();

      // Validate reason length
      if (sanitizedReason.length > VALIDATION.REASON_MAX_LENGTH) {
        return NextResponse.json(
          { error: `Reason must be ${VALIDATION.REASON_MAX_LENGTH} characters or less` },
          { status: 400 }
        );
      }

      // Check for forbidden patterns in reason (XSS prevention)
      for (const pattern of VALIDATION.FORBIDDEN_PATTERNS) {
        if (pattern.test(sanitizedReason)) {
          logger.warn('Rejected reason with forbidden pattern', {
            operation: 'cancelSubscription',
            userId: user.id,
            pattern: pattern.source,
          });

          return NextResponse.json(
            { error: 'Reason contains invalid characters or patterns. Please remove any HTML tags, scripts, or control characters.' },
            { status: 400 }
          );
        }
      }
    }

    // Fetch user's profile from database
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('stripe_subscription_id, stripe_customer_id, email, subscription_status')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      logger.error('Failed to fetch profile for subscription cancellation', new Error(profileError?.message || 'Profile not found'), {
        userId: user.id,
        operation: 'cancelSubscription',
      });
      return NextResponse.json(
        { error: 'Profile not found' },
        { status: 404 }
      );
    }

    // Check if user has an active subscription
    if (!profile.stripe_subscription_id) {
      return NextResponse.json(
        { error: 'No active subscription found' },
        { status: 400 }
      );
    }

    // Validate subscription status
    if (profile.subscription_status === 'canceled') {
      return NextResponse.json(
        { error: 'Subscription is already canceled' },
        { status: 400 }
      );
    }

    const response: CancelSubscriptionResponse = {
      success: false,
    };

    try {
      // First, verify ownership before canceling
      const existingSubscription = await fetchWithTimeout(
        stripe.subscriptions.retrieve(profile.stripe_subscription_id),
        10000
      );

      verifySubscriptionOwnership(
        existingSubscription,
        profile.stripe_customer_id,
        user.id,
        'cancelSubscription'
      );

      // Cancel subscription in Stripe
      let subscription: StripeSubscriptionWithFields;

      if (immediate) {
        // Cancel immediately (delete subscription)
        subscription = await fetchWithTimeout(
          stripe.subscriptions.cancel(profile.stripe_subscription_id),
          10000
        ) as unknown as StripeSubscriptionWithFields;
      } else {
        // Cancel at period end
        subscription = await fetchWithTimeout(
          stripe.subscriptions.update(profile.stripe_subscription_id, {
            cancel_at_period_end: true,
          }),
          10000
        ) as unknown as StripeSubscriptionWithFields;
      }

      // Update database to reflect cancellation
      const dbUpdate: Record<string, unknown> = {};

      if (immediate) {
        dbUpdate.subscription_status = 'canceled';
        dbUpdate.stripe_subscription_id = null;
        dbUpdate.current_period_end = null;
        dbUpdate.trial_end_date = null;
      } else {
        // For cancel_at_period_end, just update status
        // Don't clear subscription_id yet - user retains access until period ends
        dbUpdate.subscription_status = subscription.status;
      }

      const { error: updateError } = await supabase
        .from('profiles')
        .update(dbUpdate)
        .eq('id', user.id);

      if (updateError) {
        logger.error('Failed to update database after subscription cancellation', new Error(updateError.message), {
          userId: user.id,
          subscriptionId: profile.stripe_subscription_id,
          immediate,
          operation: 'updateDatabaseAfterCancel',
        });
        // Don't fail the request - Stripe is updated, webhook will sync eventually
      }

      response.success = true;
      response.subscription = {
        id: subscription.id,
        status: subscription.status,
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
        canceledAt: subscription.canceled_at ? new Date(subscription.canceled_at * 1000).toISOString() : null,
        currentPeriodEnd: new Date(subscription.current_period_end * 1000).toISOString(),
      };

      logger.info('User canceled their subscription', {
        userId: user.id,
        subscriptionId: profile.stripe_subscription_id,
        immediate,
        reason: sanitizedReason || undefined,
        operation: 'cancelSubscription',
      });
    } catch (stripeError) {
      const err = stripeError instanceof Error ? stripeError : new Error(String(stripeError));
      logger.error('Failed to cancel subscription in Stripe', err, {
        userId: user.id,
        subscriptionId: profile.stripe_subscription_id,
        immediate,
        operation: 'cancelStripeSubscription',
      });
      response.error = err.message === 'Stripe API request timeout'
        ? 'Stripe API timeout - please try again'
        : err.message.includes('Unauthorized')
        ? 'Unauthorized access to subscription'
        : 'Failed to cancel subscription';
      return NextResponse.json(response, { status: 500 });
    }

    return NextResponse.json(response);
  } catch (error) {
    logger.error('Error in POST /api/subscription/cancel', error instanceof Error ? error : new Error(String(error)), {
      operation: 'cancelSubscription',
    });

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
