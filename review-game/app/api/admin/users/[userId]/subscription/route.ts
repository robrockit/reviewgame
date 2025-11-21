/**
 * @fileoverview API route to fetch subscription details from Stripe
 *
 * GET /api/admin/users/[userId]/subscription
 * Returns real-time subscription data from Stripe API
 *
 * @module app/api/admin/users/[userId]/subscription
 */

import { NextResponse, type NextRequest } from 'next/server';
import Stripe from 'stripe';
import { verifyAdminUser, createAdminServiceClient } from '@/lib/admin/auth';
import { logger } from '@/lib/logger';

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  typescript: true,
});

/**
 * Subscription details response interface
 */
export interface SubscriptionDetailsResponse {
  subscription: {
    id: string;
    status: string;
    planName: string;
    planId: string;
    amount: number;
    currency: string;
    interval: 'month' | 'year';
    currentPeriodStart: string;
    currentPeriodEnd: string;
    cancelAtPeriodEnd: boolean;
    canceledAt: string | null;
    trialStart: string | null;
    trialEnd: string | null;
    metadata: Record<string, string>;
  } | null;
  customer: {
    id: string;
    email: string | null;
    name: string | null;
    created: string;
    defaultPaymentMethod: string | null;
  } | null;
  error?: string;
}

/**
 * GET /api/admin/users/[userId]/subscription
 *
 * Fetches real-time subscription details from Stripe
 */
export async function GET(
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

    // Fetch user's Stripe IDs from database
    const supabase = createAdminServiceClient();
    const { data: user, error: userError } = await supabase
      .from('profiles')
      .select('stripe_customer_id, stripe_subscription_id, email')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      logger.error('Failed to fetch user for subscription details', new Error(userError?.message || 'User not found'), {
        userId,
        operation: 'fetchUserForSubscription',
      });
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    const response: SubscriptionDetailsResponse = {
      subscription: null,
      customer: null,
    };

    // Fetch customer details if customer ID exists
    if (user.stripe_customer_id) {
      try {
        const customer = await stripe.customers.retrieve(user.stripe_customer_id);

        if (!customer.deleted) {
          response.customer = {
            id: customer.id,
            email: customer.email,
            name: customer.name,
            created: new Date(customer.created * 1000).toISOString(),
            defaultPaymentMethod: typeof customer.invoice_settings.default_payment_method === 'string'
              ? customer.invoice_settings.default_payment_method
              : customer.invoice_settings.default_payment_method?.id || null,
          };
        }
      } catch (stripeError) {
        logger.error('Failed to fetch Stripe customer', stripeError instanceof Error ? stripeError : new Error(String(stripeError)), {
          userId,
          customerId: user.stripe_customer_id,
          operation: 'fetchStripeCustomer',
        });
        // Continue without customer data
      }
    }

    // Fetch subscription details if subscription ID exists
    if (user.stripe_subscription_id) {
      try {
        const subscription = await stripe.subscriptions.retrieve(user.stripe_subscription_id);

        // Get the first price/plan (subscriptions can have multiple, but we'll show the primary one)
        const subscriptionItem = subscription.items.data[0];
        const price = subscriptionItem?.price;

        if (price) {
          response.subscription = {
            id: subscription.id,
            status: subscription.status,
            planName: price.nickname || price.product.toString(),
            planId: price.id,
            amount: price.unit_amount || 0,
            currency: price.currency,
            interval: price.recurring?.interval as 'month' | 'year' || 'month',
            currentPeriodStart: new Date(subscription.current_period_start * 1000).toISOString(),
            currentPeriodEnd: new Date(subscription.current_period_end * 1000).toISOString(),
            cancelAtPeriodEnd: subscription.cancel_at_period_end,
            canceledAt: subscription.canceled_at ? new Date(subscription.canceled_at * 1000).toISOString() : null,
            trialStart: subscription.trial_start ? new Date(subscription.trial_start * 1000).toISOString() : null,
            trialEnd: subscription.trial_end ? new Date(subscription.trial_end * 1000).toISOString() : null,
            metadata: subscription.metadata,
          };
        }
      } catch (stripeError) {
        logger.error('Failed to fetch Stripe subscription', stripeError instanceof Error ? stripeError : new Error(String(stripeError)), {
          userId,
          subscriptionId: user.stripe_subscription_id,
          operation: 'fetchStripeSubscription',
        });
        // Return error in response but don't fail the request
        response.error = 'Failed to fetch subscription from Stripe';
      }
    }

    // Log successful retrieval
    logger.info('Subscription details retrieved', {
      userId,
      adminUserId: adminUser.id,
      hasSubscription: !!response.subscription,
      hasCustomer: !!response.customer,
      operation: 'getSubscriptionDetails',
    });

    return NextResponse.json(response);
  } catch (error) {
    logger.error('Error in GET /api/admin/users/[userId]/subscription', error instanceof Error ? error : new Error(String(error)), {
      operation: 'getSubscriptionDetails',
    });

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
