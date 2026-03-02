/**
 * @fileoverview API route for granting free Premium access to users.
 *
 * Supports two grant types:
 * 1. Temporary Access: Creates Stripe subscription with 100% discount for specified duration
 * 2. Lifetime Access: Sets database flags for permanent Premium access
 *
 * All grants are logged in the audit trail with full context.
 *
 * @module app/api/admin/users/[userId]/subscription/grant-access/route
 */

import { NextResponse } from 'next/server';
import { verifyAdminUser, createAdminServiceClient, logAdminAction } from '@/lib/admin/auth';
import Stripe from 'stripe';

// Initialize Stripe with version pinning for consistency
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-12-15.clover' as const,
});

/**
 * Validation constants
 */
const VALIDATION = {
  PLAN_NAME_MIN_LENGTH: 3,
  PLAN_NAME_MAX_LENGTH: 100,
  NOTES_MAX_LENGTH: 1000,
  MIN_DURATION_DAYS: 1,
  MAX_DURATION_DAYS: 3650, // 10 years
  SECONDS_PER_DAY: 86400,
  VALID_CATEGORIES: [
    'service_outage',
    'promotional',
    'educational',
    'employee_partner',
    'competition',
    'other',
  ] as const,
  VALID_ACCESS_TYPES: ['temporary', 'lifetime'] as const,
  // XSS prevention patterns (comprehensive)
  FORBIDDEN_PATTERNS: [
    /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, // Control characters
    /<script[^>]*>.*?<\/script>/gi, // Script tags
    /<iframe[^>]*>.*?<\/iframe>/gi, // Iframes
    /<object[^>]*>.*?<\/object>/gi, // Objects
    /<embed[^>]*>/gi, // Embeds
    /javascript:/gi, // JavaScript protocol
    /vbscript:/gi, // VBScript protocol
    /data:text\/html/gi, // Data URIs
    /on\w+\s*=/gi, // Event handlers (onclick, onerror, etc.)
    /&lt;script/gi, // HTML entity encoded script tags
  ],
  // Timeout for Stripe API calls
  STRIPE_TIMEOUT_MS: 10000, // Stripe recommended timeout
} as const;

/**
 * Request body interface
 */
interface GrantAccessRequest {
  accessType: 'temporary' | 'lifetime';
  category: string;
  duration?: number; // Required for temporary, ignored for lifetime
  notes?: string;
  planName: string;
}

/**
 * Type alias for Stripe subscription with explicit trial_end
 * Note: trial_end exists on Stripe.Subscription but TypeScript may need explicit casting
 */
