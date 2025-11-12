/**
 * @fileoverview Activity tab component displaying login history and admin actions.
 *
 * Fetches and displays user login history and admin actions performed on the account.
 *
 * @module app/admin/users/[userId]/components/ActivityTab
 */

'use client';

import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import type {
  AdminUserActivity,
  AdminUserLoginHistory,
  AdminUserAdminAction,
} from '@/app/api/admin/users/[userId]/activity/route';

interface ActivityTabProps {
  userId: string;
}

/**
 * Activity tab component
 *
 * Displays:
 * - Login history with timestamps, methods, and IP addresses
 * - Admin actions performed on the user's account
 * - Impersonation sessions if any
 */
export default function ActivityTab({ userId }: ActivityTabProps) {
  const [activity, setActivity] = useState<AdminUserActivity | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchActivity() {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch(`/api/admin/users/${userId}/activity`);
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to fetch activity');
        }

        const data = await response.json();
        setActivity(data.data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    }

    fetchActivity();
  }, [userId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-purple-600 border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]"></div>
          <p className="mt-4 text-sm text-gray-600">Loading activity...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg bg-red-50 p-4">
        <div className="flex">
          <div className="ml-3">
            <h3 className="text-sm font-medium text-red-800">Error loading activity</h3>
            <div className="mt-2 text-sm text-red-700">
              <p>{error}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!activity) {
    return (
      <div className="text-center py-12">
        <p className="text-sm text-gray-500">No activity data available</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Login History Section */}
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-4">Login History</h3>
        {activity.loginHistory.length > 0 ? (
          <div className="overflow-hidden border border-gray-200 rounded-lg">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date & Time
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Method
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    IP Address
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Impersonated By
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {activity.loginHistory.map((login: AdminUserLoginHistory) => (
                  <tr key={login.id}>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                      {login.login_at
                        ? format(new Date(login.login_at), 'MMM d, yyyy h:mm a')
                        : '-'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                          login.login_method === 'impersonation'
                            ? 'bg-orange-100 text-orange-800'
                            : 'bg-blue-100 text-blue-800'
                        }`}
                      >
                        {login.login_method || 'unknown'}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 font-mono">
                      {login.ip_address || '-'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                      {login.impersonator_email || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="border border-gray-200 rounded-lg p-8 text-center">
            <p className="text-sm text-gray-500">No login history recorded</p>
          </div>
        )}
      </div>

      {/* Admin Actions Section */}
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-4">Recent Admin Actions</h3>
        {activity.adminActions.length > 0 ? (
          <div className="space-y-4">
            {activity.adminActions.map((action: AdminUserAdminAction) => (
              <div
                key={action.id}
                className="border border-gray-200 rounded-lg p-4 bg-white hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2">
                      <span className="inline-flex items-center rounded-full bg-purple-100 px-2 py-1 text-xs font-medium text-purple-800">
                        {action.action_type}
                      </span>
                      <span className="text-sm text-gray-500">
                        by {action.admin_email || 'Unknown admin'}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-gray-700">{action.notes || 'No notes'}</p>
                    {action.reason && (
                      <p className="mt-1 text-sm text-gray-600">
                        <span className="font-medium">Reason:</span> {action.reason}
                      </p>
                    )}
                    {action.changes && Object.keys(action.changes).length > 0 && (
                      <details className="mt-2">
                        <summary className="text-sm text-purple-600 cursor-pointer hover:text-purple-800">
                          View changes
                        </summary>
                        <pre className="mt-2 text-xs text-gray-700 font-mono bg-gray-50 p-2 rounded overflow-x-auto">
                          {JSON.stringify(action.changes, null, 2)}
                        </pre>
                      </details>
                    )}
                  </div>
                  <div className="ml-4 text-right">
                    <p className="text-sm text-gray-500">
                      {action.created_at
                        ? format(new Date(action.created_at), 'MMM d, yyyy')
                        : 'Unknown'}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      {action.created_at
                        ? format(new Date(action.created_at), 'h:mm a')
                        : ''}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="border border-gray-200 rounded-lg p-8 text-center">
            <p className="text-sm text-gray-500">No admin actions recorded</p>
          </div>
        )}
      </div>
    </div>
  );
}
