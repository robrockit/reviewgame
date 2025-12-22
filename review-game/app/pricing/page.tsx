'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getFeatureList } from '@/lib/utils/feature-access';
import type { Tables } from '@/types/database.types';
import type { UserContextResponse } from '@/app/api/user/context/route';

type Profile = Tables<'profiles'>;

interface PricingTier {
  name: string;
  tier: 'FREE' | 'BASIC' | 'PREMIUM';
  monthlyPrice: number;
  annualPrice: number;
  description: string;
  priceIds: {
    monthly: string | null;
    annual: string | null;
  };
  highlight: boolean;
}

const pricingTiers: PricingTier[] = [
  {
    name: 'Free',
    tier: 'FREE',
    monthlyPrice: 0,
    annualPrice: 0,
    description: 'Perfect for trying out Review Game',
    priceIds: {
      monthly: null,
      annual: null,
    },
    highlight: false,
  },
  {
    name: 'Basic',
    tier: 'BASIC',
    monthlyPrice: 4.99,
    annualPrice: 49,
    description: 'For educators creating engaging review games',
    priceIds: {
      monthly: process.env.NEXT_PUBLIC_STRIPE_BASIC_MONTHLY_PRICE_ID || null,
      annual: process.env.NEXT_PUBLIC_STRIPE_BASIC_ANNUAL_PRICE_ID || null,
    },
    highlight: false,
  },
  {
    name: 'Premium',
    tier: 'PREMIUM',
    monthlyPrice: 7.99,
    annualPrice: 69,
    description: 'Advanced features for power users',
    priceIds: {
      monthly: process.env.NEXT_PUBLIC_STRIPE_PREMIUM_MONTHLY_PRICE_ID || null,
      annual: process.env.NEXT_PUBLIC_STRIPE_PREMIUM_ANNUAL_PRICE_ID || null,
    },
    highlight: true,
  },
];

