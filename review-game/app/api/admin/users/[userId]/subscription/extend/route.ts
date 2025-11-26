/**
 * @fileoverview API route to extend subscription periods
 *
 * POST /api/admin/users/[userId]/subscription/extend
 * Extends the current billing period by adding days
 *
 * @module app/api/admin/users/[userId]/subscription/extend
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

/**
 * Extended Stripe Subscription interface with properties we need
 */
interface StripeSubscriptionWithFields extends Stripe.Subscription {
  current_period_end: number;
  trial_end: number | null;
}

export interface ExtendSubscriptionRequest {
  action: 'extend_period';
  extendDays: number;
  reason: string;
  notes?: string;
}

export interface ExtendSubscriptionResponse {
  success: boolean;
  subscription?: {
    id: string;
    status: string;
    currentPeriodEnd: string;
    trialEnd: string | null;
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
 * POST /api/admin/users/[userId]/subscription/extend
 *
 * Extends subscription period by specified days
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
    const body: ExtendSubscriptionRequest = await req.json();
    const { extendDays, notes } = body;
    let { reason } = body;

    // Validate required fields
    if (!extendDays || !reason) {
      return NextResponse.json(
        { error: 'Missing required fields: extendDays, reason' },
        { status: 400 }
      );
    }

    // Validate extendDays range
    if (extendDays < 1 || extendDays > 365) {
      return NextResponse.json(
        { error: 'extendDays must be between 1 and 365' },
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
          operation: 'extendSubscription',
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
            operation: 'extendSubscription',
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
      .select('stripe_subscription_id, stripe_customer_id, email, subscription_status, current_period_end')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      logger.error('Failed to fetch user for subscription extension', new Error(userError?.message || 'User not found'), {
        userId,
        operation: 'extendSubscription',
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

    if (user.subscription_status !== 'active') {
      return NextResponse.json(
        { error: `Cannot extend subscription with status: ${user.subscription_status}. Only active subscriptions can be extended.` },
        { status: 400 }
      );
    }

    const response: ExtendSubscriptionResponse = {
      success: false,
    };

    try {
      // Fetch current subscription to get current_period_end
      const currentSubscription = await fetchWithTimeout(
        stripe.subscriptions.retrieve(user.stripe_subscription_id),
        10000
      ) as unknown as StripeSubscriptionWithFields;

      // Calculate new period end (current + extend days)
      const currentPeriodEndTimestamp = currentSubscription.current_period_end;
      const extensionSeconds = extendDays * 24 * 60 * 60;
      const newPeriodEndTimestamp = currentPeriodEndTimestamp + extensionSeconds;

      /**
       * IMPORTANT: Extension Implementation Strategy
       *
       * We use billing_cycle_anchor to extend the subscription period.
       * This is more appropriate than trial_end for active subscriptions.
       *
       * Alternative approaches:
       * 1. trial_end - Works but can interfere with actual trial subscriptions
       * 2. billing_cycle_anchor - Sets next billing date (preferred method)
       * 3. pause_collection - Pauses billing temporarily
       *
       * We're using billing_cycle_anchor as it cleanly extends the period
       * without interfering with trial logic.
       */
      const subscription = await fetchWithTimeout(
        stripe.subscriptions.update(user.stripe_subscription_id, {
          billing_cycle_anchor: newPeriodEndTimestamp,
          proration_behavior: 'none', // Don't create prorations for extension
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any),
        10000
      ) as unknown as StripeSubscriptionWithFields;

      // Update database to reflect extension
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
          trial_end_date: subscription.trial_end ? new Date(subscription.trial_end * 1000).toISOString() : null,
        })
        .eq('id', userId);

      if (updateError) {
        logger.error('Failed to update database after subscription extension', new Error(updateError.message), {
          userId,
          subscriptionId: user.stripe_subscription_id,
          operation: 'updateDatabaseAfterExtend',
        });
        // Don't fail the request - Stripe is updated, webhook will sync eventually
      }

      // Log the admin action
      await logAdminAction({
        actionType: 'extend_subscription',
        targetType: 'subscription',
        targetId: user.stripe_subscription_id,
        changes: {
          before: {
            current_period_end: user.current_period_end,
          },
          after: {
            current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
            trial_end: subscription.trial_end ? new Date(subscription.trial_end * 1000).toISOString() : null,
            days_extended: extendDays,
          },
        },
        reason,
        notes: sanitizedNotes || undefined,
      });

      response.success = true;
      response.subscription = {
        id: subscription.id,
        status: subscription.status,
        currentPeriodEnd: new Date(subscription.current_period_end * 1000).toISOString(),
        trialEnd: subscription.trial_end ? new Date(subscription.trial_end * 1000).toISOString() : null,
      };

      logger.info('Subscription extended successfully', {
        userId,
        adminUserId: adminUser.id,
        subscriptionId: user.stripe_subscription_id,
        extendDays,
        operation: 'extendSubscription',
      });
    } catch (stripeError) {
      const error = stripeError instanceof Error ? stripeError : new Error(String(stripeError));
      logger.error('Failed to extend subscription in Stripe', error, {
        userId,
        subscriptionId: user.stripe_subscription_id,
        extendDays,
        operation: 'extendStripeSubscription',
      });
      response.error = error.message === 'Stripe API request timeout'
        ? 'Stripe API timeout - please try again'
        : 'Failed to extend subscription in Stripe';
      return NextResponse.json(response, { status: 500 });
    }

    return NextResponse.json(response);
  } catch (error) {
    logger.error('Error in POST /api/admin/users/[userId]/subscription/extend', error instanceof Error ? error : new Error(String(error)), {
      operation: 'extendSubscription',
    });

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
