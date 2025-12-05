/**
 * @fileoverview API routes for custom plan assignment and removal.
 *
 * POST: Assigns a custom pricing plan to a user
 * - Creates custom price in Stripe
 * - Creates/updates subscription with custom pricing
 * - Stores custom plan details in database
 *
 * DELETE: Removes custom plan assignment
 * - Cancels custom Stripe subscription
 * - Clears custom plan fields in database
 *
 * @module app/api/admin/users/[userId]/subscription/custom-plan/route
 */

import { NextResponse } from 'next/server';
import { verifyAdminUser, createAdminServiceClient, logAdminAction } from '@/lib/admin/auth';
import { logger } from '@/lib/logger';
import Stripe from 'stripe';

// Initialize Stripe with version pinning
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-09-30.clover' as const,
});

/**
 * Validation constants
 */
const VALIDATION = {
  PLAN_NAME_MIN_LENGTH: 3,
  PLAN_NAME_MAX_LENGTH: 100,
  NOTES_MAX_LENGTH: 1000,
  MIN_PRICE: 0,
  MAX_PRICE: 10000, // $10,000/month max
  SECONDS_PER_DAY: 86400,
  MAX_FUTURE_YEARS: 10,
  VALID_BILLING_PERIODS: ['monthly', 'annual'] as const,
  VALID_CATEGORIES: [
    'educational',
    'partnership',
    'enterprise',
    'non_profit',
    'promotional',
    'other',
  ] as const,
  // XSS prevention patterns
  FORBIDDEN_PATTERNS: [
    /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, // Control characters
    /<script[^>]*>.*?<\/script>/gi, // Script tags
    /<iframe[^>]*>.*?<\/iframe>/gi, // Iframes
    /<object[^>]*>.*?<\/object>/gi, // Objects
    /<embed[^>]*>/gi, // Embeds
    /javascript:/gi, // JavaScript protocol
    /vbscript:/gi, // VBScript protocol
    /data:text\/html/gi, // Data URIs
    /on\w+\s*=/gi, // Event handlers
    /&lt;script/gi, // HTML entity encoded script tags
  ],
  STRIPE_TIMEOUT_MS: 10000,
} as const;

/**
 * Request body interface for POST
 */
interface CustomPlanRequest {
  planName: string;
  monthlyPrice: number; // USD amount per month
  billingPeriod: 'monthly' | 'annual';
  category: string;
  expirationDate?: string | null; // ISO date string
  featureLimits?: Record<string, unknown> | null; // JSON object
  notes?: string;
}

/**
 * Type alias for Stripe subscription with explicit fields
 */
type StripeSubscriptionWithFields = Stripe.Subscription & {
  trial_end: number | null;
  current_period_end: number;
};

/**
 * Validates and sanitizes input strings against XSS patterns
 */
function sanitizeInput(input: string, fieldName: string): string {
  for (const pattern of VALIDATION.FORBIDDEN_PATTERNS) {
    if (pattern.test(input)) {
      throw new Error(`${fieldName} contains forbidden characters or patterns`);
    }
  }
  return input.trim();
}

/**
 * Wraps Stripe API calls with timeout
 */
async function fetchWithTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error('Stripe API request timed out')), timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]);
}

