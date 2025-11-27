/**
 * @fileoverview API route to extend trial periods
 *
 * POST /api/admin/users/[userId]/subscription/extend-trial
 * Extends or reactivates trial periods by updating trial_end in Stripe
 *
 * @module app/api/admin/users/[userId]/subscription/extend-trial
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
  trial_end: number | null;
  current_period_end: number;
}

export interface ExtendTrialRequest {
  extendDays: number;
  reason: string;
  notes?: string;
}

export interface ExtendTrialResponse {
  success: boolean;
  subscription?: {
    id: string;
    status: string;
    trialEnd: string | null;
    currentPeriodEnd: string;
  };
  error?: string;
}

/**
 * Validation constants for input sanitization and date calculations
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
  // Date calculation constants
  MIN_EXTEND_DAYS: 1,
  MAX_EXTEND_DAYS: 365,
  SECONDS_PER_DAY: 86400,
  // Unix timestamp for 2038-01-19 (32-bit signed integer overflow)
  MAX_UNIX_TIMESTAMP: 2147483647,
  // Retry configuration for race condition handling
  MAX_RETRIES: 3,
  RETRY_TOLERANCE_SECONDS: 10, // Allow 10 second tolerance for verification
} as const;

/**
 * POST /api/admin/users/[userId]/subscription/extend-trial
 *
 * Extends trial period by specified days or reactivates expired trials
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
    const body: ExtendTrialRequest = await req.json();
    const { extendDays, notes } = body;
    let { reason } = body;

    // Validate required fields
    if (!extendDays || !reason) {
      return NextResponse.json(
        { error: 'Missing required fields: extendDays, reason' },
        { status: 400 }
      );
    }

    // Validate extendDays is a valid integer in acceptable range
    if (!Number.isInteger(extendDays) || extendDays < VALIDATION.MIN_EXTEND_DAYS || extendDays > VALIDATION.MAX_EXTEND_DAYS) {
      return NextResponse.json(
        { error: `extendDays must be an integer between ${VALIDATION.MIN_EXTEND_DAYS} and ${VALIDATION.MAX_EXTEND_DAYS}` },
        { status: 400 }
      );
    }

    // Validate that extension won't cause Unix timestamp overflow
    const now = Math.floor(Date.now() / 1000);
    const extensionSeconds = extendDays * VALIDATION.SECONDS_PER_DAY;
    const potentialNewTrialEnd = now + extensionSeconds;

    if (potentialNewTrialEnd > VALIDATION.MAX_UNIX_TIMESTAMP) {
      return NextResponse.json(
        { error: 'Trial extension would exceed maximum supported date (year 2038). Please use a smaller number of days.' },
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
          operation: 'extendTrial',
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
            operation: 'extendTrial',
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
      .select('stripe_subscription_id, stripe_customer_id, email, subscription_status, trial_end_date')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      logger.error('Failed to fetch user for trial extension', new Error(userError?.message || 'User not found'), {
        userId,
        operation: 'extendTrial',
      });
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // User must have a Stripe customer ID to extend trial
    if (!user.stripe_customer_id) {
      return NextResponse.json(
        { error: 'User does not have a Stripe customer account' },
        { status: 400 }
      );
    }

    const response: ExtendTrialResponse = {
      success: false,
    };

    try {
      let subscription: StripeSubscriptionWithFields;
      let isReactivation = false;

      // Check if user has an existing subscription
      if (user.stripe_subscription_id) {
        // Implement retry logic to handle race conditions
        // If another operation modifies trial_end between read and write, we'll retry
        let retryCount = 0;
        let updateSuccessful = false;

        while (retryCount < VALIDATION.MAX_RETRIES && !updateSuccessful) {
          // Fetch current subscription state
          const currentSubscription = await fetchWithTimeout(
            stripe.subscriptions.retrieve(user.stripe_subscription_id),
            10000
          ) as unknown as StripeSubscriptionWithFields;

          // Calculate new trial end based on current state
          const now = Math.floor(Date.now() / 1000);
          const currentTrialEnd = currentSubscription.trial_end || now;
          const newTrialEnd = (currentTrialEnd > now ? currentTrialEnd : now) + extensionSeconds;

          // Determine if this is a reactivation
          isReactivation = !currentSubscription.trial_end || currentSubscription.trial_end <= now;

          // Store expected minimum trial_end for verification
          const expectedMinTrialEnd = currentTrialEnd + extensionSeconds - VALIDATION.RETRY_TOLERANCE_SECONDS;

          // Update subscription with new trial_end
          subscription = await fetchWithTimeout(
            stripe.subscriptions.update(user.stripe_subscription_id, {
              trial_end: newTrialEnd,
            }),
            10000
          ) as unknown as StripeSubscriptionWithFields;

          // Verify the update was based on current data
          // If trial_end is within tolerance, consider it successful
          if (subscription.trial_end && subscription.trial_end >= expectedMinTrialEnd) {
            updateSuccessful = true;
            logger.info('Trial extension successful', {
              userId,
              retryCount,
              expectedMinTrialEnd,
              actualTrialEnd: subscription.trial_end,
            });
          } else {
            retryCount++;
            if (retryCount < VALIDATION.MAX_RETRIES) {
              logger.warn('Trial extension verification failed, retrying', {
                userId,
                retryCount,
                expectedMinTrialEnd,
                actualTrialEnd: subscription.trial_end,
              });
              // Brief delay before retry to reduce contention
              await new Promise(resolve => setTimeout(resolve, 100 * retryCount));
            } else {
              logger.error('Trial extension retry limit reached', new Error('Max retries exceeded'), {
                userId,
                retryCount,
                expectedMinTrialEnd,
                actualTrialEnd: subscription.trial_end,
              });
              throw new Error('Unable to extend trial due to concurrent modifications. Please try again.');
            }
          }
        }
      } else {
        // No subscription exists - create a trial subscription
        // This allows admins to grant trials to users who haven't subscribed yet
        isReactivation = true;

        const now = Math.floor(Date.now() / 1000);
        const newTrialEnd = now + extensionSeconds;

        // Get the default price ID for creating trial subscriptions
        // We'll use the Pro monthly price as the default
        const defaultPriceId = process.env.STRIPE_PRO_MONTHLY_PRICE_ID;
        if (!defaultPriceId) {
          throw new Error('STRIPE_PRO_MONTHLY_PRICE_ID not configured. Cannot create trial subscription.');
        }

        subscription = await fetchWithTimeout(
          stripe.subscriptions.create({
            customer: user.stripe_customer_id,
            items: [{ price: defaultPriceId }],
            trial_end: newTrialEnd,
          }),
          10000
        ) as unknown as StripeSubscriptionWithFields;

        // Update database with new subscription ID
        await supabase
          .from('profiles')
          .update({
            stripe_subscription_id: subscription.id,
          })
          .eq('id', userId);
      }

      // Update database to reflect trial extension
      const dbUpdate: Record<string, unknown> = {
        trial_end_date: subscription.trial_end ? new Date(subscription.trial_end * 1000).toISOString() : null,
        subscription_status: subscription.status,
      };

      // If we created a new subscription, also update the subscription ID
      if (!user.stripe_subscription_id) {
        dbUpdate.stripe_subscription_id = subscription.id;
      }

      const { error: updateError } = await supabase
        .from('profiles')
        .update(dbUpdate)
        .eq('id', userId);

      if (updateError) {
        logger.error('Failed to update database after trial extension', new Error(updateError.message), {
          userId,
          subscriptionId: subscription.id,
          operation: 'updateDatabaseAfterExtendTrial',
        });

        // Attempt to rollback Stripe changes to maintain data consistency
        try {
          if (!user.stripe_subscription_id) {
            // New subscription created - cancel it to rollback
            await fetchWithTimeout(
              stripe.subscriptions.cancel(subscription.id),
              10000
            );
            logger.info('Rolled back new subscription creation due to database error', {
              subscriptionId: subscription.id,
              userId,
            });
          } else {
            // Extension made - revert to original trial_end if possible
            const originalTrialEnd = user.trial_end_date
              ? Math.floor(new Date(user.trial_end_date).getTime() / 1000)
              : undefined;

            await fetchWithTimeout(
              stripe.subscriptions.update(subscription.id, {
                trial_end: originalTrialEnd,
              }),
              10000
            );
            logger.info('Rolled back trial extension due to database error', {
              subscriptionId: subscription.id,
              userId,
              originalTrialEnd,
            });
          }

          return NextResponse.json(
            {
              success: false,
              error: 'Failed to update database. Stripe changes have been rolled back. Please try again.'
            },
            { status: 500 }
          );
        } catch (rollbackError) {
          // Rollback failed - log critical error
          logger.error('CRITICAL: Failed to rollback Stripe changes after database error',
            rollbackError instanceof Error ? rollbackError : new Error(String(rollbackError)),
            {
              subscriptionId: subscription.id,
              userId,
              originalDatabaseError: updateError.message,
            }
          );

          return NextResponse.json(
            {
              success: false,
              error: 'Critical error: Database update failed and automatic rollback failed. Please contact support immediately.'
            },
            { status: 500 }
          );
        }
      }

      // Log the admin action
      await logAdminAction({
        actionType: isReactivation ? 'reactivate_trial' : 'extend_trial',
        targetType: 'subscription',
        targetId: subscription.id,
        changes: {
          before: {
            trial_end_date: user.trial_end_date,
            subscription_status: user.subscription_status,
          },
          after: {
            trial_end_date: subscription.trial_end ? new Date(subscription.trial_end * 1000).toISOString() : null,
            subscription_status: subscription.status,
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
        trialEnd: subscription.trial_end ? new Date(subscription.trial_end * 1000).toISOString() : null,
        currentPeriodEnd: new Date(subscription.current_period_end * 1000).toISOString(),
      };

      logger.info('Trial extended successfully', {
        userId,
        adminUserId: adminUser.id,
        subscriptionId: subscription.id,
        extendDays,
        isReactivation,
        operation: 'extendTrial',
      });
    } catch (stripeError) {
      const error = stripeError instanceof Error ? stripeError : new Error(String(stripeError));
      logger.error('Failed to extend trial in Stripe', error, {
        userId,
        subscriptionId: user.stripe_subscription_id,
        extendDays,
        operation: 'extendStripeTrial',
      });
      response.error = error.message === 'Stripe API request timeout'
        ? 'Stripe API timeout - please try again'
        : `Failed to extend trial: ${error.message}`;
      return NextResponse.json(response, { status: 500 });
    }

    return NextResponse.json(response);
  } catch (error) {
    logger.error('Error in POST /api/admin/users/[userId]/subscription/extend-trial', error instanceof Error ? error : new Error(String(error)), {
      operation: 'extendTrial',
    });

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
