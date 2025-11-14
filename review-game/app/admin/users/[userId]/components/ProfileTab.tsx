/**
 * @fileoverview Profile tab component displaying account details.
 *
 * Shows user account information, status, and admin notes.
 *
 * @module app/admin/users/[userId]/components/ProfileTab
 */

'use client';

import { format } from 'date-fns';
import type { AdminUserDetail } from '@/app/api/admin/users/[userId]/route';

interface ProfileTabProps {
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
 * Profile tab component
 *
 * Displays comprehensive account details including:
 * - Basic account information (email, name, role)
 * - Account status and activity
 * - Email verification status
 * - Admin notes
 * - Account creation and update timestamps
 */
export default function ProfileTab({ user }: ProfileTabProps) {
  return (
    <div className="space-y-6">
      {/* Account Details Section */}
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-4">Account Details</h3>
        <dl className="divide-y divide-gray-200 border-t border-gray-200">
          <InfoRow label="Full Name" value={user.full_name || 'Not provided'} />
          <InfoRow label="Email" value={user.email} />
          <InfoRow
            label="Email Verified"
            value={
              user.email_verified_manually ? (
                <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-800">
                  Manually Verified
                </span>
              ) : (
                <span className="text-gray-500">Not manually verified</span>
              )
            }
          />
          <InfoRow
            label="Role"
            value={
              <span
                className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                  user.role === 'admin'
                    ? 'bg-purple-100 text-purple-800'
                    : 'bg-gray-100 text-gray-800'
                }`}
              >
                {user.role || 'user'}
              </span>
            }
          />
          <InfoRow label="User ID" value={<span className="font-mono text-xs">{user.id}</span>} />
        </dl>
      </div>

      {/* Account Status Section */}
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-4">Account Status</h3>
        <dl className="divide-y divide-gray-200 border-t border-gray-200">
          <InfoRow
            label="Status"
            value={
              user.is_active ? (
                <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-800">
                  Active
                </span>
              ) : (
                <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-1 text-xs font-medium text-red-800">
                  Suspended
                </span>
              )
            }
          />
          {!user.is_active && user.suspension_reason && (
            <InfoRow
              label="Suspension Reason"
              value={
                <span className="text-red-700 font-medium">{user.suspension_reason}</span>
              }
            />
          )}
          <InfoRow
            label="Games Created"
            value={user.games_created_count !== null ? user.games_created_count : 0}
          />
          <InfoRow
            label="Created At"
            value={
              user.created_at
                ? format(new Date(user.created_at), 'MMM d, yyyy h:mm a')
                : 'Unknown'
            }
          />
          <InfoRow
            label="Last Updated"
            value={
              user.updated_at
                ? format(new Date(user.updated_at), 'MMM d, yyyy h:mm a')
                : 'Never'
            }
          />
          <InfoRow
            label="Last Login"
            value={
              user.last_login_at
                ? format(new Date(user.last_login_at), 'MMM d, yyyy h:mm a')
                : 'Never'
            }
          />
        </dl>
      </div>

      {/* Admin Notes Section */}
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-4">Admin Notes</h3>
        <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
          {user.admin_notes ? (
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{user.admin_notes}</p>
          ) : (
            <p className="text-sm text-gray-500 italic">No admin notes recorded</p>
          )}
        </div>
      </div>
    </div>
  );
}