type StripeSubscriptionWithTrial = Stripe.Subscription & {
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
 * Creates a logger instance with consistent formatting
 */
const logger = {
  info: (message: string, data?: unknown) => {
    console.log(`[GrantAccess] ${message}`, data ? JSON.stringify(data) : '');
  },
  warn: (message: string, data?: unknown) => {
    console.warn(`[GrantAccess] ${message}`, data ? JSON.stringify(data) : '');
  },
  error: (message: string, error?: unknown) => {
    console.error(`[GrantAccess] ${message}`, error);
  },
};

/**
 * POST /api/admin/users/[userId]/subscription/grant-access
 *
 * Grants free Premium access to a user.
 *
 * Request Body:
 * - accessType: 'temporary' | 'lifetime'
 * - category: Reason category (service_outage, promotional, etc.)
 * - duration: Number of days (required for temporary)
 * - notes: Additional context (optional, but recommended)
 * - planName: Descriptive name for the custom plan
 *
 * Response:
 * - success: boolean
 * - type: 'temporary' | 'lifetime'
 * - expiresAt?: ISO date string (for temporary grants)
 * - planName: string
 * - subscription?: Stripe subscription object (for temporary grants)
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ userId: string }> }
) {
  try {
    // 1. Verify admin authentication
    const adminUser = await verifyAdminUser();
    if (!adminUser) {
      // Log unauthorized attempt
      logger.warn('Unauthorized grant access attempt');
      return NextResponse.json(
        { success: false, error: 'Unauthorized: Admin access required' },
        { status: 401 }
      );
    }

    // 2. Extract userId from params
    const { userId } = await context.params;

    // 3. Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(userId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid user ID format' },
        { status: 400 }
      );
    }

    // 4. Parse and validate request body
    let body: GrantAccessRequest;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: 'Invalid JSON in request body' },
        { status: 400 }
      );
    }

    const { accessType, category, duration, notes, planName } = body;

    // 5. Validate access type
    if (!VALIDATION.VALID_ACCESS_TYPES.includes(accessType)) {
      return NextResponse.json(
        { success: false, error: 'Invalid access type. Must be "temporary" or "lifetime"' },
        { status: 400 }
      );
    }

    // 6. Validate category
    if (!VALIDATION.VALID_CATEGORIES.includes(category as typeof VALIDATION.VALID_CATEGORIES[number])) {
      return NextResponse.json(
        { success: false, error: 'Invalid category' },
        { status: 400 }
      );
    }

    // 7. Validate plan name
    if (!planName || typeof planName !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Plan name is required' },
        { status: 400 }
      );
    }

    const sanitizedPlanName = sanitizeInput(planName, 'Plan name');
    if (
      sanitizedPlanName.length < VALIDATION.PLAN_NAME_MIN_LENGTH ||
      sanitizedPlanName.length > VALIDATION.PLAN_NAME_MAX_LENGTH
    ) {
      return NextResponse.json(
        { success: false, error: `Plan name must be between ${VALIDATION.PLAN_NAME_MIN_LENGTH} and ${VALIDATION.PLAN_NAME_MAX_LENGTH} characters` },
        { status: 400 }
      );
    }

    // 8. Validate duration for temporary access
    if (accessType === 'temporary') {
      // Explicit validation to prevent 0 or invalid values
      if (typeof duration !== 'number' || !Number.isInteger(duration) || duration < VALIDATION.MIN_DURATION_DAYS) {
        return NextResponse.json(
          { success: false, error: `Duration is required for temporary access and must be a positive integer (minimum ${VALIDATION.MIN_DURATION_DAYS} day)` },
          { status: 400 }
        );
      }

      if (duration > VALIDATION.MAX_DURATION_DAYS) {
        return NextResponse.json(
          { success: false, error: `Duration cannot exceed ${VALIDATION.MAX_DURATION_DAYS} days` },
          { status: 400 }
        );
      }
    }

    // 9. Validate notes
    let sanitizedNotes: string | undefined;
    if (notes) {
      if (typeof notes !== 'string') {
        return NextResponse.json(
          { success: false, error: 'Notes must be a string' },
          { status: 400 }
        );
      }

      sanitizedNotes = sanitizeInput(notes, 'Notes');
      if (sanitizedNotes.length > VALIDATION.NOTES_MAX_LENGTH) {
        return NextResponse.json(
          { success: false, error: `Notes cannot exceed ${VALIDATION.NOTES_MAX_LENGTH} characters` },
          { status: 400 }
        );
      }
    }

    // 10. Require notes for "other" category
    if (category === 'other' && !sanitizedNotes) {
      // Log validation failure for audit trail
      await logAdminAction({
        actionType: 'grant_access_validation_failed',
        targetType: 'profile',
        targetId: userId,
        notes: 'Validation failed: Notes required for "other" category',
        changes: { validation_error: 'missing_notes_for_other', category },
      }).catch(err => console.error('Failed to log validation failure', err));

      return NextResponse.json(
        { success: false, error: 'Notes are required when category is "other"' },
        { status: 400 }
      );
    }

    // 11. Fetch user profile
    const supabase = createAdminServiceClient();
    const { data: user, error: userError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      logger.error('Failed to fetch user profile', userError);
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    // 12. Check for existing active subscription (prevent accidental overwrite)
    if (user.stripe_subscription_id) {
      try {
        const existingSubscription = await fetchWithTimeout(
          stripe.subscriptions.retrieve(user.stripe_subscription_id),
          VALIDATION.STRIPE_TIMEOUT_MS
        ) as unknown as StripeSubscriptionWithTrial;

        if (existingSubscription.status === 'active' && !existingSubscription.cancel_at_period_end) {
          logger.warn('User has active paid subscription', {
            userId,
            subscriptionId: user.stripe_subscription_id,
            status: existingSubscription.status,
          });

          // Log the attempt for audit trail
          await logAdminAction({
            actionType: 'grant_access_blocked_existing_subscription',
            targetType: 'subscription',
            targetId: user.stripe_subscription_id,
            notes: `Blocked grant attempt - user has active subscription`,
            changes: {
              attempted_access_type: accessType,
              attempted_duration: duration,
              category,
              existing_subscription_status: existingSubscription.status,
            },
          }).catch(err => console.error('Failed to log blocked grant', err));

          return NextResponse.json(
            {
              success: false,
              error: 'User has an active paid subscription. Please cancel or modify the existing subscription first, or use the Extend Trial feature instead.',
              existingSubscription: {
                id: existingSubscription.id,
                status: existingSubscription.status,
                current_period_end: existingSubscription.current_period_end,
              },
            },
            { status: 409 } // Conflict
          );
        }
      } catch (error) {
        logger.error('Failed to check existing subscription', error);
        // Continue with grant - don't block if we can't verify
      }
    }

    logger.info('Granting access to user', {
      userId,
      email: user.email,
      accessType,
      duration: accessType === 'temporary' ? duration : 'N/A',
      category,
    });

    // 13. Branch based on access type
    if (accessType === 'temporary') {
      // Temporary access: Create Stripe subscription with 100% discount
      return await grantTemporaryAccess(
        userId,
        user,
        duration!,
        category,
        sanitizedPlanName,
        sanitizedNotes,
        adminUser.id
      );
    } else {
      // Lifetime access: Set database flags
      return await grantLifetimeAccess(
        userId,
        user,
        category,
        sanitizedPlanName,
        sanitizedNotes,
        adminUser.id
      );
    }
  } catch (error) {
    logger.error('Unexpected error in grant access endpoint', error);

    // Log the failed attempt
    try {
      const { userId } = await context.params;
      await logAdminAction({
        actionType: 'grant_access_failed',
        targetType: 'profile',
        targetId: userId,
        notes: `Unexpected error during grant access: ${error instanceof Error ? error.message : 'Unknown error'}`,
        changes: { error: error instanceof Error ? error.message : String(error) },
      }).catch(err => console.error('Failed to log error', err));
    } catch {
      // Silently fail if we can't log
    }

    return NextResponse.json(
      { success: false, error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}

/**
 * Grants temporary access by creating a Stripe subscription with 100% discount
 */
async function grantTemporaryAccess(
  userId: string,
  user: { email: string; stripe_customer_id: string | null },
  durationDays: number,
  category: string,
  planName: string,
  notes: string | undefined,
  adminUserId: string
): Promise<NextResponse> {
  const supabase = createAdminServiceClient();

  try {
    // 1. Ensure user has a Stripe customer ID
    let stripeCustomerId = user.stripe_customer_id;
    if (!stripeCustomerId) {
      logger.info('Creating Stripe customer for user', { userId, email: user.email });

      const customer = await fetchWithTimeout(
        stripe.customers.create({
          email: user.email,
          metadata: {
            supabase_user_id: userId,
          },
        }),
        VALIDATION.STRIPE_TIMEOUT_MS
      );

      stripeCustomerId = customer.id;

      // Update user profile with customer ID
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ stripe_customer_id: stripeCustomerId })
        .eq('id', userId);

      if (updateError) {
        logger.error('Failed to update user with Stripe customer ID', updateError);
        // Continue anyway - we can use the customer ID from memory
      }
    }

    // 2. Calculate trial end date
    const now = Math.floor(Date.now() / 1000);
    const trialEndTimestamp = now + (durationDays * VALIDATION.SECONDS_PER_DAY);
    const trialEndDate = new Date(trialEndTimestamp * 1000).toISOString();

    // 3. Get Premium price ID from environment
    const premiumPriceId = process.env.STRIPE_PREMIUM_MONTHLY_PRICE_ID;
    if (!premiumPriceId) {
      throw new Error('STRIPE_PREMIUM_MONTHLY_PRICE_ID environment variable not set');
    }

    // 4. Create subscription with 100% discount via trial period
    logger.info('Creating Stripe subscription with trial', {
      customerId: stripeCustomerId,
      trialEndTimestamp,
      durationDays,
    });

    const subscription = await fetchWithTimeout(
      stripe.subscriptions.create({
        customer: stripeCustomerId,
        items: [{ price: premiumPriceId }],
        trial_end: trialEndTimestamp,
        payment_behavior: 'default_incomplete', // Don't charge immediately after trial
        metadata: {
          grant_type: 'temporary',
          grant_category: category,
          granted_by: adminUserId,
          grant_plan_name: planName,
        },
      }),
      VALIDATION.STRIPE_TIMEOUT_MS
    ) as unknown as StripeSubscriptionWithTrial;

    // 5. Update user profile in database
    // NOTE: For temporary access, we use Stripe as the source of truth.
    // Custom plan fields are stored as metadata/audit trail only.
    const { error: profileUpdateError } = await supabase
      .from('profiles')
      .update({
        // Stripe-managed fields (source of truth for access)
        stripe_subscription_id: subscription.id,
        subscription_status: subscription.status,
        subscription_tier: 'premium',
        trial_end_date: trialEndDate,
        current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
        // Custom plan fields (metadata/audit only - marked as Stripe-managed)
        custom_plan_name: planName,
        custom_plan_type: 'temporary_stripe', // Indicates Stripe manages this
        custom_plan_notes: notes || `Granted temporary access via Stripe trial (${category})`,
        // Note: custom_plan_expires_at not set - use trial_end_date instead
      })
      .eq('id', userId);

    if (profileUpdateError) {
      logger.error('Failed to update user profile', profileUpdateError);

      // Attempt to rollback the Stripe subscription
      let rollbackSucceeded = false;
      try {
        await fetchWithTimeout(
          stripe.subscriptions.cancel(subscription.id),
          VALIDATION.STRIPE_TIMEOUT_MS
        );
        rollbackSucceeded = true;
        logger.info('Rolled back subscription creation due to database error');
      } catch (rollbackError) {
        logger.error('CRITICAL: Failed to rollback subscription after database error', {
          subscriptionId: subscription.id,
          userId,
          customerId: stripeCustomerId,
          error: rollbackError,
        });

        // Log as critical audit event for manual cleanup
        await logAdminAction({
          actionType: 'grant_access_orphaned_subscription',
          targetType: 'subscription',
          targetId: subscription.id,
          notes: `CRITICAL: Orphaned Stripe subscription created. Database update failed and rollback failed. Manual cleanup required.`,
          changes: {
            user_id: userId,
            subscription_id: subscription.id,
            customer_id: stripeCustomerId,
            database_error: profileUpdateError.message,
            rollback_error: rollbackError instanceof Error ? rollbackError.message : String(rollbackError),
          },
        }).catch(err => {
          console.error('Failed to log orphaned subscription', err);
        });
      }

      // Return appropriate error message
      if (rollbackSucceeded) {
        return NextResponse.json(
          { success: false, error: 'Failed to update user profile. Subscription has been rolled back.' },
          { status: 500 }
        );
      } else {
        return NextResponse.json(
          {
            success: false,
            error: 'Failed to update user profile. CRITICAL: Subscription may exist in Stripe without database record. Engineering has been notified.',
            orphanedSubscriptionId: subscription.id,
          },
          { status: 500 }
        );
      }
    }

    // 6. Log admin action
    await logAdminAction({
      actionType: 'grant_temporary_access',
      targetType: 'subscription',
      targetId: subscription.id,
      notes: notes || `Granted ${durationDays} days of temporary Premium access (${category})`,
      changes: {
        plan_name: planName,
        access_type: 'temporary',
        duration_days: durationDays,
        category,
        expires_at: trialEndDate,
        stripe_subscription_id: subscription.id,
      },
    });

    logger.info('Successfully granted temporary access', {
      userId,
      subscriptionId: subscription.id,
      expiresAt: trialEndDate,
    });

    return NextResponse.json({
      success: true,
      type: 'temporary',
      expiresAt: trialEndDate,
      planName,
      subscription: {
        id: subscription.id,
        status: subscription.status,
        trialEnd: subscription.trial_end,
        currentPeriodEnd: subscription.current_period_end,
      },
    });
  } catch (error) {
    logger.error('Error granting temporary access', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to grant temporary access' },
      { status: 500 }
    );
  }
}

