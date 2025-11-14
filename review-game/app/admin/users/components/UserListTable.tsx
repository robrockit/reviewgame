/**
 * @fileoverview User list table component.
 *
 * Displays users in a table format with:
 * - Masked emails by default
 * - Ability to reveal full email (with audit logging)
 * - User status indicators
 * - Subscription tier badges
 * - Clickable rows for navigation to user details
 * - Loading and empty states
 *
 * @module app/admin/users/components/UserListTable
 */

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import {
  EyeIcon,
  CheckCircleIcon,
  XCircleIcon,
  UserIcon,
} from '@heroicons/react/24/outline';
import type { AdminUserListItem } from '@/app/api/admin/users/route';

interface UserListTableProps {
  users: AdminUserListItem[];
  loading: boolean;
  isSearching: boolean;
  searchQuery: string;
}

/**
 * User list table component.
 *
 * Renders the user list with interactive features like email revealing.
 */
export default function UserListTable({
  users,
  loading,
  isSearching,
  searchQuery,
}: UserListTableProps) {
  const [revealedEmails, setRevealedEmails] = useState<Record<string, string>>({});
  const [revealingEmail, setRevealingEmail] = useState<string | null>(null);

  /**
   * Reveals the full email for a user
   */
  const handleRevealEmail = async (userId: string) => {
    // If already revealed, don't fetch again
    if (revealedEmails[userId]) {
      return;
    }

    try {
      setRevealingEmail(userId);

      const response = await fetch(`/api/admin/users/${userId}/reveal-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to reveal email');
      }

      const data = await response.json();

      // Store revealed email in state
      setRevealedEmails((prev) => ({
        ...prev,
        [userId]: data.email,
      }));
    } catch (error) {
      console.error('Error revealing email:', error);
      alert(error instanceof Error ? error.message : 'Failed to reveal email');
    } finally {
      setRevealingEmail(null);
    }
  };

  /**
   * Formats a date string to a readable format
   */
  const formatDate = (dateString: string | null): string => {
    if (!dateString) return 'Never';
    try {
      return format(new Date(dateString), 'MMM d, yyyy');
    } catch {
      return 'Invalid date';
    }
  };

  /**
   * Gets the subscription tier badge color
   */
  const getTierBadgeColor = (tier: string | null): string => {
    if (!tier) return 'bg-gray-100 text-gray-800';
    switch (tier.toLowerCase()) {
      case 'premium':
        return 'bg-purple-100 text-purple-800';
      case 'trial':
        return 'bg-blue-100 text-blue-800';
      case 'free':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  /**
   * Gets the subscription status badge color
   */
  const getStatusBadgeColor = (status: string | null): string => {
    if (!status) return 'bg-gray-100 text-gray-800';
    switch (status.toLowerCase()) {
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'trialing':
        return 'bg-blue-100 text-blue-800';
      case 'past_due':
        return 'bg-yellow-100 text-yellow-800';
      case 'canceled':
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      case 'paused':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="bg-white shadow-sm rounded-lg p-6">
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-purple-600 border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]"></div>
            <p className="mt-4 text-sm text-gray-600">
              {isSearching ? 'Searching users...' : 'Loading users...'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Empty state
  if (users.length === 0) {
    return (
      <div className="bg-white shadow-sm rounded-lg p-6">
        <div className="text-center py-12">
          <UserIcon className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">
            {isSearching ? 'No users found' : 'No users'}
          </h3>
          <p className="mt-1 text-sm text-gray-500">
            {isSearching
              ? `No users match your search query "${searchQuery}". Try a different search term.`
              : 'No users have been registered yet.'}
          </p>
        </div>
      </div>
    );
  }

  // Table view
  return (
    <div className="bg-white shadow-sm rounded-lg overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                User
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                Email
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                Status
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                Subscription
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                Last Login
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                Games Created
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {users.map((user) => (
              <tr
                key={user.id}
                className="hover:bg-gray-50 cursor-pointer transition-colors"
              >
                <td className="px-6 py-4 whitespace-nowrap">
                  <Link
                    href={`/admin/users/${user.id}`}
                    className="flex items-center group"
                  >
                    <div className="flex-shrink-0 h-10 w-10 bg-purple-100 rounded-full flex items-center justify-center">
                      <span className="text-purple-600 font-medium text-sm">
                        {user.full_name
                          ? user.full_name
                              .split(' ')
                              .map((n) => n[0])
                              .join('')
                              .toUpperCase()
                              .slice(0, 2)
                          : user.email[0].toUpperCase()}
                      </span>
                    </div>
                    <div className="ml-4">
                      <div className="text-sm font-medium text-gray-900 group-hover:text-purple-600">
                        {user.full_name || 'No name'}
                      </div>
                      <div className="text-sm text-gray-500">
                        ID: {user.id.slice(0, 8)}...
                      </div>
                    </div>
                  </Link>
                </td>

                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-gray-900">
                      {revealedEmails[user.id] || user.email_masked}
                    </span>
                    {!revealedEmails[user.id] && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRevealEmail(user.id);
                        }}
                        disabled={revealingEmail === user.id}
                        className="text-purple-600 hover:text-purple-900 disabled:opacity-50"
                        title="Reveal full email (logged to audit)"
                      >
                        {revealingEmail === user.id ? (
                          <div className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-solid border-purple-600 border-r-transparent"></div>
                        ) : (
                          <EyeIcon className="h-4 w-4" />
                        )}
                      </button>
                    )}
                  </div>
                </td>

                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    {user.is_active ? (
                      <CheckCircleIcon className="h-5 w-5 text-green-500 mr-2" />
                    ) : (
                      <XCircleIcon className="h-5 w-5 text-red-500 mr-2" />
                    )}
                    <span className="text-sm text-gray-900">
                      {user.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </td>

                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex flex-col space-y-1">
                    <span
                      className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getTierBadgeColor(
                        user.subscription_tier
                      )}`}
                    >
                      {user.subscription_tier || 'None'}
                    </span>
                    {user.subscription_status && (
                      <span
                        className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusBadgeColor(
                          user.subscription_status
                        )}`}
                      >
                        {user.subscription_status}
                      </span>
                    )}
                  </div>
                </td>

                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {formatDate(user.last_login_at)}
                </td>

                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {user.games_created_count || 0}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
