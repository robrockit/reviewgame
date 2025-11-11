/**
 * @fileoverview Admin dashboard page.
 *
 * Displays overview statistics and quick actions for admin users.
 * This is the landing page for the admin portal.
 *
 * @module app/admin/page
 */

import { createAdminServerClient, logAdminAction } from '@/lib/admin/auth';
import { headers } from 'next/headers';
import {
  UsersIcon,
  CreditCardIcon,
  ChartBarIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';

/**
 * Fetches dashboard statistics from the database.
 *
 * Returns fallback values (0) if any queries fail to ensure
 * the dashboard remains functional even with partial data.
 */
async function getDashboardStats() {
  const supabase = await createAdminServerClient();

  let totalUsers = 0;
  let activeSubscribers = 0;
  let totalGames = 0;
  let adminUsers = 0;

  // Get total users count
  try {
    const { count, error } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true });

    if (error) {
      console.error('Error fetching total users count:', error);
    } else {
      totalUsers = count || 0;
    }
  } catch (err) {
    console.error('Unexpected error fetching total users:', err);
  }

  // Get active subscribers count
  try {
    const { count, error } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .in('subscription_status', ['active', 'trialing']);

    if (error) {
      console.error('Error fetching active subscribers count:', error);
    } else {
      activeSubscribers = count || 0;
    }
  } catch (err) {
    console.error('Unexpected error fetching active subscribers:', err);
  }

  // Get total games count
  try {
    const { count, error } = await supabase
      .from('games')
      .select('*', { count: 'exact', head: true });

    if (error) {
      console.error('Error fetching total games count:', error);
    } else {
      totalGames = count || 0;
    }
  } catch (err) {
    console.error('Unexpected error fetching total games:', err);
  }

  // Get admin users count
  try {
    const { count, error } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .eq('role', 'admin')
      .eq('is_active', true);

    if (error) {
      console.error('Error fetching admin users count:', error);
    } else {
      adminUsers = count || 0;
    }
  } catch (err) {
    console.error('Unexpected error fetching admin users:', err);
  }

  return {
    totalUsers,
    activeSubscribers,
    totalGames,
    adminUsers,
  };
}

/**
 * Admin dashboard page component.
 *
 * Displays key metrics and quick action cards for admin operations.
 */
export default async function AdminDashboardPage() {
  // Log admin dashboard access for audit trail
  try {
    const headersList = await headers();
    const ipAddress = headersList.get('x-forwarded-for') ||
                      headersList.get('x-real-ip') ||
                      'unknown';
    const userAgent = headersList.get('user-agent') || 'unknown';

    await logAdminAction({
      actionType: 'view_dashboard',
      targetType: 'admin_portal',
      targetId: 'dashboard',
      notes: 'Admin accessed the dashboard',
      ipAddress,
      userAgent,
    });
  } catch (err) {
    // Log silently - don't block page load if audit logging fails
    console.error('Failed to log admin dashboard access:', err);
  }

  const stats = await getDashboardStats();

  const statCards = [
    {
      name: 'Total Users',
      value: stats.totalUsers.toLocaleString(),
      icon: UsersIcon,
      description: 'Registered users',
      href: '/admin/users',
      color: 'blue',
    },
    {
      name: 'Active Subscribers',
      value: stats.activeSubscribers.toLocaleString(),
      icon: CreditCardIcon,
      description: 'Active & trial subscriptions',
      href: '/admin/payments',
      color: 'green',
    },
    {
      name: 'Total Games',
      value: stats.totalGames.toLocaleString(),
      icon: ChartBarIcon,
      description: 'Games created',
      href: '/admin',
      color: 'purple',
    },
    {
      name: 'Admin Users',
      value: stats.adminUsers.toLocaleString(),
      icon: ExclamationTriangleIcon,
      description: 'Active administrators',
      href: '/admin/settings',
      color: 'yellow',
    },
  ];

  const colorClasses = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    purple: 'bg-purple-50 text-purple-600',
    yellow: 'bg-yellow-50 text-yellow-600',
  };

  return (
    <div className="space-y-6">
      {/* Welcome Message */}
      <div className="bg-white shadow-sm rounded-lg p-6">
        <h2 className="text-2xl font-bold text-gray-900">
          Welcome to the Admin Portal
        </h2>
        <p className="mt-1 text-sm text-gray-600">
          Manage users, subscriptions, and monitor system activity.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat) => (
          <div
            key={stat.name}
            className="bg-white overflow-hidden shadow-sm rounded-lg hover:shadow-md transition-shadow"
          >
            <div className="p-6">
              <div className="flex items-center">
                <div
                  className={`flex-shrink-0 rounded-md p-3 ${
                    colorClasses[stat.color as keyof typeof colorClasses]
                  }`}
                >
                  <stat.icon className="h-6 w-6" aria-hidden="true" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      {stat.name}
                    </dt>
                    <dd className="flex items-baseline">
                      <div className="text-2xl font-semibold text-gray-900">
                        {stat.value}
                      </div>
                    </dd>
                    <dd className="text-xs text-gray-500 mt-1">
                      {stat.description}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="bg-white shadow-sm rounded-lg">
        <div className="px-6 py-5 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">Quick Actions</h3>
        </div>
        <div className="px-6 py-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <a
              href="/admin/users"
              className="relative rounded-lg border border-gray-300 bg-white px-6 py-5 shadow-sm flex items-center space-x-3 hover:border-gray-400 focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-purple-500"
            >
              <div className="flex-shrink-0">
                <UsersIcon className="h-6 w-6 text-gray-400" />
              </div>
              <div className="flex-1 min-w-0">
                <span className="absolute inset-0" aria-hidden="true" />
                <p className="text-sm font-medium text-gray-900">
                  Manage Users
                </p>
                <p className="text-sm text-gray-500 truncate">
                  View and edit user accounts
                </p>
              </div>
            </a>

            <a
              href="/admin/payments"
              className="relative rounded-lg border border-gray-300 bg-white px-6 py-5 shadow-sm flex items-center space-x-3 hover:border-gray-400 focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-purple-500"
            >
              <div className="flex-shrink-0">
                <CreditCardIcon className="h-6 w-6 text-gray-400" />
              </div>
              <div className="flex-1 min-w-0">
                <span className="absolute inset-0" aria-hidden="true" />
                <p className="text-sm font-medium text-gray-900">
                  Payment Operations
                </p>
                <p className="text-sm text-gray-500 truncate">
                  Process refunds and manage subscriptions
                </p>
              </div>
            </a>

            <a
              href="/admin/audit"
              className="relative rounded-lg border border-gray-300 bg-white px-6 py-5 shadow-sm flex items-center space-x-3 hover:border-gray-400 focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-purple-500"
            >
              <div className="flex-shrink-0">
                <ChartBarIcon className="h-6 w-6 text-gray-400" />
              </div>
              <div className="flex-1 min-w-0">
                <span className="absolute inset-0" aria-hidden="true" />
                <p className="text-sm font-medium text-gray-900">
                  View Audit Log
                </p>
                <p className="text-sm text-gray-500 truncate">
                  Track admin actions and changes
                </p>
              </div>
            </a>
          </div>
        </div>
      </div>

      {/* Recent Activity Placeholder */}
      <div className="bg-white shadow-sm rounded-lg">
        <div className="px-6 py-5 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">Recent Activity</h3>
        </div>
        <div className="px-6 py-5">
          <p className="text-sm text-gray-500">
            Recent admin actions will appear here. This feature will be
            implemented in Phase 2.
          </p>
        </div>
      </div>
    </div>
  );
}