export default function PricingPage() {
  const router = useRouter();
  const [isAnnual, setIsAnnual] = useState(false);
  const [isLoading, setIsLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [userContext, setUserContext] = useState<UserContextResponse | null>(null);
  const [paymentSuccess, setPaymentSuccess] = useState(false);

  // Fetch user context on mount
  useEffect(() => {
    const fetchUserContext = async () => {
      try {
        const response = await fetch('/api/user/context');
        if (response.ok) {
          const data = await response.json();
          setUserContext(data);
        }
      } catch (err) {
        // User not logged in or error fetching context - that's okay
        console.log('User context not available:', err);
      }
    };

    fetchUserContext();

    // Check for payment success parameter
    const searchParams = new URLSearchParams(window.location.search);
    const success = searchParams.get('payment') === 'success';
    setPaymentSuccess(success);
  }, []);

  const handleCheckout = async (tier: PricingTier, billingPeriod: 'monthly' | 'annual') => {
    setIsLoading(tier.tier);
    setError(null);

    try {
      const priceId = billingPeriod === 'monthly' ? tier.priceIds.monthly : tier.priceIds.annual;

      if (!priceId) {
        throw new Error('Price ID not configured');
      }

      const response = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ priceId }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create checkout session');
      }

      const session = await response.json();
      window.location.href = session.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      setIsLoading(null);
    }
  };

  const getCurrentTier = (): string | null => {
    if (!userContext?.profile) return null;
    return userContext.profile.subscription_tier?.toUpperCase() || 'FREE';
  };

  const isCurrentPlan = (tier: string): boolean => {
    const currentTier = getCurrentTier();
    return currentTier === tier;
  };

  // Create a mock profile for feature comparison
  const createMockProfile = (tier: 'FREE' | 'BASIC' | 'PREMIUM'): Profile => {
    return {
      id: 'mock-id',
      email: 'mock@example.com',
      subscription_tier: tier,
      subscription_status: 'ACTIVE',
      role: 'user',
      is_active: true,
      games_created_count: tier === 'FREE' ? 0 : 100,
      full_name: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      last_login_at: null,
      stripe_customer_id: null,
      stripe_subscription_id: null,
      billing_cycle: null,
      current_period_end: null,
      trial_end_date: null,
      admin_notes: null,
      suspension_reason: null,
      email_verified_manually: null,
      custom_plan_type: null,
      custom_plan_name: null,
      custom_plan_expires_at: null,
      custom_plan_notes: null,
      plan_override_limits: null,
    } as Profile;
  };

  const getSavings = (monthlyPrice: number, annualPrice: number): number => {
    return monthlyPrice * 12 - annualPrice;
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      {/* Success Message */}
      {paymentSuccess && (
        <div className="bg-green-50 border-l-4 border-green-400 p-4 mb-8">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-green-700">
                Payment successful! Your subscription is now active with a 30-day free trial.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="container mx-auto px-4 py-16">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold text-gray-900 mb-4">
            Choose Your Plan
          </h1>
          <p className="text-xl text-gray-600 mb-8">
            Start with a 30-day free trial. Cancel anytime.
          </p>

          {/* Billing Toggle */}
          <div className="inline-flex items-center bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setIsAnnual(false)}
              className={`px-6 py-2 rounded-md font-medium transition-all ${
                !isAnnual
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setIsAnnual(true)}
              className={`px-6 py-2 rounded-md font-medium transition-all ${
                isAnnual
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Annual
              <span className="ml-2 text-xs text-green-600 font-semibold">Save up to $27</span>
            </button>
          </div>
        </div>

        {/* Pricing Cards */}
        <div className="grid md:grid-cols-3 gap-8 max-w-7xl mx-auto mb-16">
          {pricingTiers.map((tier) => {
            const features = getFeatureList(createMockProfile(tier.tier));
            const price = isAnnual ? tier.annualPrice : tier.monthlyPrice;
            const savings = getSavings(tier.monthlyPrice, tier.annualPrice);
            const currentPlan = isCurrentPlan(tier.tier);

            return (
              <div
                key={tier.tier}
                className={`relative bg-white rounded-2xl shadow-xl overflow-hidden transition-transform hover:scale-105 ${
                  tier.highlight ? 'ring-2 ring-blue-600' : ''
                } ${currentPlan ? 'ring-2 ring-green-600' : ''}`}
              >
                {/* Popular Badge */}
                {tier.highlight && !currentPlan && (
                  <div className="absolute top-0 right-0 bg-blue-600 text-white text-xs font-bold px-4 py-1 rounded-bl-lg">
                    POPULAR
                  </div>
                )}

                {/* Current Plan Badge */}
                {currentPlan && (
                  <div className="absolute top-0 right-0 bg-green-600 text-white text-xs font-bold px-4 py-1 rounded-bl-lg">
                    CURRENT PLAN
                  </div>
                )}

                <div className="p-8">
                  {/* Tier Name & Description */}
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">{tier.name}</h3>
                  <p className="text-gray-600 mb-6">{tier.description}</p>

                  {/* Pricing */}
                  <div className="mb-6">
                    {tier.tier === 'FREE' ? (
                      <div>
                        <span className="text-5xl font-bold text-gray-900">$0</span>
                        <span className="text-gray-600 ml-2">forever</span>
                      </div>
                    ) : (
                      <div>
                        <span className="text-5xl font-bold text-gray-900">${price}</span>
                        <span className="text-gray-600 ml-2">
                          {isAnnual ? '/year' : '/month'}
                        </span>
                        {isAnnual && savings > 0 && (
                          <div className="text-sm text-green-600 font-semibold mt-1">
                            Save ${savings} per year
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* CTA Button */}
                  {tier.tier === 'FREE' ? (
                    <button
                      onClick={() => router.push('/auth/signup')}
                      className="w-full bg-gray-800 hover:bg-gray-900 text-white font-bold py-3 px-6 rounded-lg transition-colors"
                    >
                      Get Started Free
                    </button>
                  ) : currentPlan ? (
                    <button
                      disabled
                      className="w-full bg-gray-300 text-gray-600 font-bold py-3 px-6 rounded-lg cursor-not-allowed"
                    >
                      Current Plan
                    </button>
                  ) : (
                    <button
                      onClick={() => handleCheckout(tier, isAnnual ? 'annual' : 'monthly')}
                      disabled={isLoading === tier.tier}
                      className={`w-full font-bold py-3 px-6 rounded-lg transition-colors ${
                        tier.highlight
                          ? 'bg-blue-600 hover:bg-blue-700 text-white'
                          : 'bg-gray-800 hover:bg-gray-900 text-white'
                      } disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                      {isLoading === tier.tier
                        ? 'Processing...'
                        : 'Start 30-Day Free Trial'}
                    </button>
                  )}

                  {/* Trial Info */}
                  {tier.tier !== 'FREE' && !currentPlan && (
                    <p className="text-sm text-gray-500 text-center mt-3">
                      No payment required for trial
                    </p>
                  )}

                  {/* Features List */}
                  <div className="mt-8 pt-8 border-t border-gray-200">
                    <h4 className="font-semibold text-gray-900 mb-4">What&apos;s included:</h4>
                    <ul className="space-y-3">
                      {features.filter(f => f.enabled).map((feature) => (
                        <li key={feature.id} className="flex items-start">
                          <svg
                            className="w-5 h-5 text-green-500 mr-3 flex-shrink-0 mt-0.5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth="2"
                              d="M5 13l4 4L19 7"
                            />
                          </svg>
                          <div>
                            <span className="text-gray-900">{feature.name}</span>
                            <p className="text-sm text-gray-500">{feature.description}</p>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Feature Comparison Table */}
        <div className="max-w-7xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-8">Feature Comparison</h2>
          <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="py-4 px-6 text-left text-sm font-semibold text-gray-900">
                      Feature
                    </th>
                    <th className="py-4 px-6 text-center text-sm font-semibold text-gray-900">
                      Free
                    </th>
                    <th className="py-4 px-6 text-center text-sm font-semibold text-gray-900">
                      Basic
                    </th>
                    <th className="py-4 px-6 text-center text-sm font-semibold text-gray-900">
                      Premium
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {/* Get all unique features across all tiers */}
                  {Array.from(
                    new Set(
                      pricingTiers.flatMap((tier) =>
                        getFeatureList(createMockProfile(tier.tier)).map((f) => f.id)
                      )
                    )
                  ).map((featureId) => {
                    const freeFeature = getFeatureList(createMockProfile('FREE')).find(
                      (f) => f.id === featureId
                    );
                    const basicFeature = getFeatureList(createMockProfile('BASIC')).find(
                      (f) => f.id === featureId
                    );
                    const premiumFeature = getFeatureList(createMockProfile('PREMIUM')).find(
                      (f) => f.id === featureId
                    );

                    const feature = freeFeature || basicFeature || premiumFeature;
                    if (!feature) return null;

                    return (
                      <tr key={featureId} className="hover:bg-gray-50">
                        <td className="py-4 px-6">
                          <div>
                            <div className="font-medium text-gray-900">{feature.name}</div>
                            <div className="text-sm text-gray-500">{feature.description}</div>
                          </div>
                        </td>
                        <td className="py-4 px-6 text-center">
                          {freeFeature?.enabled ? (
                            <span className="text-green-600 text-xl">✓</span>
                          ) : (
                            <span className="text-gray-300 text-xl">−</span>
                          )}
                        </td>
                        <td className="py-4 px-6 text-center">
                          {basicFeature?.enabled ? (
                            <span className="text-green-600 text-xl">✓</span>
                          ) : (
                            <span className="text-gray-300 text-xl">−</span>
                          )}
                        </td>
                        <td className="py-4 px-6 text-center">
                          {premiumFeature?.enabled ? (
                            <span className="text-green-600 text-xl">✓</span>
                          ) : (
                            <span className="text-gray-300 text-xl">−</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mt-8 bg-red-50 border-l-4 border-red-400 p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg
                  className="h-5 w-5 text-red-400"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* FAQ or Trust Badges Section */}
        <div className="mt-16 text-center">
          <p className="text-gray-600">
            All plans include a 30-day free trial. No credit card required.
          </p>
          <p className="text-gray-600 mt-2">
            Cancel anytime. No questions asked.
          </p>
        </div>
      </div>
    </div>
  );
}
