/**
 * FeatureList Component
 *
 * Displays all features and their access status for the current subscription tier
 */

import { getFeatureList } from '@/lib/utils/feature-access';
import type { SubscriptionStatusResponse } from '@/types/subscription.types';
import type { Tables } from '@/types/database.types';

interface FeatureListProps {
  subscription: SubscriptionStatusResponse;
}

export default function FeatureList({ subscription }: FeatureListProps) {
  // Create a mock profile object for feature-access functions
  const mockProfile: Partial<Tables<'profiles'>> = {
    subscription_tier: subscription.subscription_tier,
    subscription_status: subscription.subscription_status,
    games_created_count: subscription.games_created_count,
  };

  const features = getFeatureList(mockProfile as Tables<'profiles'>);

  // Group features by tier
  const freeFeatures = features.filter(f => f.requiredTier === 'FREE');
  const basicFeatures = features.filter(f => f.requiredTier === 'BASIC');
  const premiumFeatures = features.filter(f => f.requiredTier === 'PREMIUM');

  return (
    <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
      <h2 className="text-xl font-semibold mb-4">Features</h2>

      <div className="space-y-6">
        {/* FREE Tier Features */}
        {freeFeatures.length > 0 && (
          <div>
            <h3 className="text-sm font-medium text-gray-500 mb-3">FREE TIER</h3>
            <div className="space-y-2">
              {freeFeatures.map((feature) => (
                <div key={feature.id} className="flex items-start">
                  <div className="flex-shrink-0 mt-1">
                    {feature.enabled ? (
                      <svg className="h-5 w-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                    ) : (
                      <svg className="h-5 w-5 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                      </svg>
                    )}
                  </div>
                  <div className="ml-3">
                    <p className="text-sm font-medium text-gray-900">{feature.name}</p>
                    <p className="text-sm text-gray-500">{feature.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* BASIC Tier Features */}
        {basicFeatures.length > 0 && (
          <div>
            <h3 className="text-sm font-medium text-gray-500 mb-3">BASIC TIER</h3>
            <div className="space-y-2">
              {basicFeatures.map((feature) => (
                <div key={feature.id} className="flex items-start">
                  <div className="flex-shrink-0 mt-1">
                    {feature.enabled ? (
                      <svg className="h-5 w-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                    ) : (
                      <svg className="h-5 w-5 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </div>
                  <div className="ml-3">
                    <p className="text-sm font-medium text-gray-900">
                      {feature.name}
                      {!feature.enabled && <span className="ml-2 text-xs text-blue-600">(Requires BASIC)</span>}
                    </p>
                    <p className="text-sm text-gray-500">{feature.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* PREMIUM Tier Features */}
        {premiumFeatures.length > 0 && (
          <div>
            <h3 className="text-sm font-medium text-gray-500 mb-3">PREMIUM TIER</h3>
            <div className="space-y-2">
              {premiumFeatures.map((feature) => (
                <div key={feature.id} className="flex items-start">
                  <div className="flex-shrink-0 mt-1">
                    {feature.enabled ? (
                      <svg className="h-5 w-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                    ) : (
                      <svg className="h-5 w-5 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </div>
                  <div className="ml-3">
                    <p className="text-sm font-medium text-gray-900">
                      {feature.name}
                      {!feature.enabled && <span className="ml-2 text-xs text-purple-600">(Requires PREMIUM)</span>}
                    </p>
                    <p className="text-sm text-gray-500">{feature.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
