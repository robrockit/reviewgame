/**
 * @fileoverview API route for generating Stripe Customer Portal URL
 *
 * POST /api/subscription/portal
 * Creates a Stripe Customer Portal session for billing management
 *
 * @module app/api/subscription/portal
 */

import { NextResponse, type NextRequest } from 'next/server';
import Stripe from 'stripe';
import { getAuthenticatedUser } from '@/lib/api/auth';
import { fetchWithTimeout } from '@/lib/utils/stripe';
import { logger } from '@/lib/logger';
import type { PortalSessionResponse } from '@/types/subscription.types';

// Validate Stripe API key is configured
if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('STRIPE_SECRET_KEY environment variable is not configured');
}

// Initialize Stripe with API version pinning for stability
// Using latest Clover version (2025-12-15) as of January 2026
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2025-12-15.clover',
  typescript: true,
});

/**
 * POST /api/subscription/portal
 *
 * Generates a Stripe Customer Portal URL for the authenticated user
 */
export async function POST(req: NextRequest) {
  try {
    // Authenticate user using shared utility
    const { user, supabase, error } = await getAuthenticatedUser();
    if (error) return error;

    // Fetch user's profile from database
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('stripe_customer_id')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      logger.error('Failed to fetch profile for portal session', new Error(profileError?.message || 'Profile not found'), {
        userId: user.id,
        operation: 'createPortalSession',
      });
      return NextResponse.json(
        { error: 'Profile not found' },
        { status: 404 }
      );
    }

    // Check if user has a Stripe customer ID
    if (!profile.stripe_customer_id) {
      return NextResponse.json(
        { error: 'No billing account found' },
        { status: 400 }
      );
    }

    const response: PortalSessionResponse = {
      success: false,
    };

    try {
      // Create portal session with return URL
      const returnUrl = `${req.nextUrl.origin}/dashboard/subscription`;

      const portalSession = await fetchWithTimeout(
        stripe.billingPortal.sessions.create({
          customer: profile.stripe_customer_id,
          return_url: returnUrl,
        }),
        10000
      );

      response.success = true;
      response.url = portalSession.url;

      logger.info('Created Stripe Customer Portal session', {
        userId: user.id,
        customerId: profile.stripe_customer_id,
        operation: 'createPortalSession',
      });
    } catch (stripeError) {
      const err = stripeError instanceof Error ? stripeError : new Error(String(stripeError));
      logger.error('Failed to create portal session in Stripe', err, {
        userId: user.id,
        customerId: profile.stripe_customer_id,
        operation: 'createStripePortalSession',
      });
      response.error = err.message === 'Stripe API request timeout'
        ? 'Stripe API timeout - please try again'
        : 'Failed to create portal session';
      return NextResponse.json(response, { status: 500 });
    }

    return NextResponse.json(response);
  } catch (error) {
    logger.error('Error in POST /api/subscription/portal', error instanceof Error ? error : new Error(String(error)), {
      operation: 'createPortalSession',
    });

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
