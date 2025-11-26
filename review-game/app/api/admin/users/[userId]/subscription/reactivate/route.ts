/**
 * @fileoverview API route to reactivate canceled subscriptions
 *
 * POST /api/admin/users/[userId]/subscription/reactivate
 * Removes scheduled cancellation and restores ongoing billing
 *
 * @module app/api/admin/users/[userId]/subscription/reactivate
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

export interface ReactivateSubscriptionRequest {
  action: 'reactivate';
  reason: string;
  notes?: string;
}

export interface ReactivateSubscriptionResponse {
  success: boolean;
  subscription?: {
    id: string;
    status: string;
    cancelAtPeriodEnd: boolean;
    currentPeriodEnd: string;
  };
  error?: string;
}

/**
 * POST /api/admin/users/[userId]/subscription/reactivate
 *
 * Removes scheduled cancellation from a subscription
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
    const body: ReactivateSubscriptionRequest = await req.json();
    const { reason, notes } = body;

    // Validate required fields
    if (!reason) {
      return NextResponse.json(
        { error: 'Missing required field: reason' },
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
      logger.error('Failed to fetch user for subscription reactivation', new Error(userError?.message || 'User not found'), {
        userId,
        operation: 'reactivateSubscription',
      });
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Check if user has a subscription
    if (!user.stripe_subscription_id) {
      return NextResponse.json(
        { error: 'User does not have a subscription to reactivate' },
        { status: 400 }
      );
    }

    const response: ReactivateSubscriptionResponse = {
      success: false,
    };

    try {
      // Reactivate subscription in Stripe by removing cancel_at_period_end
      const subscription = await fetchWithTimeout(
        stripe.subscriptions.update(user.stripe_subscription_id, {
          cancel_at_period_end: false,
        }),
        10000
      );

      // Update database to reflect reactivation
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          subscription_status: subscription.status,
        })
        .eq('id', userId);

      if (updateError) {
        logger.error('Failed to update database after subscription reactivation', new Error(updateError.message), {
          userId,
          subscriptionId: user.stripe_subscription_id,
          operation: 'updateDatabaseAfterReactivate',
        });
        // Don't fail the request - Stripe is updated, webhook will sync eventually
      }

      // Log the admin action
      await logAdminAction({
        actionType: 'reactivate_subscription',
        targetType: 'subscription',
        targetId: user.stripe_subscription_id,
        changes: {
          before: {
            status: user.subscription_status,
            cancel_at_period_end: true,
          },
          after: {
            status: subscription.status,
            cancel_at_period_end: false,
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
        currentPeriodEnd: new Date(subscription.current_period_end * 1000).toISOString(),
      };

      logger.info('Subscription reactivated successfully', {
        userId,
        adminUserId: adminUser.id,
        subscriptionId: user.stripe_subscription_id,
        operation: 'reactivateSubscription',
      });
    } catch (stripeError) {
      const error = stripeError instanceof Error ? stripeError : new Error(String(stripeError));
      logger.error('Failed to reactivate subscription in Stripe', error, {
        userId,
        subscriptionId: user.stripe_subscription_id,
        operation: 'reactivateStripeSubscription',
      });
      response.error = error.message === 'Stripe API request timeout'
        ? 'Stripe API timeout - please try again'
        : 'Failed to reactivate subscription in Stripe';
      return NextResponse.json(response, { status: 500 });
    }

    return NextResponse.json(response);
  } catch (error) {
    logger.error('Error in POST /api/admin/users/[userId]/subscription/reactivate', error instanceof Error ? error : new Error(String(error)), {
      operation: 'reactivateSubscription',
    });

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
