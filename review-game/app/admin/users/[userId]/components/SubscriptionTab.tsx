/**
 * @fileoverview Subscription tab component displaying billing and plan details.
 *
 * Shows subscription status, Stripe information, and custom plan details.
 *
 * @module app/admin/users/[userId]/components/SubscriptionTab
 */

'use client';

import { format } from 'date-fns';
import type { AdminUserDetail } from '@/app/api/admin/users/[userId]/route';

interface SubscriptionTabProps {
  user: AdminUserDetail;
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
 * - Current plan and status
 * - Stripe customer and subscription IDs
 * - Billing cycle and renewal dates
 * - Custom plan overrides
 * - Feature limits and permissions
 */
export default function SubscriptionTab({ user }: SubscriptionTabProps) {
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
    <div className="space-y-6">
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
    </div>
  );
}
