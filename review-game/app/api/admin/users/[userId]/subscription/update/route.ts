/**
 * @fileoverview API route to update subscription details
 *
 * POST /api/admin/users/[userId]/subscription/update
 * Changes billing cycle (monthly ↔ yearly) and other subscription properties
 *
 * @module app/api/admin/users/[userId]/subscription/update
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
  apiVersion: '2025-12-15.clover',
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

/**
 * Extended Stripe Subscription interface with properties we need
 */
interface StripeSubscriptionWithFields extends Stripe.Subscription {
  current_period_end: number;
  items: {
    data: Array<{
      id: string;
      price: {
        id: string;
        unit_amount: number | null;
        recurring: {
          interval: string;
        } | null;
      };
    }>;
  };
}

export interface UpdateSubscriptionRequest {
  action: 'change_to_monthly' | 'change_to_yearly';
  reason: string;
  notes?: string;
}

export interface UpdateSubscriptionResponse {
  success: boolean;
  subscription?: {
    id: string;
    status: string;
    planId: string;
    interval: 'month' | 'year';
    amount: number;
    currentPeriodEnd: string;
  };
  error?: string;
}

/**
 * Validation constants for input sanitization
 */
const VALIDATION = {
  REASON_MIN_LENGTH: 10,
  REASON_MAX_LENGTH: 500,
  NOTES_MAX_LENGTH: 1000,
  // Patterns to detect and reject potentially dangerous content
  FORBIDDEN_PATTERNS: [
    /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, // Control characters (except \t, \n, \r)
    /<script[^>]*>.*?<\/script>/gi, // Script tags
    /javascript:/gi, // JavaScript protocol
    /on\w+\s*=/gi, // Event handlers like onclick=, onload=, etc.
  ],
} as const;

/**
 * Get price ID mappings from environment variables
 * Validates that required price IDs are configured
 */
function getPriceMappings(): Record<string, { monthly: string; yearly: string }> {
  const mappings: Record<string, { monthly: string; yearly: string }> = {};

  // Pro tier
  if (process.env.STRIPE_PRO_MONTHLY_PRICE_ID && process.env.STRIPE_PRO_YEARLY_PRICE_ID) {
    mappings.pro = {
      monthly: process.env.STRIPE_PRO_MONTHLY_PRICE_ID,
      yearly: process.env.STRIPE_PRO_YEARLY_PRICE_ID,
    };
  }

  // Enterprise tier
  if (process.env.STRIPE_ENTERPRISE_MONTHLY_PRICE_ID && process.env.STRIPE_ENTERPRISE_YEARLY_PRICE_ID) {
    mappings.enterprise = {
      monthly: process.env.STRIPE_ENTERPRISE_MONTHLY_PRICE_ID,
      yearly: process.env.STRIPE_ENTERPRISE_YEARLY_PRICE_ID,
    };
  }

  return mappings;
}