/**
 * POST /api/admin/users/[userId]/subscription/custom-plan
 *
 * Assigns a custom pricing plan to a user.
 *
 * Creates a custom price in Stripe, subscribes the user to that price,
 * and stores the custom plan details in the database.
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ userId: string }> }
) {
  try {
    // 1. Verify admin authentication
    const adminUser = await verifyAdminUser();
    if (!adminUser) {
      logger.warn('Unauthorized custom plan assignment attempt', {
        operation: 'assignCustomPlan',
      });
      return NextResponse.json(
        { success: false, error: 'Unauthorized: Admin access required' },
        { status: 401 }
      );
    }

    const { userId } = await context.params;

    // 2. Validate userId format (UUID)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(userId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid user ID format' },
        { status: 400 }
      );
    }

    // 3. Parse and validate request body
    const body: CustomPlanRequest = await request.json();
    const {
      planName: rawPlanName,
      monthlyPrice,
      billingPeriod,
      category,
      expirationDate,
      featureLimits,
      notes: rawNotes,
    } = body;

    // Validate required fields
    if (!rawPlanName || monthlyPrice === undefined || !billingPeriod || !category) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: planName, monthlyPrice, billingPeriod, category' },
        { status: 400 }
      );
    }

    // Sanitize and validate plan name
    const planName = sanitizeInput(rawPlanName, 'Plan name');
    if (planName.length < VALIDATION.PLAN_NAME_MIN_LENGTH || planName.length > VALIDATION.PLAN_NAME_MAX_LENGTH) {
      return NextResponse.json(
        { success: false, error: `Plan name must be between ${VALIDATION.PLAN_NAME_MIN_LENGTH} and ${VALIDATION.PLAN_NAME_MAX_LENGTH} characters` },
        { status: 400 }
      );
    }

    // Validate pricing
    if (typeof monthlyPrice !== 'number' || isNaN(monthlyPrice) || monthlyPrice < VALIDATION.MIN_PRICE) {
      return NextResponse.json(
        { success: false, error: 'Monthly price must be a valid positive number' },
        { status: 400 }
      );
    }

    if (monthlyPrice > VALIDATION.MAX_PRICE) {
      return NextResponse.json(
        { success: false, error: `Monthly price cannot exceed $${VALIDATION.MAX_PRICE}` },
        { status: 400 }
      );
    }

    // Validate billing period
    if (!VALIDATION.VALID_BILLING_PERIODS.includes(billingPeriod)) {
      return NextResponse.json(
        { success: false, error: `Billing period must be one of: ${VALIDATION.VALID_BILLING_PERIODS.join(', ')}` },
        { status: 400 }
      );
    }

    // Validate category
    if (!VALIDATION.VALID_CATEGORIES.includes(category as typeof VALIDATION.VALID_CATEGORIES[number])) {
      return NextResponse.json(
        { success: false, error: `Category must be one of: ${VALIDATION.VALID_CATEGORIES.join(', ')}` },
        { status: 400 }
      );
    }

    // Validate expiration date (if provided)
    let expiresAt: Date | null = null;
    if (expirationDate) {
      expiresAt = new Date(expirationDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      if (isNaN(expiresAt.getTime())) {
        return NextResponse.json(
          { success: false, error: 'Invalid expiration date format' },
          { status: 400 }
        );
      }

      if (expiresAt < today) {
        return NextResponse.json(
          { success: false, error: 'Expiration date cannot be in the past' },
          { status: 400 }
        );
      }

      const maxDate = new Date();
      maxDate.setFullYear(maxDate.getFullYear() + VALIDATION.MAX_FUTURE_YEARS);
      if (expiresAt > maxDate) {
        return NextResponse.json(
          { success: false, error: `Expiration date cannot be more than ${VALIDATION.MAX_FUTURE_YEARS} years in the future` },
          { status: 400 }
        );
      }
    }

    // Sanitize and validate notes
    let notes = '';
    if (rawNotes) {
      notes = sanitizeInput(rawNotes, 'Notes');
      if (notes.length > VALIDATION.NOTES_MAX_LENGTH) {
        return NextResponse.json(
          { success: false, error: `Notes cannot exceed ${VALIDATION.NOTES_MAX_LENGTH} characters` },
          { status: 400 }
        );
      }
    }

    // Require notes for "other" category
    if (category === 'other' && !notes) {
      return NextResponse.json(
        { success: false, error: 'Notes are required when category is "other"' },
        { status: 400 }
      );
    }

    // Validate feature limits (if provided)
    if (featureLimits !== null && featureLimits !== undefined) {
      if (typeof featureLimits !== 'object' || Array.isArray(featureLimits)) {
        return NextResponse.json(
          { success: false, error: 'Feature limits must be a valid JSON object' },
          { status: 400 }
        );
      }
    }

    // 4. Fetch user from database
    const supabase = createAdminServiceClient();
    const { data: user, error: userError } = await supabase
      .from('profiles')
      .select('id, email, stripe_customer_id, stripe_subscription_id, subscription_status, custom_plan_type')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      logger.error('Failed to fetch user for custom plan assignment', new Error(userError?.message || 'User not found'), {
        userId,
        operation: 'assignCustomPlan',
      });
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    // 5. Check if user already has a custom plan
    if (user.custom_plan_type === 'custom_price') {
      return NextResponse.json(
        { success: false, error: 'User already has a custom plan. Remove the existing plan first.' },
        { status: 400 }
      );
    }

    // 6. Ensure user has a Stripe customer ID
    let customerId = user.stripe_customer_id;
    if (!customerId) {
      // Create Stripe customer if doesn't exist
      try {
        const customer = await fetchWithTimeout(
          stripe.customers.create({
            email: user.email,
            metadata: {
              user_id: userId,
            },
          }),
          VALIDATION.STRIPE_TIMEOUT_MS
        );
        customerId = customer.id;

        // Update database with customer ID
        await supabase
          .from('profiles')
          .update({ stripe_customer_id: customerId })
          .eq('id', userId);

        logger.info('Created Stripe customer for custom plan', {
          userId,
          customerId,
          operation: 'assignCustomPlan',
        });
      } catch (stripeError) {
        const error = stripeError instanceof Error ? stripeError : new Error(String(stripeError));
        logger.error('Failed to create Stripe customer', error, {
          userId,
          operation: 'assignCustomPlan',
        });
        return NextResponse.json(
          { success: false, error: `Failed to create Stripe customer: ${error.message}` },
          { status: 500 }
        );
      }
    }

    // 7. Create custom price in Stripe
    try {
      // Convert monthly price to cents
      const priceInCents = Math.round(monthlyPrice * 100);

      // Determine recurring interval and interval count
      const recurring: { interval: 'month' | 'year'; interval_count: number } =
        billingPeriod === 'monthly'
          ? { interval: 'month', interval_count: 1 }
          : { interval: 'year', interval_count: 1 };

      // Calculate annual price if needed
      const annualPriceInCents = billingPeriod === 'annual' ? Math.round(monthlyPrice * 12 * 100) : priceInCents;
      const finalPriceInCents = billingPeriod === 'annual' ? annualPriceInCents : priceInCents;

      logger.info('Creating custom price in Stripe', {
        userId,
        planName,
        monthlyPrice,
        billingPeriod,
        priceInCents: finalPriceInCents,
        operation: 'assignCustomPlan',
      });

      const price = await fetchWithTimeout(
        stripe.prices.create({
          unit_amount: finalPriceInCents,
          currency: 'usd',
          recurring,
          product_data: {
            name: `Custom Plan: ${planName}`,
            metadata: {
              plan_type: 'custom',
              user_id: userId,
              admin_assigned: 'true',
              category,
            },
          },
          metadata: {
            plan_name: planName,
            user_id: userId,
            category,
            monthly_price: monthlyPrice.toString(),
            billing_period: billingPeriod,
          },
        }),
        VALIDATION.STRIPE_TIMEOUT_MS
      );

      logger.info('Custom price created successfully', {
        userId,
        priceId: price.id,
        operation: 'assignCustomPlan',
      });

      // 8. Create or update subscription
      // Cancel existing subscription if present
      if (user.stripe_subscription_id) {
        try {
          await fetchWithTimeout(
            stripe.subscriptions.cancel(user.stripe_subscription_id),
            VALIDATION.STRIPE_TIMEOUT_MS
          );

          logger.info('Cancelled existing subscription before creating custom plan', {
            userId,
            oldSubscriptionId: user.stripe_subscription_id,
            operation: 'assignCustomPlan',
          });
        } catch (cancelError) {
          // Log but continue - the subscription might already be cancelled
          logger.warn('Could not cancel existing subscription', {
            userId,
            subscriptionId: user.stripe_subscription_id,
            error: cancelError instanceof Error ? cancelError.message : String(cancelError),
            operation: 'assignCustomPlan',
          });
        }
      }

      // Create new subscription with custom price
      const subscription = await fetchWithTimeout(
        stripe.subscriptions.create({
          customer: customerId,
          items: [{ price: price.id }],
          metadata: {
            user_id: userId,
            plan_type: 'custom',
            plan_name: planName,
            category,
            assigned_by: adminUser.id,
          },
        }),
        VALIDATION.STRIPE_TIMEOUT_MS
      ) as unknown as StripeSubscriptionWithFields;

      logger.info('Custom subscription created successfully', {
        userId,
        subscriptionId: subscription.id,
        priceId: price.id,
        operation: 'assignCustomPlan',
      });

      // 9. Update database with custom plan details
      const updateData: Record<string, unknown> = {
        stripe_subscription_id: subscription.id,
        subscription_status: subscription.status,
        subscription_tier: 'premium', // Custom plans are Premium tier
        custom_plan_type: 'custom_price',
        custom_plan_name: planName,
        custom_plan_expires_at: expiresAt ? expiresAt.toISOString() : null,
        custom_plan_notes: notes || null,
        plan_override_limits: featureLimits || null,
        billing_cycle: billingPeriod,
        current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
      };

      const { error: updateError } = await supabase
        .from('profiles')
        .update(updateData)
        .eq('id', userId);

      if (updateError) {
        logger.error('Failed to update database after creating custom plan', new Error(updateError.message), {
          userId,
          subscriptionId: subscription.id,
          operation: 'assignCustomPlan',
        });

        // Try to cancel the subscription to prevent orphaned state
        try {
          await stripe.subscriptions.cancel(subscription.id);
          logger.info('Rolled back Stripe subscription due to database error', {
            userId,
            subscriptionId: subscription.id,
            operation: 'assignCustomPlan',
          });
        } catch (rollbackError) {
          logger.error('CRITICAL: Failed to rollback Stripe subscription after database error', rollbackError instanceof Error ? rollbackError : new Error(String(rollbackError)), {
            userId,
            subscriptionId: subscription.id,
            operation: 'assignCustomPlan',
          });
        }

        return NextResponse.json(
          { success: false, error: 'Failed to update database. Subscription has been cancelled.' },
          { status: 500 }
        );
      }

      // 10. Log admin action
      await logAdminAction({
        actionType: 'assign_custom_plan',
        targetType: 'subscription',
        targetId: subscription.id,
        changes: {
          plan_name: planName,
          monthly_price: monthlyPrice,
          billing_period: billingPeriod,
          category,
          expires_at: expiresAt?.toISOString() || null,
          feature_limits: featureLimits || null,
        },
        reason: `Custom Plan: ${category}`,
        notes,
      });

      logger.info('Custom plan assigned successfully', {
        userId,
        planName,
        subscriptionId: subscription.id,
        adminUserId: adminUser.id,
        operation: 'assignCustomPlan',
      });

      return NextResponse.json({
        success: true,
        subscription: {
          id: subscription.id,
          status: subscription.status,
          planName,
          pricing: billingPeriod === 'monthly'
            ? `$${monthlyPrice.toFixed(2)}/month`
            : `$${(monthlyPrice * 12).toFixed(2)}/year`,
          expiresAt: expiresAt?.toISOString() || null,
        },
      });
    } catch (stripeError) {
      const error = stripeError instanceof Error ? stripeError : new Error(String(stripeError));
      logger.error('Failed to create custom plan in Stripe', error, {
        userId,
        planName,
        operation: 'assignCustomPlan',
      });

      return NextResponse.json(
        { success: false, error: error.message === 'Stripe API request timed out'
          ? 'Stripe API timeout - please try again'
          : `Failed to create custom plan: ${error.message}`
        },
        { status: 500 }
      );
    }
  } catch (error) {
    logger.error('Error in POST /api/admin/users/[userId]/subscription/custom-plan', error instanceof Error ? error : new Error(String(error)), {
      operation: 'assignCustomPlan',
    });

    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/users/[userId]/subscription/custom-plan
 *
 * Removes a custom plan assignment from a user.
 *
 * Cancels the Stripe subscription and clears custom plan fields from the database.
 */
