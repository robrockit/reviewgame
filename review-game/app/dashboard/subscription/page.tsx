'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { SubscriptionStatusResponse } from '@/types/subscription.types';
import { format } from 'date-fns';
import CancelSubscriptionModal from './components/CancelSubscriptionModal';
import ChangePlanModal from './components/ChangePlanModal';
import FeatureList from './components/FeatureList';
import UsageStats from './components/UsageStats';

const TIER_COLORS = {
  FREE: 'bg-gray-100 text-gray-800',
  BASIC: 'bg-blue-100 text-blue-800',
  PREMIUM: 'bg-purple-100 text-purple-800',
};

const STATUS_COLORS = {
  TRIAL: 'bg-blue-100 text-blue-800',
  ACTIVE: 'bg-green-100 text-green-800',
  CANCELLED: 'bg-red-100 text-red-800',
  INACTIVE: 'bg-yellow-100 text-yellow-800',
};

export default function SubscriptionPage() {
  const [subscription, setSubscription] = useState<SubscriptionStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showChangePlanModal, setShowChangePlanModal] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error'>('success');
  const [isManagingBilling, setIsManagingBilling] = useState(false);
  const [isReactivating, setIsReactivating] = useState(false);
  const router = useRouter();

  const showSuccessToast = (message: string) => {
    setToastMessage(message);
    setToastType('success');
    setShowToast(true);
    setTimeout(() => setShowToast(false), 5000);
  };

  const showErrorToast = (message: string) => {
    setToastMessage(message);
    setToastType('error');
    setShowToast(true);
    setTimeout(() => setShowToast(false), 5000);
  };

  const fetchSubscription = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/subscription/status');
      if (!response.ok) {
        throw new Error('Failed to fetch subscription status');
      }
      const data: SubscriptionStatusResponse = await response.json();
      setSubscription(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load subscription');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const supabase = createClient();

    const loadUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        router.push('/login');
        return;
      }

      await fetchSubscription();
    };

    loadUser();
  }, [router]);

  const handleManageBilling = async () => {
    setIsManagingBilling(true);
    try {
      const response = await fetch('/api/subscription/portal', {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to create portal session');
      }

      const data = await response.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch {
      showErrorToast('Failed to open billing portal. Please try again.');
      setIsManagingBilling(false);
    }
    // Note: Don't set loading false if redirect succeeds - user navigates away
  };

  const handleReactivate = async () => {
    setIsReactivating(true);
    try {
      const response = await fetch('/api/subscription/reactivate', {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to reactivate subscription');
      }

      showSuccessToast('Subscription reactivated successfully!');
      await fetchSubscription();
    } catch {
      showErrorToast('Failed to reactivate subscription. Please try again.');
    } finally {
      setIsReactivating(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Header Skeleton */}
          <div className="bg-white rounded-lg shadow-sm p-6 mb-6 animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-2/3 mb-2"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          </div>

          {/* Current Plan Skeleton */}
          <div className="bg-white rounded-lg shadow-sm p-6 mb-6 animate-pulse">
            <div className="h-6 bg-gray-200 rounded w-1/4 mb-4"></div>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="h-4 bg-gray-200 rounded w-1/6"></div>
                <div className="h-6 bg-gray-200 rounded w-1/4"></div>
              </div>
              <div className="flex items-center justify-between">
                <div className="h-4 bg-gray-200 rounded w-1/6"></div>
                <div className="h-6 bg-gray-200 rounded w-1/5"></div>
              </div>
              <div className="flex items-center justify-between">
                <div className="h-4 bg-gray-200 rounded w-1/4"></div>
                <div className="h-4 bg-gray-200 rounded w-1/3"></div>
              </div>
              <div className="pt-4 border-t">
                <div className="h-10 bg-gray-200 rounded w-full"></div>
              </div>
            </div>
          </div>

          {/* Features Skeleton */}
          <div className="bg-white rounded-lg shadow-sm p-6 mb-6 animate-pulse">
            <div className="h-6 bg-gray-200 rounded w-1/4 mb-4"></div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="h-24 bg-gray-200 rounded"></div>
              <div className="h-24 bg-gray-200 rounded"></div>
              <div className="h-24 bg-gray-200 rounded"></div>
              <div className="h-24 bg-gray-200 rounded"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !subscription) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg text-red-600">{error || 'Failed to load subscription'}</div>
      </div>
    );
  }

  const hasActiveSubscription = subscription.subscription_status === 'TRIAL' || subscription.subscription_status === 'ACTIVE';
  const isCancelling = subscription.cancel_at_period_end;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Toast Notification */}
        {showToast && (
          <div className="fixed top-4 right-4 z-50">
            <div className={`rounded-lg shadow-lg p-4 ${toastType === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  {toastType === 'success' ? (
                    <svg className="h-5 w-5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  ) : (
                    <svg className="h-5 w-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                  )}
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium">{toastMessage}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Subscription Management</h1>
          <p className="text-gray-600 mt-1">Manage your plan and billing information</p>
        </div>

        {/* Cancellation Warning */}
        {isCancelling && (
          <div className="mb-6 bg-amber-50 border-l-4 border-amber-400 p-4 rounded-lg">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-amber-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3 flex-1">
                <p className="text-sm text-amber-700">
                  <span className="font-medium">Subscription scheduled for cancellation</span>
                </p>
                <p className="text-sm text-amber-600 mt-1">
                  Your subscription will end on {subscription.current_period_end && format(new Date(subscription.current_period_end), 'MMMM d, yyyy')}. You&apos;ll retain access until then.
                </p>
                <button
                  onClick={handleReactivate}
                  disabled={isReactivating}
                  className="mt-3 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center"
                >
                  {isReactivating ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Reactivating...
                    </>
                  ) : (
                    'Reactivate Subscription'
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Current Plan Overview */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Current Plan</h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Plan:</span>
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${TIER_COLORS[subscription.subscription_tier as keyof typeof TIER_COLORS]}`}>
                {subscription.subscription_tier}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Status:</span>
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${STATUS_COLORS[subscription.subscription_status as keyof typeof STATUS_COLORS]}`}>
                {subscription.subscription_status}
              </span>
            </div>
            {subscription.billing_cycle && (
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Billing Cycle:</span>
                <span className="font-medium">{subscription.billing_cycle === 'monthly' ? 'Monthly' : 'Annual'}</span>
              </div>
            )}
            {subscription.trial_end_date && subscription.subscription_status === 'TRIAL' && (
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Trial Ends:</span>
                <span className="font-medium">{format(new Date(subscription.trial_end_date), 'MMMM d, yyyy')}</span>
              </div>
            )}
            {subscription.current_period_end && subscription.subscription_status === 'ACTIVE' && (
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Next Billing Date:</span>
                <span className="font-medium">{format(new Date(subscription.current_period_end), 'MMMM d, yyyy')}</span>
              </div>
            )}
            {subscription.stripe_subscription && subscription.stripe_subscription.items[0]?.price.unit_amount && (
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Amount:</span>
                <span className="font-medium">${(subscription.stripe_subscription.items[0].price.unit_amount / 100).toFixed(2)} / {subscription.billing_cycle === 'monthly' ? 'month' : 'year'}</span>
              </div>
            )}
            {hasActiveSubscription && (
              <div className="pt-4 border-t">
                <button
                  onClick={handleManageBilling}
                  disabled={isManagingBilling}
                  className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center"
                >
                  {isManagingBilling ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Opening Portal...
                    </>
                  ) : (
                    'Manage Billing Details'
                  )}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Usage Stats for FREE tier */}
        {subscription.subscription_tier === 'FREE' && (
          <UsageStats
            gamesCreated={subscription.games_created_count}
            gamesLimit={subscription.games_limit || 3}
            onUpgrade={() => router.push('/pricing')}
          />
        )}

        {/* Available Features */}
        <FeatureList subscription={subscription} />

        {/* Change Plan Section */}
        {hasActiveSubscription && subscription.subscription_tier !== 'FREE' && (
          <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">Change Plan</h2>
            <p className="text-gray-600 mb-4">
              Upgrade, downgrade, or change your billing cycle
            </p>
            <button
              onClick={() => setShowChangePlanModal(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              View Plans
            </button>
          </div>
        )}

        {/* Danger Zone */}
        {hasActiveSubscription && subscription.subscription_tier !== 'FREE' && !isCancelling && (
          <div className="bg-white rounded-lg shadow-sm p-6 border-2 border-red-200">
            <h2 className="text-xl font-semibold mb-4 text-red-600">Danger Zone</h2>
            <p className="text-gray-600 mb-4">
              Cancel your subscription and return to the free plan
            </p>
            <button
              onClick={() => setShowCancelModal(true)}
              className="px-4 py-2 border-2 border-red-600 text-red-600 rounded-lg hover:bg-red-50 transition-colors"
            >
              Cancel Subscription
            </button>
          </div>
        )}

        {/* Modals */}
        <CancelSubscriptionModal
          isOpen={showCancelModal}
          onClose={() => setShowCancelModal(false)}
          onSuccess={async () => {
            showSuccessToast('Subscription canceled successfully');
            await fetchSubscription();
          }}
          onError={(message) => showErrorToast(message)}
          currentPeriodEnd={subscription.current_period_end}
        />

        <ChangePlanModal
          isOpen={showChangePlanModal}
          onClose={() => setShowChangePlanModal(false)}
          onSuccess={async () => {
            showSuccessToast('Plan updated successfully');
            await fetchSubscription();
          }}
          onError={(message) => showErrorToast(message)}
          currentTier={subscription.subscription_tier}
          currentBillingCycle={subscription.billing_cycle}
        />
      </div>
    </div>
  );
}
