/**
 * @fileoverview User profile header component for admin portal.
 *
 * Displays user avatar, basic information, and quick action buttons.
 *
 * @module app/admin/users/[userId]/components/UserProfileHeader
 */

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import type { AdminUserDetail } from '@/app/api/admin/users/[userId]/route';
import EditProfileModal from './EditProfileModal';
import SuspendUserModal from './SuspendUserModal';
import Toast from '@/components/ui/Toast';

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
export default function UserProfileHeader({ user: initialUser }: UserProfileHeaderProps) {
  const router = useRouter();
  const [user, setUser] = useState<AdminUserDetail>(initialUser);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isSuspendModalOpen, setIsSuspendModalOpen] = useState(false);
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('User profile updated successfully');
  const [isProcessing, setIsProcessing] = useState(false);

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

  /**
   * Shows success toast with custom message
   */
  const showToast = (message: string) => {
    setToastMessage(message);
    setShowSuccessToast(true);
    setTimeout(() => setShowSuccessToast(false), 5000);
  };

  /**
   * Handles successful profile update
   */
  const handleEditSuccess = (updatedUser: AdminUserDetail) => {
    setUser(updatedUser);
    showToast('User profile updated successfully');
  };

  /**
   * Handles successful suspension
   */
  const handleSuspendSuccess = () => {
    // Update user state to reflect suspension
    setUser(prev => ({ ...prev, is_active: false }));
    showToast('User account suspended successfully');
    // Refresh server components without full page reload
    router.refresh();
  };

  /**
   * Handles user activation
   */
  const handleActivate = async () => {
    if (isProcessing) return;

    const confirmed = window.confirm(
      `Are you sure you want to activate ${user.email}? This will restore their access to the system.`
    );

    if (!confirmed) return;

    setIsProcessing(true);

    try {
      const response = await fetch(`/api/admin/users/${user.id}/activate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to activate user');
      }

      // Update user state to reflect activation
      setUser(prev => ({ ...prev, is_active: true, suspension_reason: null }));
      showToast('User account activated successfully');
      // Refresh server components without full page reload
      router.refresh();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to activate user');
    } finally {
      setIsProcessing(false);
    }
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
          {user.is_active ? (
            <button
              type="button"
              onClick={() => setIsSuspendModalOpen(true)}
              disabled={isProcessing}
              className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-red-700 bg-white hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
              title="Suspend user account"
            >
              Suspend
            </button>
          ) : (
            <button
              type="button"
              onClick={handleActivate}
              disabled={isProcessing}
              className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-green-700 bg-white hover:bg-green-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
              title="Reactivate user account"
            >
              {isProcessing ? 'Activating...' : 'Reactivate'}
            </button>
          )}
          <button
            type="button"
            onClick={() => setIsEditModalOpen(true)}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500"
            title="Edit user profile"
          >
            Edit Profile
          </button>
        </div>
      </div>

      {/* Edit Profile Modal */}
      <EditProfileModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        user={user}
        onSuccess={handleEditSuccess}
      />

      {/* Suspend User Modal */}
      <SuspendUserModal
        isOpen={isSuspendModalOpen}
        onClose={() => setIsSuspendModalOpen(false)}
        userEmail={user.email}
        userId={user.id}
        onSuccess={handleSuspendSuccess}
      />

      {/* Success Toast */}
      {showSuccessToast && (
        <Toast
          message={toastMessage}
          type="success"
          onClose={() => setShowSuccessToast(false)}
        />
      )}
    </div>
  );
}
