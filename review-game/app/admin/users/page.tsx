/**
 * @fileoverview Admin users management page.
 *
 * Displays a searchable, paginated list of users with the ability to:
 * - Search by email, name, or user ID
 * - View user details
 * - Reveal full email addresses (with audit logging)
 * - Navigate to individual user detail pages
 *
 * @module app/admin/users/page
 */

import { Suspense } from 'react';
import UserManagementClient from './components/UserManagementClient';
import { UsersIcon } from '@heroicons/react/24/outline';

/**
 * Admin users page component.
 *
 * This server component provides the layout and delegates
 * interactive functionality to client components.
 */
export default function AdminUsersPage() {
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="bg-white shadow-sm rounded-lg p-6">
        <div className="flex items-center space-x-3">
          <div className="flex-shrink-0">
            <UsersIcon className="h-8 w-8 text-purple-600" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              User Management
            </h2>
            <p className="mt-1 text-sm text-gray-600">
              Search for users, view details, and manage accounts.
            </p>
          </div>
        </div>
      </div>

      {/* User Management Interface */}
      <Suspense
        fallback={
          <div className="bg-white shadow-sm rounded-lg p-6">
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-purple-600 border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]"></div>
                <p className="mt-4 text-sm text-gray-600">Loading users...</p>
              </div>
            </div>
          </div>
        }
      >
        <UserManagementClient />
      </Suspense>
    </div>
  );
}
