/**
 * @fileoverview API route to process payment refunds
 *
 * POST /api/admin/payments/[paymentId]/refund
 * Processes full or partial refunds via Stripe and records them in the database
 *
 * @module app/api/admin/payments/[paymentId]/refund
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
 * Refund reason categories matching database enum
 */
export type RefundReasonCategory =
  | 'technical_issue'
  | 'user_request'
  | 'duplicate_charge'
  | 'fraudulent'
  | 'service_outage'
  | 'other';

/**
 * Refund request body interface
 */
export interface RefundRequest {
  refundType: 'full' | 'partial';
  amount?: number; // Required for partial refunds (in cents)
  reasonCategory: RefundReasonCategory;
  notes: string;
}

/**
 * Refund response interface
 */
export interface RefundResponse {
  success: boolean;
  refund?: {
    id: string;
    amount: number;
    currency: string;
    status: string;
    created: string;
  };
  error?: string;
}

/**
 * Validation constants for input sanitization
 */
const VALIDATION = {
  NOTES_MIN_LENGTH: 10,
  NOTES_MAX_LENGTH: 1000,
  // Patterns to detect and reject potentially dangerous content
  FORBIDDEN_PATTERNS: [
    /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, // Control characters (except \t, \n, \r)
    /<script[^>]*>.*?<\/script>/gi, // Script tags
    /javascript:/gi, // JavaScript protocol
    /on\w+\s*=/gi, // Event handlers like onclick=, onload=, etc.
  ],
  STRIPE_TIMEOUT_MS: 10000,
} as const;

/**
 * Valid refund reason categories
 */
const VALID_REASON_CATEGORIES: RefundReasonCategory[] = [
  'technical_issue',
  'user_request',
  'duplicate_charge',
  'fraudulent',
  'service_outage',
  'other',
];

