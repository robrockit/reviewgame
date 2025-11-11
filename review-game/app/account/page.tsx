'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { BackButton } from '@/components/navigation/BackButton';
import type { User } from '@supabase/supabase-js';

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

      // Fetch profile data
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

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
              <p className="text-gray-900">{user?.email}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Account ID</label>
              <p className="text-gray-900 font-mono text-sm">{user?.id}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Member Since</label>
              <p className="text-gray-900">
                {user?.created_at ? new Date(user.created_at).toLocaleDateString() : 'N/A'}
              </p>
            </div>
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