/**
 * POST /api/admin/users/[userId]/subscription/update
 *
 * Updates subscription billing cycle
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
    const body: UpdateSubscriptionRequest = await req.json();
    const { action, notes } = body;
    let { reason } = body;

    // Validate required fields
    if (!action || !reason) {
      return NextResponse.json(
        { error: 'Missing required fields: action, reason' },
        { status: 400 }
      );
    }

    if (action !== 'change_to_monthly' && action !== 'change_to_yearly') {
      return NextResponse.json(
        { error: 'Invalid action. Must be change_to_monthly or change_to_yearly' },
        { status: 400 }
      );
    }

    // Sanitize and validate reason
    reason = reason.trim();

    // Validate reason length
    if (reason.length < VALIDATION.REASON_MIN_LENGTH) {
      return NextResponse.json(
        { error: `Reason must be at least ${VALIDATION.REASON_MIN_LENGTH} characters` },
        { status: 400 }
      );
    }

    if (reason.length > VALIDATION.REASON_MAX_LENGTH) {
      return NextResponse.json(
        { error: `Reason must be ${VALIDATION.REASON_MAX_LENGTH} characters or less` },
        { status: 400 }
      );
    }

    // Check for forbidden patterns in reason (XSS prevention)
    for (const pattern of VALIDATION.FORBIDDEN_PATTERNS) {
      if (pattern.test(reason)) {
        logger.warn('Rejected reason with forbidden pattern', {
          operation: 'updateSubscription',
          adminId: adminUser.id,
          pattern: pattern.source,
        });

        return NextResponse.json(
          { error: 'Reason contains invalid characters or patterns. Please remove any HTML tags, scripts, or control characters.' },
          { status: 400 }
        );
      }
    }

    // Sanitize and validate notes
    let sanitizedNotes = notes || '';
    if (sanitizedNotes) {
      sanitizedNotes = sanitizedNotes.trim();

      // Validate length
      if (sanitizedNotes.length > VALIDATION.NOTES_MAX_LENGTH) {
        return NextResponse.json(
          { error: `Notes must be ${VALIDATION.NOTES_MAX_LENGTH} characters or less` },
          { status: 400 }
        );
      }

      // Check for forbidden patterns (XSS prevention)
      for (const pattern of VALIDATION.FORBIDDEN_PATTERNS) {
        if (pattern.test(sanitizedNotes)) {
          logger.warn('Rejected notes with forbidden pattern', {
            operation: 'updateSubscription',
            adminId: adminUser.id,
            pattern: pattern.source,
          });

          return NextResponse.json(
            { error: 'Notes contain invalid characters or patterns. Please remove any HTML tags, scripts, or control characters.' },
            { status: 400 }
          );
        }
      }
    }

    // Fetch user's Stripe subscription ID from database
    const supabase = createAdminServiceClient();
    const { data: user, error: userError } = await supabase
      .from('profiles')
      .select('stripe_subscription_id, stripe_customer_id, email, subscription_status, subscription_tier, billing_cycle')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      logger.error('Failed to fetch user for subscription update', new Error(userError?.message || 'User not found'), {
        userId,
        operation: 'updateSubscription',
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

    if (user.subscription_status !== 'active' && user.subscription_status !== 'trialing') {
      return NextResponse.json(
        { error: 'Can only update active or trialing subscriptions' },
        { status: 400 }
      );
    }

    const response: UpdateSubscriptionResponse = {
      success: false,
    };

    try {
      // Fetch current subscription to get current price ID
      const currentSubscription = await fetchWithTimeout(
        stripe.subscriptions.retrieve(user.stripe_subscription_id, {
          expand: ['items.data.price'],
        }),
        10000
      ) as unknown as StripeSubscriptionWithFields;

      if (!currentSubscription.items.data[0]) {
        throw new Error('Subscription has no items');
      }

      const currentItem = currentSubscription.items.data[0];
      const currentPrice = currentItem.price;

      // Determine the new price ID based on the current tier and desired interval
      const tier = user.subscription_tier || 'pro';
      const newInterval = action === 'change_to_monthly' ? 'monthly' : 'yearly';
      const priceMappings = getPriceMappings();
      const priceMapping = priceMappings[tier.toLowerCase()];

      if (!priceMapping) {
        logger.error('No price mapping configured for tier', new Error(`Missing price mapping for tier: ${tier}`), {
          userId,
          tier,
          availableTiers: Object.keys(priceMappings),
          operation: 'updateSubscription',
        });
        throw new Error(`Price mapping not configured for tier: ${tier}. Please configure STRIPE_${tier.toUpperCase()}_MONTHLY_PRICE_ID and STRIPE_${tier.toUpperCase()}_YEARLY_PRICE_ID environment variables.`);
      }

      const newPriceId = newInterval === 'monthly' ? priceMapping.monthly : priceMapping.yearly;

      // Validate new price ID
      if (!newPriceId) {
        throw new Error(`Price ID not found for ${tier} tier ${newInterval} billing`);
      }

      // Update subscription in Stripe
      const subscription = await fetchWithTimeout(
        stripe.subscriptions.update(user.stripe_subscription_id, {
          items: [
            {
              id: currentItem.id,
              price: newPriceId,
            },
          ],
          proration_behavior: 'create_prorations', // Create prorations for the change
        }),
        10000
      ) as unknown as StripeSubscriptionWithFields;

      // Get the new price details
      const newPrice = subscription.items.data[0]?.price;
      const newBillingCycle = newPrice?.recurring?.interval === 'year' ? 'yearly' : 'monthly';

      // Update database to reflect the change
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          billing_cycle: newBillingCycle,
          current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
        })
        .eq('id', userId);

      if (updateError) {
        logger.error('Failed to update database after subscription update', new Error(updateError.message), {
          userId,
          subscriptionId: user.stripe_subscription_id,
          operation: 'updateDatabaseAfterUpdate',
        });
        // Don't fail the request - Stripe is updated, webhook will sync eventually
      }

      // Log the admin action
      await logAdminAction({
        actionType: 'update_subscription_billing_cycle',
        targetType: 'subscription',
        targetId: user.stripe_subscription_id,
        changes: {
          before: {
            price_id: currentPrice.id,
            interval: currentPrice.recurring?.interval,
            amount: currentPrice.unit_amount,
            billing_cycle: user.billing_cycle,
          },
          after: {
            price_id: newPrice?.id,
            interval: newPrice?.recurring?.interval,
            amount: newPrice?.unit_amount,
            billing_cycle: newBillingCycle,
          },
        },
        reason,
        notes: sanitizedNotes || undefined,
      });

      response.success = true;
      response.subscription = {
        id: subscription.id,
        status: subscription.status,
        planId: newPrice?.id || '',
        interval: (newPrice?.recurring?.interval as 'month' | 'year') || 'month',
        amount: newPrice?.unit_amount || 0,
        currentPeriodEnd: new Date(subscription.current_period_end * 1000).toISOString(),
      };

      logger.info('Subscription updated successfully', {
        userId,
        adminUserId: adminUser.id,
        subscriptionId: user.stripe_subscription_id,
        action,
        newPriceId,
        operation: 'updateSubscription',
      });
    } catch (stripeError) {
      const error = stripeError instanceof Error ? stripeError : new Error(String(stripeError));
      logger.error('Failed to update subscription in Stripe', error, {
        userId,
        subscriptionId: user.stripe_subscription_id,
        action,
        operation: 'updateStripeSubscription',
      });
      response.error = error.message === 'Stripe API request timeout'
        ? 'Stripe API timeout - please try again'
        : `Failed to update subscription: ${error.message}`;
      return NextResponse.json(response, { status: 500 });
    }

    return NextResponse.json(response);
  } catch (error) {
    logger.error('Error in POST /api/admin/users/[userId]/subscription/update', error instanceof Error ? error : new Error(String(error)), {
      operation: 'updateSubscription',
    });

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
