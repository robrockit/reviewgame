/**
 * @fileoverview API route to cancel user subscriptions
 *
 * POST /api/admin/users/[userId]/subscription/cancel
 * Cancels a user's Stripe subscription immediately or at period end
 *
 * @module app/api/admin/users/[userId]/subscription/cancel
 */

import { NextResponse, type NextRequest } from 'next/server';
import Stripe from 'stripe';
import { verifyAdminUser, createAdminServiceClient, logAdminAction } from '@/lib/admin/auth';
import { logger } from '@/lib/logger';

// Validate Stripe API key is configured
if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('STRIPE_SECRET_KEY environment variable is not configured');
}

// Initialize Stripe with API version pinning for stability
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2025-09-30.clover',
  typescript: true,
});

/**
 * Timeout wrapper for Stripe API calls
 * Prevents requests from hanging indefinitely
 */
async function fetchWithTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number = 10000
): Promise<T> {
  const timeout = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error('Stripe API request timeout')), timeoutMs);
  });

  return Promise.race([promise, timeout]);
}

export interface CancelSubscriptionRequest {
  action: 'cancel_immediate' | 'cancel_period_end';
  reason: string;
  notes?: string;
}

export interface CancelSubscriptionResponse {
  success: boolean;
  subscription?: {
    id: string;
    status: string;
    cancelAtPeriodEnd: boolean;
    canceledAt: string | null;
    currentPeriodEnd: string;
  };
  error?: string;
}

/**
 * POST /api/admin/users/[userId]/subscription/cancel
 *
 * Cancels a user's subscription immediately or at period end
 */
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ userId: string }> }
) {
  try {
    // Verify admin authentication
    const adminUser = await verifyAdminUser();
    if (!adminUser) {
      return NextResponse.json(
        { error: 'Unauthorized: Admin access required' },
        { status: 401 }
      );
    }

    const { userId } = await context.params;

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(userId)) {
      return NextResponse.json(
        { error: 'Invalid user ID format' },
        { status: 400 }
      );
    }

    // Parse request body
    const body: CancelSubscriptionRequest = await req.json();
    const { action, reason, notes } = body;

    // Validate required fields
    if (!action || !reason) {
      return NextResponse.json(
        { error: 'Missing required fields: action, reason' },
        { status: 400 }
      );
    }

    if (action !== 'cancel_immediate' && action !== 'cancel_period_end') {
      return NextResponse.json(
        { error: 'Invalid action. Must be cancel_immediate or cancel_period_end' },
        { status: 400 }
      );
    }

    // Fetch user's Stripe subscription ID from database
    const supabase = createAdminServiceClient();
    const { data: user, error: userError } = await supabase
      .from('profiles')
      .select('stripe_subscription_id, stripe_customer_id, email, subscription_status')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      logger.error('Failed to fetch user for subscription cancellation', new Error(userError?.message || 'User not found'), {
        userId,
        operation: 'cancelSubscription',
      });
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Check if user has an active subscription
    if (!user.stripe_subscription_id) {
      return NextResponse.json(
        { error: 'User does not have an active subscription' },
        { status: 400 }
      );
    }

    // Validate subscription status
    if (user.subscription_status === 'canceled') {
      return NextResponse.json(
        { error: 'Subscription is already canceled' },
        { status: 400 }
      );
    }

    if (user.subscription_status === 'unpaid' || user.subscription_status === 'past_due') {
      return NextResponse.json(
        { error: `Cannot cancel subscription with status: ${user.subscription_status}. Please resolve payment issues first.` },
        { status: 400 }
      );
    }

    const response: CancelSubscriptionResponse = {
      success: false,
    };

    try {
      // Cancel subscription in Stripe
      let subscription: Stripe.Subscription;

      if (action === 'cancel_immediate') {
        // Cancel immediately (delete subscription)
        subscription = await fetchWithTimeout(
          stripe.subscriptions.cancel(user.stripe_subscription_id),
          10000
        );
      } else {
        // Cancel at period end
        subscription = await fetchWithTimeout(
          stripe.subscriptions.update(user.stripe_subscription_id, {
            cancel_at_period_end: true,
          }),
          10000
        );
      }

      // Update database to reflect cancellation
      const dbUpdate: Record<string, unknown> = {};

      if (action === 'cancel_immediate') {
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
        .eq('id', userId);

      if (updateError) {
        logger.error('Failed to update database after subscription cancellation', new Error(updateError.message), {
          userId,
          subscriptionId: user.stripe_subscription_id,
          action,
          operation: 'updateDatabaseAfterCancel',
        });
        // Don't fail the request - Stripe is updated, webhook will sync eventually
      }

      // Log the admin action
      await logAdminAction({
        actionType: action === 'cancel_immediate' ? 'cancel_subscription_immediate' : 'cancel_subscription_period_end',
        targetType: 'subscription',
        targetId: user.stripe_subscription_id,
        changes: {
          before: {
            status: user.subscription_status,
            cancel_at_period_end: false,
          },
          after: {
            status: subscription.status,
            cancel_at_period_end: subscription.cancel_at_period_end,
            canceled_at: subscription.canceled_at ? new Date(subscription.canceled_at * 1000).toISOString() : null,
          },
        },
        reason,
        notes,
      });

      response.success = true;
      response.subscription = {
        id: subscription.id,
        status: subscription.status,
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
        canceledAt: subscription.canceled_at ? new Date(subscription.canceled_at * 1000).toISOString() : null,
        currentPeriodEnd: new Date(subscription.current_period_end * 1000).toISOString(),
      };

      logger.info('Subscription canceled successfully', {
        userId,
        adminUserId: adminUser.id,
        subscriptionId: user.stripe_subscription_id,
        action,
        operation: 'cancelSubscription',
      });
    } catch (stripeError) {
      const error = stripeError instanceof Error ? stripeError : new Error(String(stripeError));
      logger.error('Failed to cancel subscription in Stripe', error, {
        userId,
        subscriptionId: user.stripe_subscription_id,
        action,
        operation: 'cancelStripeSubscription',
      });
      response.error = error.message === 'Stripe API request timeout'
        ? 'Stripe API timeout - please try again'
        : 'Failed to cancel subscription in Stripe';
      return NextResponse.json(response, { status: 500 });
    }

    return NextResponse.json(response);
  } catch (error) {
    logger.error('Error in POST /api/admin/users/[userId]/subscription/cancel', error instanceof Error ? error : new Error(String(error)), {
      operation: 'cancelSubscription',
    });

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