/**
 * POST /api/admin/payments/[paymentId]/refund
 *
 * Processes a full or partial refund for a payment
 *
 * Security Notes:
 * - CSRF Protection: This endpoint relies on Next.js's built-in SameSite cookie protection
 *   and admin authentication via verifyAdminUser(). The authentication cookie has SameSite=Lax
 *   which prevents CSRF attacks from external sites. For enhanced security, consider implementing
 *   explicit CSRF tokens or migrating to Next.js Server Actions which have built-in CSRF protection.
 * - Admin Only: Only authenticated admin users can access this endpoint
 * - Financial Operation: Processes real money refunds - all actions are logged to audit trail
 */
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ paymentId: string }> }
) {
  try {
    // Verify admin authentication
    // This provides CSRF protection via SameSite cookies and session validation
    const adminUser = await verifyAdminUser();
    if (!adminUser) {
      logger.warn('Unauthorized refund attempt', {
        operation: 'processRefund',
      });
      return NextResponse.json(
        { success: false, error: 'Unauthorized: Admin access required' },
        { status: 401 }
      );
    }

    const { paymentId } = await context.params;

    // Validate payment ID format (Stripe charge ID format: ch_xxx or py_xxx)
    if (!paymentId.match(/^(ch|py)_[a-zA-Z0-9]+$/)) {
      return NextResponse.json(
        { success: false, error: 'Invalid payment ID format' },
        { status: 400 }
      );
    }

    // Parse and validate request body
    const body: RefundRequest = await req.json();
    const { refundType, amount, reasonCategory } = body;
    let notes = body.notes; // Reassigned later for sanitization

    // Validate required fields
    if (!refundType || !reasonCategory || !notes) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: refundType, reasonCategory, notes' },
        { status: 400 }
      );
    }

    // Validate refund type
    if (refundType !== 'full' && refundType !== 'partial') {
      return NextResponse.json(
        { success: false, error: 'refundType must be either "full" or "partial"' },
        { status: 400 }
      );
    }

    // Validate partial refund amount
    if (refundType === 'partial') {
      if (typeof amount !== 'number' || !Number.isInteger(amount) || amount <= 0) {
        return NextResponse.json(
          { success: false, error: 'Partial refunds require a positive integer amount in cents' },
          { status: 400 }
        );
      }

      // Validate minimum refund amount (Stripe minimum is $0.50 for USD)
      // Note: This varies by currency (e.g., 50 JPY), but we use USD minimum for now
      const minimumRefundCents = 50; // $0.50
      if (amount < minimumRefundCents) {
        return NextResponse.json(
          { success: false, error: `Refund amount must be at least $${(minimumRefundCents / 100).toFixed(2)}` },
          { status: 400 }
        );
      }
    }

    // Validate reason category
    if (!VALID_REASON_CATEGORIES.includes(reasonCategory)) {
      return NextResponse.json(
        { success: false, error: `Invalid reason category. Must be one of: ${VALID_REASON_CATEGORIES.join(', ')}` },
        { status: 400 }
      );
    }

    // Sanitize and validate notes
    notes = notes.trim();

    if (notes.length < VALIDATION.NOTES_MIN_LENGTH) {
      return NextResponse.json(
        { success: false, error: `Notes must be at least ${VALIDATION.NOTES_MIN_LENGTH} characters` },
        { status: 400 }
      );
    }

    if (notes.length > VALIDATION.NOTES_MAX_LENGTH) {
      return NextResponse.json(
        { success: false, error: `Notes must be ${VALIDATION.NOTES_MAX_LENGTH} characters or less` },
        { status: 400 }
      );
    }

    // Check for forbidden patterns (XSS prevention)
    for (const pattern of VALIDATION.FORBIDDEN_PATTERNS) {
      if (pattern.test(notes)) {
        logger.warn('Rejected refund notes with forbidden pattern', {
          operation: 'processRefund',
          adminId: adminUser.id,
          pattern: pattern.source,
        });

        return NextResponse.json(
          { success: false, error: 'Notes contain invalid characters or patterns. Please remove any HTML tags, scripts, or control characters.' },
          { status: 400 }
        );
      }
    }

    const response: RefundResponse = {
      success: false,
    };

    try {
      // Fetch the original charge from Stripe
      const charge = await fetchWithTimeout(
        stripe.charges.retrieve(paymentId),
        VALIDATION.STRIPE_TIMEOUT_MS
      );

      // Verify charge exists and has a customer
      if (!charge) {
        return NextResponse.json(
          { success: false, error: 'Payment not found' },
          { status: 404 }
        );
      }

      // Check if charge is already fully refunded
      if (charge.refunded) {
        return NextResponse.json(
          { success: false, error: 'This payment has already been fully refunded' },
          { status: 400 }
        );
      }

      // Calculate refund amount
      const refundAmount = refundType === 'full' ? undefined : amount;

      // Validate partial refund amount doesn't exceed remaining amount
      if (refundType === 'partial' && refundAmount) {
        const remainingAmount = charge.amount - charge.amount_refunded;
        if (refundAmount > remainingAmount) {
          return NextResponse.json(
            {
              success: false,
              error: `Refund amount ($${(refundAmount / 100).toFixed(2)}) exceeds remaining refundable amount ($${(remainingAmount / 100).toFixed(2)})`
            },
            { status: 400 }
          );
        }
      }

      // Process refund via Stripe
      // Sanitize notes for Stripe metadata (remove special characters that could cause issues)
      const sanitizedMetadataNotes = notes
        .substring(0, 500) // Stripe metadata has 500 char limit
        .replace(/[^\w\s.,!?'-]/g, '') // Keep only alphanumeric, spaces, and basic punctuation
        .trim();

      const refund = await fetchWithTimeout(
        stripe.refunds.create({
          charge: paymentId,
          amount: refundAmount,
          reason: 'requested_by_customer', // Stripe's generic reason
          metadata: {
            reason_category: reasonCategory,
            admin_notes: sanitizedMetadataNotes,
            refunded_by: adminUser.id,
          },
        }),
        VALIDATION.STRIPE_TIMEOUT_MS
      );

      // Get customer ID to lookup user in database
      const customerId = typeof charge.customer === 'string'
        ? charge.customer
        : charge.customer?.id;

      if (!customerId) {
        logger.error('Charge has no customer ID', new Error('Missing customer ID'), {
          operation: 'processRefund',
          chargeId: paymentId,
        });
        return NextResponse.json(
          { success: false, error: 'Unable to identify customer for this payment' },
          { status: 400 }
        );
      }

      // Find user in database by Stripe customer ID
      const supabase = createAdminServiceClient();
      const { data: user, error: userError } = await supabase
        .from('profiles')
        .select('id, email')
        .eq('stripe_customer_id', customerId)
        .single();

      if (userError || !user) {
        logger.error('Failed to find user for refund', new Error(userError?.message || 'User not found'), {
          operation: 'processRefund',
          customerId,
          chargeId: paymentId,
        });
        return NextResponse.json(
          { success: false, error: 'Unable to find user for this payment' },
          { status: 404 }
        );
      }

      // Record refund in database
      // NOTE: This is not a true database transaction. If this fails after Stripe succeeds,
      // there will be a data inconsistency that requires manual reconciliation.
      // Future improvement: Implement a pending_refunds queue table with background reconciliation.
      const { error: insertError } = await supabase
        .from('refunds')
        .insert({
          user_id: user.id,
          stripe_refund_id: refund.id,
          stripe_charge_id: paymentId,
          amount_cents: refund.amount,
          currency: refund.currency,
          reason_category: reasonCategory,
          notes,
          refunded_by: adminUser.id,
        });

      if (insertError) {
        // CRITICAL: Stripe refund succeeded but database record failed
        // This creates a data inconsistency that requires immediate attention
        logger.error('CRITICAL: Refund processed in Stripe but database insert failed', new Error(insertError.message), {
          operation: 'refund_db_insert_failed',
          severity: 'CRITICAL',
          refundId: refund.id,
          chargeId: paymentId,
          userId: user.id,
          userEmail: user.email,
          amount: refund.amount,
          currency: refund.currency,
          adminUserId: adminUser.id,
          reasonCategory,
          // Include full error details for manual reconciliation
          errorMessage: insertError.message,
          errorDetails: JSON.stringify(insertError),
        });

        // Try to log this critical error to admin audit log for visibility
        try {
          await logAdminAction({
            actionType: 'refund_db_failure',
            targetType: 'payment',
            targetId: paymentId,
            changes: {
              stripe_refund_id: refund.id,
              database_error: insertError.message,
              requires_manual_reconciliation: true,
            },
            reason: 'CRITICAL: Database insert failed after successful Stripe refund',
            notes: `Refund ID: ${refund.id}. This requires immediate manual reconciliation.`,
          });
        } catch {
          // Ignore audit log errors in this critical path
        }

        return NextResponse.json(
          {
            success: false,
            error: 'Refund processed in Stripe but failed to record in database. CRITICAL: Manual reconciliation required. Refund ID: ' + refund.id
          },
          { status: 500 }
        );
      }

      // Check if this refund is for a subscription payment and update subscription status if needed
      const chargeWithInvoice = charge as unknown as { invoice?: string | { id: string } | null };
      if (chargeWithInvoice.invoice) {
        const invoiceId = typeof chargeWithInvoice.invoice === 'string'
          ? chargeWithInvoice.invoice
          : chargeWithInvoice.invoice.id;

        try {
          const invoice = await fetchWithTimeout(
            stripe.invoices.retrieve(invoiceId),
            VALIDATION.STRIPE_TIMEOUT_MS
          );

          // If this invoice is for a subscription, we might need to update subscription status
          const invoiceWithSubscription = invoice as unknown as { subscription?: string | { id: string } | null };
          if (invoiceWithSubscription.subscription) {
            const subscriptionId = typeof invoiceWithSubscription.subscription === 'string'
              ? invoiceWithSubscription.subscription
              : invoiceWithSubscription.subscription.id;

            // Fetch subscription to check current status
            const subscription = await fetchWithTimeout(
              stripe.subscriptions.retrieve(subscriptionId),
              VALIDATION.STRIPE_TIMEOUT_MS
            );

            // Update database with subscription status
            // Use updated_at for optimistic locking to prevent race conditions
            const { data: currentProfile } = await supabase
              .from('profiles')
              .select('updated_at')
              .eq('stripe_subscription_id', subscriptionId)
              .single();

            if (currentProfile && currentProfile.updated_at) {
              const { error: updateError } = await supabase
                .from('profiles')
                .update({
                  subscription_status: subscription.status,
                })
                .eq('stripe_subscription_id', subscriptionId)
                .eq('updated_at', currentProfile.updated_at); // Optimistic locking

              if (updateError) {
                logger.warn('Subscription status update skipped due to concurrent modification', {
                  operation: 'processRefund',
                  subscriptionId,
                  error: updateError.message,
                });
              }
            } else if (currentProfile) {
              // If updated_at is null, just update without optimistic locking
              await supabase
                .from('profiles')
                .update({
                  subscription_status: subscription.status,
                })
                .eq('stripe_subscription_id', subscriptionId);
            }

            logger.info('Updated subscription status after refund', {
              operation: 'processRefund',
              subscriptionId,
              status: subscription.status,
            });
          }
        } catch (invoiceError) {
          // Log error but don't fail the refund
          logger.error('Failed to update subscription status after refund', invoiceError instanceof Error ? invoiceError : new Error(String(invoiceError)), {
            operation: 'processRefund',
            invoiceId,
          });
        }
      }

      // Log the admin action
      await logAdminAction({
        actionType: 'process_refund',
        targetType: 'payment',
        targetId: paymentId,
        changes: {
          refund_type: refundType,
          refund_amount: refund.amount,
          refund_id: refund.id,
          original_charge_amount: charge.amount,
          reason_category: reasonCategory,
        },
        reason: `Refund: ${reasonCategory}`,
        notes,
      });

      response.success = true;
      response.refund = {
        id: refund.id,
        amount: refund.amount || 0,
        currency: refund.currency,
        status: refund.status || 'succeeded',
        created: new Date(refund.created * 1000).toISOString(),
      };

      logger.info('Refund processed successfully', {
        operation: 'processRefund',
        adminUserId: adminUser.id,
        refundId: refund.id,
        chargeId: paymentId,
        amount: refund.amount,
        refundType,
      });
    } catch (stripeError) {
      const error = stripeError instanceof Error ? stripeError : new Error(String(stripeError));
      logger.error('Failed to process refund in Stripe', error, {
        operation: 'processRefund',
        chargeId: paymentId,
        refundType,
      });

      response.error = error.message === 'Stripe API request timeout'
        ? 'Stripe API timeout - please try again'
        : `Failed to process refund: ${error.message}`;

      return NextResponse.json(response, { status: 500 });
    }

    return NextResponse.json(response);
  } catch (error) {
    logger.error('Error in POST /api/admin/payments/[paymentId]/refund', error instanceof Error ? error : new Error(String(error)), {
      operation: 'processRefund',
    });

    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
