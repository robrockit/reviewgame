/**
 * @fileoverview API route to fetch payment history from Stripe
 *
 * GET /api/admin/users/[userId]/payments
 * Returns payment history for a user from Stripe API
 *
 * @module app/api/admin/users/[userId]/payments
 */

import { NextResponse, type NextRequest } from 'next/server';
import Stripe from 'stripe';
import { verifyAdminUser, createAdminServiceClient, logAdminAction } from '@/lib/admin/auth';
import { logger } from '@/lib/logger';
import { headers } from 'next/headers';
import { getClientIpAddress, getClientUserAgent } from '@/lib/admin/request-utils';

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

/**
 * Payment record interface
 */
export interface PaymentRecord {
  id: string;
  amount: number;
  currency: string;
  status: string;
  created: string;
  description: string | null;
  paymentMethod: string | null;
  receiptUrl: string | null;
  refunded: boolean;
  refundedAmount: number;
  invoiceId: string | null;
  type: 'charge' | 'refund';
}

/**
 * Payment history response interface
 */
export interface PaymentHistoryResponse {
  payments: PaymentRecord[];
  hasMore: boolean;
  error?: string;
}

/**
 * GET /api/admin/users/[userId]/payments
 *
 * Fetches payment history from Stripe
 * Query params:
 * - limit: number of payments to return (default: 50, max: 100)
 * - starting_after: cursor for pagination
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
    const { searchParams } = new URL(req.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
    const startingAfter = searchParams.get('starting_after') || undefined;

    // Get request metadata for audit logging (sanitized and validated)
    const headersList = await headers();
    const ipAddress = getClientIpAddress(headersList);
    const userAgent = getClientUserAgent(headersList);

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(userId)) {
      return NextResponse.json(
        { error: 'Invalid user ID format' },
        { status: 400 }
      );
    }

    // Fetch user's Stripe customer ID from database
    const supabase = createAdminServiceClient();
    const { data: user, error: userError } = await supabase
      .from('profiles')
      .select('stripe_customer_id, email')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      logger.error('Failed to fetch user for payment history', new Error(userError?.message || 'User not found'), {
        userId,
        operation: 'fetchUserForPayments',
      });
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // If no Stripe customer ID, return empty history
    if (!user.stripe_customer_id) {
      return NextResponse.json({
        payments: [],
        hasMore: false,
      });
    }

    const response: PaymentHistoryResponse = {
      payments: [],
      hasMore: false,
    };

    try {
      // Fetch charges from Stripe with timeout
      const charges = await fetchWithTimeout(
        stripe.charges.list({
          customer: user.stripe_customer_id,
          limit,
          starting_after: startingAfter,
        }),
        10000 // 10 second timeout
      );

      // Transform charges into payment records
      response.payments = charges.data.map((charge) => {
        // Handle payment_method which can be string | PaymentMethod | null
        let paymentMethodId: string | null = null;
        if (typeof charge.payment_method === 'string') {
          paymentMethodId = charge.payment_method;
        } else if (charge.payment_method && typeof charge.payment_method === 'object' && 'id' in charge.payment_method) {
          paymentMethodId = (charge.payment_method as { id: string }).id;
        }

        // Handle invoice which can be string | Invoice | null
        let invoiceIdStr: string | null = null;
        const invoice = (charge as { invoice?: string | { id: string } | null }).invoice;
        if (typeof invoice === 'string') {
          invoiceIdStr = invoice;
        } else if (invoice && typeof invoice === 'object' && 'id' in invoice) {
          invoiceIdStr = (invoice as { id: string }).id;
        }

        return {
          id: charge.id,
          amount: charge.amount,
          currency: charge.currency,
          status: charge.status,
          created: new Date(charge.created * 1000).toISOString(),
          description: charge.description,
          paymentMethod: paymentMethodId,
          receiptUrl: charge.receipt_url,
          refunded: charge.refunded,
          refundedAmount: charge.amount_refunded,
          invoiceId: invoiceIdStr,
          type: 'charge',
        };
      });

      response.hasMore = charges.has_more;

      // Log successful retrieval
      logger.info('Payment history retrieved', {
        userId,
        adminUserId: adminUser.id,
        paymentCount: response.payments.length,
        operation: 'getPaymentHistory',
      });

      // Log admin action to audit trail
      // IMPORTANT: Audit logging failures should not break the request,
      // but must be logged for compliance monitoring
      try {
        await logAdminAction({
          actionType: 'view_payment_history',
          targetType: 'user',
          targetId: userId,
          changes: {
            payment_count: Math.min(response.payments.length, 1000), // Cap to prevent huge values
            has_more: !!response.hasMore,
          },
          ipAddress,
          userAgent,
        });
      } catch (auditError) {
        // Log the failure but don't break the request
        // Audit log failures are serious and should trigger alerts
        logger.error('CRITICAL: Failed to log admin action to audit trail',
          auditError instanceof Error ? auditError : new Error(String(auditError)),
          {
            userId,
            adminUserId: adminUser.id,
            actionType: 'view_payment_history',
            operation: 'auditLogging',
            complianceImpact: true, // Flag for monitoring/alerting systems
          }
        );
      }
    } catch (stripeError) {
      logger.error('Failed to fetch payment history from Stripe', stripeError instanceof Error ? stripeError : new Error(String(stripeError)), {
        userId,
        customerId: user.stripe_customer_id,
        operation: 'fetchStripeCharges',
      });
      response.error = 'Failed to fetch payment history from Stripe';
    }

    return NextResponse.json(response);
  } catch (error) {
    logger.error('Error in GET /api/admin/users/[userId]/payments', error instanceof Error ? error : new Error(String(error)), {
      operation: 'getPaymentHistory',
    });

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
