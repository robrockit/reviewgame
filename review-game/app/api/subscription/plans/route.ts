/**
 * @fileoverview API route for fetching available subscription plans
 *
 * GET /api/subscription/plans
 * Returns available plans without exposing price IDs to client bundle
 *
 * @module app/api/subscription/plans
 */

import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/api/auth';
import { logger } from '@/lib/logger';
import type { PlansResponse } from '@/types/subscription.types';

/**
 * GET /api/subscription/plans
 *
 * Fetches available subscription plans from server configuration
 * Price IDs are kept server-side for security
 */
export async function GET() {
  try {
    // Authenticate user
    const { user, error } = await getAuthenticatedUser();
    if (error) return error;

    // Server-side configuration - NOT exposed to client bundle
    const plans: PlansResponse['plans'] = [
      {
        tier: 'BASIC',
        billingCycle: 'monthly',
        priceId: process.env.NEXT_PUBLIC_STRIPE_BASIC_MONTHLY_PRICE_ID || '',
        price: 5.99,
        label: 'Basic Monthly',
        description: '$5.99/month',
        features: [
          'Unlimited games',
          'Custom question banks',
          'Video & images',
          'Custom team names',
          'Up to 10 teams per game',
        ],
      },
      {
        tier: 'BASIC',
        billingCycle: 'annual',
        priceId: process.env.NEXT_PUBLIC_STRIPE_BASIC_ANNUAL_PRICE_ID || '',
        price: 59.99,
        label: 'Basic Annual',
        description: '$59.99/year (Save 17%)',
        features: [
          'Unlimited games',
          'Custom question banks',
          'Video & images',
          'Custom team names',
          'Up to 10 teams per game',
        ],
      },
      {
        tier: 'PREMIUM',
        billingCycle: 'monthly',
        priceId: process.env.NEXT_PUBLIC_STRIPE_PREMIUM_MONTHLY_PRICE_ID || '',
        price: 9.99,
        label: 'Premium Monthly',
        description: '$9.99/month',
        features: [
          'Everything in Basic',
          'AI question generation',
          'Community question banks',
          'Google Classroom integration',
          'Advanced analytics',
          'Up to 15 teams per game',
        ],
      },
      {
        tier: 'PREMIUM',
        billingCycle: 'annual',
        priceId: process.env.NEXT_PUBLIC_STRIPE_PREMIUM_ANNUAL_PRICE_ID || '',
        price: 99.99,
        label: 'Premium Annual',
        description: '$99.99/year (Save 17%)',
        features: [
          'Everything in Basic',
          'AI question generation',
          'Community question banks',
          'Google Classroom integration',
          'Advanced analytics',
          'Up to 15 teams per game',
        ],
      },
    ];

    // Filter out plans with missing price IDs
    const validPlans = plans.filter(plan => plan.priceId);

    if (validPlans.length === 0) {
      logger.error('No valid plans configured', new Error('Missing price IDs'), {
        operation: 'getPlans',
        userId: user!.id,
      });
      return NextResponse.json(
        { error: 'Plans not configured' },
        { status: 500 }
      );
    }

    logger.info('Plans fetched successfully', {
      userId: user!.id,
      operation: 'getPlans',
      planCount: validPlans.length,
    });

    return NextResponse.json({ plans: validPlans });
  } catch (error) {
    logger.error('Error in GET /api/subscription/plans', error instanceof Error ? error : new Error(String(error)), {
      operation: 'getPlans',
    });

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
