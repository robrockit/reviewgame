/**
 * @fileoverview User profile header component for admin portal.
 *
 * Displays user avatar, basic information, and quick action buttons.
 *
 * @module app/admin/users/[userId]/components/UserProfileHeader
 */

'use client';

import { UserCircleIcon } from '@heroicons/react/24/outline';
import { format } from 'date-fns';
import type { AdminUserDetail } from '@/app/api/admin/users/[userId]/route';

interface UserProfileHeaderProps {
  user: AdminUserDetail;
}

/**
 * Status badge component for displaying user account status
 */
function StatusBadge({ isActive }: { isActive: boolean | null }) {
  if (isActive) {
    return (
      <span className="inline-flex items-center rounded-full bg-green-100 px-3 py-1 text-sm font-medium text-green-800">
        Active
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full bg-red-100 px-3 py-1 text-sm font-medium text-red-800">
      Suspended
    </span>
  );
}

/**
 * User profile header component
 *
 * Displays key user information and action buttons at the top of the profile page.
 * Shows user avatar (or initials), name, email, join date, and account status.
 * Provides quick action buttons for common admin operations.
 */
export default function UserProfileHeader({ user }: UserProfileHeaderProps) {
  // Generate initials from full name or email
  const getInitials = () => {
    if (user.full_name) {
      const names = user.full_name.split(' ');
      if (names.length >= 2) {
        return `${names[0][0]}${names[names.length - 1][0]}`.toUpperCase();
      }
      return user.full_name.substring(0, 2).toUpperCase();
    }
    return user.email.substring(0, 2).toUpperCase();
  };

  return (
    <div className="bg-white shadow-sm rounded-lg p-6">
      <div className="flex items-start justify-between">
        {/* Left section: Avatar and user info */}
        <div className="flex items-start space-x-4">
          {/* Avatar */}
          <div className="flex-shrink-0">
            <div className="h-20 w-20 rounded-full bg-purple-100 flex items-center justify-center">
              <span className="text-2xl font-semibold text-purple-600">
                {getInitials()}
              </span>
            </div>
          </div>

          {/* User info */}
          <div className="flex-1">
            <div className="flex items-center space-x-3">
              <h1 className="text-2xl font-bold text-gray-900">
                {user.full_name || 'No Name'}
              </h1>
              <StatusBadge isActive={user.is_active} />
              {user.role === 'admin' && (
                <span className="inline-flex items-center rounded-full bg-purple-100 px-3 py-1 text-sm font-medium text-purple-800">
                  Admin
                </span>
              )}
            </div>

            <p className="mt-1 text-sm text-gray-600">{user.email}</p>

            <div className="mt-3 flex items-center space-x-6 text-sm text-gray-500">
              <div>
                <span className="font-medium">User ID:</span>{' '}
                <span className="font-mono text-xs">{user.id}</span>
              </div>
              <div>
                <span className="font-medium">Joined:</span>{' '}
                {user.created_at
                  ? format(new Date(user.created_at), 'MMM d, yyyy')
                  : 'Unknown'}
              </div>
              {user.last_login_at && (
                <div>
                  <span className="font-medium">Last Login:</span>{' '}
                  {format(new Date(user.last_login_at), 'MMM d, yyyy h:mm a')}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right section: Action buttons */}
        <div className="flex items-center space-x-3">
          <button
            type="button"
            className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500"
            title="Impersonate user (coming soon)"
            disabled
          >
            Impersonate
          </button>
          <button
            type="button"
            className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500"
            title="Suspend/unsuspend user (coming soon)"
            disabled
          >
            {user.is_active ? 'Suspend' : 'Reactivate'}
          </button>
          <button
            type="button"
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500"
            title="Edit user details (coming soon)"
            disabled
          >
            Edit
          </button>
        </div>
      </div>
    </div>
  );
}
