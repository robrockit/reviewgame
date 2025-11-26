/**
 * @fileoverview Subscription tab component displaying billing and plan details.
 *
 * Shows subscription status, Stripe information, custom plan details, and payment history.
 *
 * @module app/admin/users/[userId]/components/SubscriptionTab
 */

'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import type { AdminUserDetail } from '@/app/api/admin/users/[userId]/route';
import SubscriptionDetailsCard from './SubscriptionDetailsCard';
import PaymentHistoryTable from './PaymentHistoryTable';
import { SubscriptionErrorBoundary } from './SubscriptionErrorBoundary';
import ManageSubscriptionModal from './ManageSubscriptionModal';
import { CogIcon } from '@heroicons/react/24/outline';

interface SubscriptionTabProps {
  user: AdminUserDetail;
  userId: string;
}

/**
 * Info row component for consistent layout
 */
function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="py-3 grid grid-cols-3 gap-4">
      <dt className="text-sm font-medium text-gray-500">{label}</dt>
      <dd className="text-sm text-gray-900 col-span-2">{value || '-'}</dd>
    </div>
  );
}

/**
 * Subscription tab component
 *
 * Displays comprehensive subscription and billing information including:
 * - Real-time Stripe subscription data
 * - Payment history
 * - Current plan and status from database
 * - Custom plan overrides
 * - Feature limits and permissions
 */
export default function SubscriptionTab({ user, userId }: SubscriptionTabProps) {
  const [isManageModalOpen, setIsManageModalOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  // Handler for successful subscription management
  const handleManageSuccess = () => {
    setRefreshKey(prev => prev + 1);
    // Optionally reload the page to refresh all data
    window.location.reload();
  };

  // Helper to format subscription status
  const getStatusBadge = (status: string | null) => {
    if (!status) {
      return <span className="text-gray-500">No subscription</span>;
    }

    const statusConfig: Record<string, { bg: string; text: string }> = {
      active: { bg: 'bg-green-100', text: 'text-green-800' },
      trialing: { bg: 'bg-blue-100', text: 'text-blue-800' },
      past_due: { bg: 'bg-yellow-100', text: 'text-yellow-800' },
      canceled: { bg: 'bg-gray-100', text: 'text-gray-800' },
      unpaid: { bg: 'bg-red-100', text: 'text-red-800' },
    };

    const config = statusConfig[status] || { bg: 'bg-gray-100', text: 'text-gray-800' };

    return (
      <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${config.bg} ${config.text}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  return (
    <div className="space-y-8">
      {/* Real-time Stripe Subscription Details */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-900">Stripe Subscription Details</h2>
          {user.stripe_subscription_id && (
            <button
              onClick={() => setIsManageModalOpen(true)}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500"
            >
              <CogIcon className="h-5 w-5 mr-2" />
              Manage Subscription
            </button>
          )}
        </div>
        <SubscriptionErrorBoundary>
          <SubscriptionDetailsCard userId={userId} key={`details-${refreshKey}`} />
        </SubscriptionErrorBoundary>
      </div>

      {/* Payment History */}
      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Payment History</h2>
        <SubscriptionErrorBoundary>
          <PaymentHistoryTable userId={userId} />
        </SubscriptionErrorBoundary>
      </div>

      {/* Database Information Section */}
      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Database Records</h2>
        <div className="text-sm text-gray-500 mb-4 italic">
          Information stored in the database (may differ from Stripe if not recently synced)
        </div>
      </div>

      {/* Current Plan Section */}
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-4">Current Plan</h3>
        <dl className="divide-y divide-gray-200 border-t border-gray-200">
          <InfoRow label="Subscription Status" value={getStatusBadge(user.subscription_status)} />
          <InfoRow label="Subscription Tier" value={user.subscription_tier || 'Free'} />
          <InfoRow
            label="Billing Cycle"
            value={user.billing_cycle ? user.billing_cycle.charAt(0).toUpperCase() + user.billing_cycle.slice(1) : '-'}
          />
          <InfoRow
            label="Current Period Ends"
            value={
              user.current_period_end
                ? format(new Date(user.current_period_end), 'MMM d, yyyy')
                : '-'
            }
          />
          <InfoRow
            label="Trial End Date"
            value={
              user.trial_end_date
                ? format(new Date(user.trial_end_date), 'MMM d, yyyy')
                : '-'
            }
          />
        </dl>
      </div>

      {/* Stripe Information Section */}
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-4">Stripe Information</h3>
        <dl className="divide-y divide-gray-200 border-t border-gray-200">
          <InfoRow
            label="Stripe Customer ID"
            value={
              user.stripe_customer_id ? (
                <span className="font-mono text-xs">{user.stripe_customer_id}</span>
              ) : (
                '-'
              )
            }
          />
          <InfoRow
            label="Stripe Subscription ID"
            value={
              user.stripe_subscription_id ? (
                <span className="font-mono text-xs">{user.stripe_subscription_id}</span>
              ) : (
                '-'
              )
            }
          />
        </dl>
      </div>

      {/* Custom Plan Section */}
      {(user.custom_plan_name || user.custom_plan_type) && (
        <div>
          <h3 className="text-lg font-medium text-gray-900 mb-4">Custom Plan Override</h3>
          <dl className="divide-y divide-gray-200 border-t border-gray-200">
            <InfoRow label="Custom Plan Name" value={user.custom_plan_name || '-'} />
            <InfoRow
              label="Plan Type"
              value={
                user.custom_plan_type ? (
                  <span className="inline-flex items-center rounded-full bg-purple-100 px-2 py-1 text-xs font-medium text-purple-800">
                    {user.custom_plan_type.replace('_', ' ').toUpperCase()}
                  </span>
                ) : (
                  '-'
                )
              }
            />
            <InfoRow
              label="Expires At"
              value={
                user.custom_plan_expires_at
                  ? format(new Date(user.custom_plan_expires_at), 'MMM d, yyyy')
                  : 'Never'
              }
            />
          </dl>

          {user.custom_plan_notes && (
            <div className="mt-4 border border-purple-200 rounded-lg p-4 bg-purple-50">
              <h4 className="text-sm font-medium text-purple-900 mb-2">Plan Notes</h4>
              <p className="text-sm text-purple-700 whitespace-pre-wrap">
                {user.custom_plan_notes}
              </p>
            </div>
          )}

          {user.plan_override_limits && Object.keys(user.plan_override_limits).length > 0 && (
            <div className="mt-4 border border-gray-200 rounded-lg p-4 bg-gray-50">
              <h4 className="text-sm font-medium text-gray-900 mb-2">Custom Limits</h4>
              <pre className="text-xs text-gray-700 font-mono whitespace-pre-wrap overflow-x-auto">
                {JSON.stringify(user.plan_override_limits, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}

      {/* No Custom Plan Message */}
      {!user.custom_plan_name && !user.custom_plan_type && (
        <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
          <p className="text-sm text-gray-500 italic">
            No custom plan overrides configured for this user
          </p>
        </div>
      )}

      {/* Manage Subscription Modal */}
      <ManageSubscriptionModal
        isOpen={isManageModalOpen}
        onClose={() => setIsManageModalOpen(false)}
        userEmail={user.email}
        userId={userId}
        subscriptionId={user.stripe_subscription_id}
        currentStatus={user.subscription_status}
        currentBillingCycle={user.billing_cycle}
        onSuccess={handleManageSuccess}
      />
    </div>
  );
}