/**
 * Grants lifetime/permanent access by setting database flags
 */
async function grantLifetimeAccess(
  userId: string,
  user: { email: string },
  category: string,
  planName: string,
  notes: string | undefined,
  adminUserId: string
): Promise<NextResponse> {
  const supabase = createAdminServiceClient();

  try {
    logger.info('Granting lifetime access to user', { userId, email: user.email });

    // 1. Update user profile with lifetime access flags
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        custom_plan_name: planName,
        custom_plan_type: 'lifetime',
        custom_plan_expires_at: null, // Lifetime = never expires
        custom_plan_notes: notes || `Granted permanent Premium access (${category})`,
        subscription_tier: 'premium', // Set to premium tier
        subscription_status: 'active', // Mark as active
      })
      .eq('id', userId);

    if (updateError) {
      logger.error('Failed to update user profile for lifetime access', updateError);
      return NextResponse.json(
        { success: false, error: 'Failed to grant lifetime access' },
        { status: 500 }
      );
    }

    // 2. Log admin action
    await logAdminAction({
      actionType: 'grant_lifetime_access',
      targetType: 'profile',
      targetId: userId,
      notes: notes || `Granted permanent Premium access (${category})`,
      changes: {
        plan_name: planName,
        access_type: 'lifetime',
        category,
        admin_granted_by: adminUserId,
      },
    });

    logger.info('Successfully granted lifetime access', { userId });

    return NextResponse.json({
      success: true,
      type: 'lifetime',
      planName,
      expiresAt: null, // Lifetime access never expires
    });
  } catch (error) {
    logger.error('Error granting lifetime access', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to grant lifetime access' },
      { status: 500 }
    );
  }
}
