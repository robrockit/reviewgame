'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { BackButton } from '@/components/navigation/BackButton';
import type { User } from '@supabase/supabase-js';
import type { UserContextResponse } from '@/app/api/user/context/route';

interface Profile {
  id: string;
  email: string;
  stripe_customer_id: string | null;
  subscription_status: string | null;
  stripe_subscription_id: string | null;
  trial_end_date: string | null;
  current_period_end: string | null;
}

export default function AccountPage() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [userContext, setUserContext] = useState<UserContextResponse | null>(null);
  const [viewingUserEmail, setViewingUserEmail] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    const fetchUserData = async () => {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        router.push('/login');
        return;
      }

      setUser(user);

      // Fetch user context to check for impersonation
      let effectiveUserId = user.id;
      let profileData = null;

      try {
        const contextResponse = await fetch('/api/user/context');
        if (contextResponse.ok) {
          const context: UserContextResponse = await contextResponse.json();
          setUserContext(context);
          effectiveUserId = context.effectiveUserId;

          if (context.isImpersonating) {
            setViewingUserEmail(context.effectiveUserEmail);
          }

          // Use profile data from context if available (bypasses RLS for impersonation)
          if (context.profile) {
            profileData = {
              id: effectiveUserId,
              email: context.effectiveUserEmail,
              stripe_customer_id: context.profile.stripe_customer_id,
              subscription_status: context.profile.subscription_status,
              stripe_subscription_id: context.profile.stripe_subscription_id,
              trial_end_date: context.profile.trial_end_date,
              current_period_end: context.profile.current_period_end,
            };
          }
        }
      } catch (error) {
        console.error('Failed to fetch user context:', error);
      }

      // If no profile data from context (shouldn't happen), fall back to direct query
      // This will only work when not impersonating due to RLS
      if (!profileData) {
        const { data } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', effectiveUserId)
          .single();
        profileData = data;
      }

      setProfile(profileData);
      setLoading(false);
    };

    fetchUserData();
  }, [router, supabase]);

  const handleManageSubscription = async () => {
    // Redirect to Stripe customer portal for subscription management
    // This would require a backend endpoint to generate a portal session
    alert('Subscription management portal coming soon!');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Impersonation Alert */}
        {userContext?.isImpersonating && viewingUserEmail && (
          <div className="mb-6 bg-amber-50 border-l-4 border-amber-400 p-4 rounded-lg">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-amber-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-amber-700">
                  <span className="font-medium">Viewing as user:</span> {viewingUserEmail}
                </p>
                <p className="text-xs text-amber-600 mt-1">
                  You are viewing this account settings page as the target user. All data shown is scoped to their account.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="mb-6">
          <BackButton href="/dashboard" variant="text" className="mb-4" />
          <h1 className="text-3xl font-bold text-gray-900">Account Settings</h1>
        </div>

        {/* Account Information */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Account Information</h2>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium text-gray-700">Email</label>
              <p className="text-gray-900">
                {userContext?.isImpersonating ? viewingUserEmail : user?.email}
              </p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Account ID</label>
              <p className="text-gray-900 font-mono text-sm">
                {userContext?.isImpersonating ? profile?.id : user?.id}
              </p>
            </div>
            {!userContext?.isImpersonating && (
              <div>
                <label className="text-sm font-medium text-gray-700">Member Since</label>
                <p className="text-gray-900">
                  {user?.created_at ? new Date(user.created_at).toLocaleDateString() : 'N/A'}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Subscription Status */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Subscription Status</h2>

          {profile?.subscription_status ? (
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium text-gray-700">Status</label>
                <p className="text-gray-900 capitalize">
                  <span
                    className={`inline-flex px-2 py-1 rounded-full text-xs font-semibold ${
                      profile.subscription_status === 'active'
                        ? 'bg-green-100 text-green-800'
                        : profile.subscription_status === 'trialing'
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}
                  >
                    {profile.subscription_status}
                  </span>
                </p>
              </div>

              {profile.current_period_end && (
                <div>
                  <label className="text-sm font-medium text-gray-700">Current Period Ends</label>
                  <p className="text-gray-900">
                    {new Date(profile.current_period_end).toLocaleDateString()}
                  </p>
                </div>
              )}

              {profile.trial_end_date && (
                <div>
                  <label className="text-sm font-medium text-gray-700">Trial Ends</label>
                  <p className="text-gray-900">
                    {new Date(profile.trial_end_date).toLocaleDateString()}
                  </p>
                </div>
              )}

              <div className="pt-4">
                <button
                  onClick={handleManageSubscription}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                >
                  Manage Subscription
                </button>
              </div>
            </div>
          ) : (
            <div className="text-center py-6">
              <p className="text-gray-600 mb-4">You don&apos;t have an active subscription yet.</p>
              <button
                onClick={() => router.push('/pricing')}
                className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
              >
                View Pricing Plans
              </button>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-xl font-semibold mb-4">Account Actions</h2>
          <div className="space-y-3">
            <button
              onClick={() => router.push('/pricing')}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-left"
            >
              Upgrade Plan
            </button>
            <button
              onClick={async () => {
                if (confirm('Are you sure you want to sign out?')) {
                  await supabase.auth.signOut();
                  router.push('/');
                }
              }}
              className="w-full px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors text-left"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
