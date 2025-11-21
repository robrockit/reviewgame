/**
 * @fileoverview Subscription details card component showing real-time Stripe data
 *
 * Displays detailed subscription information fetched from Stripe API
 *
 * @module app/admin/users/[userId]/components/SubscriptionDetailsCard
 */

'use client';

import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import type { SubscriptionDetailsResponse } from '@/app/api/admin/users/[userId]/subscription/route';
import { ArrowTopRightOnSquareIcon } from '@heroicons/react/24/outline';

interface SubscriptionDetailsCardProps {
  userId: string;
}

/**
 * Subscription details card component
 *
 * Fetches and displays real-time subscription data from Stripe
 */
export default function SubscriptionDetailsCard({ userId }: SubscriptionDetailsCardProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<SubscriptionDetailsResponse | null>(null);

  useEffect(() => {
    const fetchSubscriptionDetails = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/admin/users/${userId}/subscription`);

        if (!response.ok) {
          throw new Error('Failed to fetch subscription details');
        }

        const result: SubscriptionDetailsResponse = await response.json();
        setData(result);
        setError(result.error || null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load subscription details');
      } finally {
        setLoading(false);
      }
    };

    fetchSubscriptionDetails();
  }, [userId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-purple-600 border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]"></div>
          <p className="mt-4 text-sm text-gray-600">Loading subscription details...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg bg-red-50 border border-red-200 p-4">
        <p className="text-sm text-red-800">{error}</p>
      </div>
    );
  }

  if (!data?.subscription && !data?.customer) {
    return (
      <div className="rounded-lg bg-gray-50 border border-gray-200 p-6">
        <p className="text-sm text-gray-600 text-center">No Stripe subscription found for this user</p>
      </div>
    );
  }

  // Helper to get status badge styling
  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { bg: string; text: string }> = {
      active: { bg: 'bg-green-100', text: 'text-green-800' },
      trialing: { bg: 'bg-blue-100', text: 'text-blue-800' },
      past_due: { bg: 'bg-yellow-100', text: 'text-yellow-800' },
      canceled: { bg: 'bg-gray-100', text: 'text-gray-800' },
      unpaid: { bg: 'bg-red-100', text: 'text-red-800' },
      incomplete: { bg: 'bg-orange-100', text: 'text-orange-800' },
      incomplete_expired: { bg: 'bg-red-100', text: 'text-red-800' },
    };

    const config = statusConfig[status] || { bg: 'bg-gray-100', text: 'text-gray-800' };

    return (
      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${config.bg} ${config.text}`}>
        {status.replace('_', ' ').charAt(0).toUpperCase() + status.replace('_', ' ').slice(1)}
      </span>
    );
  };

  // Helper to format currency
  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(amount / 100);
  };

  return (
    <div className="space-y-6">
      {/* Stripe Customer Section */}
      {data.customer && (
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-gray-900">Stripe Customer</h3>
            <a
              href={`https://dashboard.stripe.com/customers/${data.customer.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center text-sm text-purple-600 hover:text-purple-700"
            >
              View in Stripe
              <ArrowTopRightOnSquareIcon className="ml-1 h-4 w-4" />
            </a>
          </div>
          <dl className="space-y-3">
            <div>
              <dt className="text-sm font-medium text-gray-500">Customer ID</dt>
              <dd className="mt-1 text-sm text-gray-900 font-mono">{data.customer.id}</dd>
            </div>
            {data.customer.email && (
              <div>
                <dt className="text-sm font-medium text-gray-500">Email</dt>
                <dd className="mt-1 text-sm text-gray-900">{data.customer.email}</dd>
              </div>
            )}
            {data.customer.name && (
              <div>
                <dt className="text-sm font-medium text-gray-500">Name</dt>
                <dd className="mt-1 text-sm text-gray-900">{data.customer.name}</dd>
              </div>
            )}
            <div>
              <dt className="text-sm font-medium text-gray-500">Customer Since</dt>
              <dd className="mt-1 text-sm text-gray-900">
                {format(new Date(data.customer.created), 'MMM d, yyyy')}
              </dd>
            </div>
          </dl>
        </div>
      )}

      {/* Active Subscription Section */}
      {data.subscription && (
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-gray-900">Active Subscription</h3>
            <a
              href={`https://dashboard.stripe.com/subscriptions/${data.subscription.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center text-sm text-purple-600 hover:text-purple-700"
            >
              View in Stripe
              <ArrowTopRightOnSquareIcon className="ml-1 h-4 w-4" />
            </a>
          </div>
          <dl className="space-y-3">
            <div>
              <dt className="text-sm font-medium text-gray-500">Status</dt>
              <dd className="mt-1">{getStatusBadge(data.subscription.status)}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Plan</dt>
              <dd className="mt-1 text-sm text-gray-900">{data.subscription.planName}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Amount</dt>
              <dd className="mt-1 text-sm text-gray-900">
                {formatCurrency(data.subscription.amount, data.subscription.currency)} / {data.subscription.interval}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Current Period</dt>
              <dd className="mt-1 text-sm text-gray-900">
                {format(new Date(data.subscription.currentPeriodStart), 'MMM d, yyyy')} - {format(new Date(data.subscription.currentPeriodEnd), 'MMM d, yyyy')}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Auto-Renewal</dt>
              <dd className="mt-1">
                {data.subscription.cancelAtPeriodEnd ? (
                  <span className="inline-flex items-center rounded-full bg-yellow-100 px-2.5 py-0.5 text-xs font-medium text-yellow-800">
                    Canceled - Ends {format(new Date(data.subscription.currentPeriodEnd), 'MMM d, yyyy')}
                  </span>
                ) : (
                  <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
                    Enabled
                  </span>
                )}
              </dd>
            </div>
            {data.subscription.trialEnd && (
              <div>
                <dt className="text-sm font-medium text-gray-500">Trial Period</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {data.subscription.trialStart && format(new Date(data.subscription.trialStart), 'MMM d, yyyy')} - {format(new Date(data.subscription.trialEnd), 'MMM d, yyyy')}
                </dd>
              </div>
            )}
            {data.subscription.canceledAt && (
              <div>
                <dt className="text-sm font-medium text-gray-500">Canceled At</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {format(new Date(data.subscription.canceledAt), 'MMM d, yyyy h:mm a')}
                </dd>
              </div>
            )}
          </dl>
        </div>
      )}

      {!data.subscription && data.customer && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
          <p className="text-sm text-gray-600 text-center">
            Customer exists but has no active subscription
          </p>
        </div>
      )}
    </div>
  );
}