export async function DELETE(
  request: Request,
  context: { params: Promise<{ userId: string }> }
) {
  try {
    // 1. Verify admin authentication
    const adminUser = await verifyAdminUser();
    if (!adminUser) {
      logger.warn('Unauthorized custom plan removal attempt', {
        operation: 'removeCustomPlan',
      });
      return NextResponse.json(
        { success: false, error: 'Unauthorized: Admin access required' },
        { status: 401 }
      );
    }

    const { userId } = await context.params;

    // 2. Validate userId format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(userId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid user ID format' },
        { status: 400 }
      );
    }

    // 3. Fetch user from database
    const supabase = createAdminServiceClient();
    const { data: user, error: userError } = await supabase
      .from('profiles')
      .select('id, email, stripe_subscription_id, custom_plan_type, custom_plan_name')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      logger.error('Failed to fetch user for custom plan removal', new Error(userError?.message || 'User not found'), {
        userId,
        operation: 'removeCustomPlan',
      });
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    // 4. Check if user has a custom plan
    if (user.custom_plan_type !== 'custom_price') {
      return NextResponse.json(
        { success: false, error: 'User does not have a custom plan' },
        { status: 400 }
      );
    }

    // 5. Cancel Stripe subscription (if exists)
    if (user.stripe_subscription_id) {
      try {
        await fetchWithTimeout(
          stripe.subscriptions.cancel(user.stripe_subscription_id),
          VALIDATION.STRIPE_TIMEOUT_MS
        );

        logger.info('Cancelled custom plan subscription', {
          userId,
          subscriptionId: user.stripe_subscription_id,
          operation: 'removeCustomPlan',
        });
      } catch (stripeError) {
        const error = stripeError instanceof Error ? stripeError : new Error(String(stripeError));
        logger.error('Failed to cancel Stripe subscription', error, {
          userId,
          subscriptionId: user.stripe_subscription_id,
          operation: 'removeCustomPlan',
        });

        // Continue anyway to clear database fields
        logger.warn('Continuing to clear database despite Stripe error', {
          userId,
          operation: 'removeCustomPlan',
        });
      }
    }

    // 6. Clear custom plan fields in database
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        stripe_subscription_id: null,
        subscription_status: null,
        subscription_tier: 'free',
        custom_plan_type: null,
        custom_plan_name: null,
        custom_plan_expires_at: null,
        custom_plan_notes: null,
        plan_override_limits: null,
        billing_cycle: null,
        current_period_end: null,
      })
      .eq('id', userId);

    if (updateError) {
      logger.error('Failed to clear custom plan fields from database', new Error(updateError.message), {
        userId,
        operation: 'removeCustomPlan',
      });

      return NextResponse.json(
        { success: false, error: 'Failed to update database' },
        { status: 500 }
      );
    }

    // 7. Log admin action
    await logAdminAction({
      actionType: 'remove_custom_plan',
      targetType: 'subscription',
      targetId: user.stripe_subscription_id || userId,
      changes: {
        previous_plan_name: user.custom_plan_name,
      },
      reason: 'Custom plan removed by admin',
      notes: undefined,
    });

    logger.info('Custom plan removed successfully', {
      userId,
      planName: user.custom_plan_name,
      adminUserId: adminUser.id,
      operation: 'removeCustomPlan',
    });

    return NextResponse.json({
      success: true,
      message: 'Custom plan removed successfully',
    });
  } catch (error) {
    logger.error('Error in DELETE /api/admin/users/[userId]/subscription/custom-plan', error instanceof Error ? error : new Error(String(error)), {
      operation: 'removeCustomPlan',
    });

    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
