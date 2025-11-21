/**
 * @fileoverview User profile detail page for admin portal.
 *
 * Displays comprehensive user information including profile, subscription,
 * activity history, games, and question banks.
 *
 * @module app/admin/users/[userId]/page
 */

import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { verifyAdminUser, createAdminServiceClient } from '@/lib/admin/auth';
import UserProfileHeader from './components/UserProfileHeader';
import UserProfileTabs from './components/UserProfileTabs';
import Link from 'next/link';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';
import type { AdminUserDetail } from '@/app/api/admin/users/[userId]/route';

/**
 * Loading fallback component
 */
function LoadingFallback() {
  return (
    <div className="flex items-center justify-center py-12">
      <div className="text-center">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-purple-600 border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]"></div>
        <p className="mt-4 text-sm text-gray-600">Loading user profile...</p>
      </div>
    </div>
  );
}

/**
 * Fetches user details from the API
 */
async function getUserDetails(userId: string): Promise<AdminUserDetail | null> {
  const supabase = createAdminServiceClient();

  // Fetch user details
  const { data: user, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (error || !user) {
    return null;
  }

  // Fetch auth user data to get email_confirmed_at (from Supabase Auth)
  const { data: authData } = await supabase.auth.admin.getUserById(userId);
  const emailConfirmedAt = authData?.user?.email_confirmed_at || null;

  return {
    id: user.id,
    email: user.email,
    full_name: user.full_name,
    role: user.role,
    is_active: user.is_active,
    created_at: user.created_at,
    updated_at: user.updated_at,
    last_login_at: user.last_login_at,
    subscription_status: user.subscription_status,
    subscription_tier: user.subscription_tier,
    billing_cycle: user.billing_cycle,
    current_period_end: user.current_period_end,
    trial_end_date: user.trial_end_date,
    stripe_customer_id: user.stripe_customer_id,
    stripe_subscription_id: user.stripe_subscription_id,
    custom_plan_name: user.custom_plan_name,
    custom_plan_type: user.custom_plan_type,
    custom_plan_expires_at: user.custom_plan_expires_at,
    custom_plan_notes: user.custom_plan_notes,
    plan_override_limits: user.plan_override_limits as Record<string, unknown> | null,
    suspension_reason: user.suspension_reason,
    email_verified_manually: user.email_verified_manually,
    email_confirmed_at: emailConfirmedAt,
    admin_notes: user.admin_notes,
    games_created_count: user.games_created_count,
  };
}

/**
 * User profile page component
 *
 * Server component that verifies admin authentication, fetches user details,
 * and renders the user profile interface.
 */
export default async function UserProfilePage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  // Verify admin authentication
  const adminUser = await verifyAdminUser();
  if (!adminUser) {
    redirect('/admin');
  }

  // Get userId from params
  const { userId } = await params;

  // Validate UUID format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(userId)) {
    return (
      <div className="space-y-6">
        {/* Back button */}
        <div>
          <Link
            href="/admin/users"
            className="inline-flex items-center text-sm font-medium text-purple-600 hover:text-purple-700"
          >
            <ArrowLeftIcon className="h-4 w-4 mr-2" />
            Back to Users
          </Link>
        </div>

        {/* Error message */}
        <div className="rounded-lg bg-red-50 p-4">
          <div className="flex">
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Invalid User ID</h3>
              <div className="mt-2 text-sm text-red-700">
                <p>The provided user ID is not in a valid UUID format.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Fetch user details
  const user = await getUserDetails(userId);

  if (!user) {
    return (
      <div className="space-y-6">
        {/* Back button */}
        <div>
          <Link
            href="/admin/users"
            className="inline-flex items-center text-sm font-medium text-purple-600 hover:text-purple-700"
          >
            <ArrowLeftIcon className="h-4 w-4 mr-2" />
            Back to Users
          </Link>
        </div>

        {/* Error message */}
        <div className="rounded-lg bg-red-50 p-4">
          <div className="flex">
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">User Not Found</h3>
              <div className="mt-2 text-sm text-red-700">
                <p>The user with ID {userId} could not be found.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Back button */}
      <div>
        <Link
          href="/admin/users"
          className="inline-flex items-center text-sm font-medium text-purple-600 hover:text-purple-700"
        >
          <ArrowLeftIcon className="h-4 w-4 mr-2" />
          Back to Users
        </Link>
      </div>

      {/* User Profile Header */}
      <Suspense fallback={<LoadingFallback />}>
        <UserProfileHeader user={user} />
      </Suspense>

      {/* User Profile Tabs */}
      <Suspense fallback={<LoadingFallback />}>
        <UserProfileTabs user={user} userId={userId} />
      </Suspense>
    </div>
  );
}

/**
 * Generates metadata for the page
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;
  const user = await getUserDetails(userId);

  return {
    title: user ? `${user.full_name || user.email} - User Profile` : 'User Profile',
    description: 'Admin portal user profile viewing',
  };
}
