'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { BackButton } from '@/components/navigation/BackButton';
import ChangeBanksModal from '@/components/settings/ChangeBanksModal';
import type { User } from '@supabase/supabase-js';
import type { PrebuiltBank } from '@/types/question-banks';

interface Profile {
  id: string;
  email: string;
  stripe_customer_id: string | null;
  subscription_status: string | null;
  stripe_subscription_id: string | null;
  trial_end_date: string | null;
  current_period_end: string | null;
  subscription_tier: string | null;
  accessible_prebuilt_bank_ids: string[] | null;
}

export default function AccountPage() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isChangeBanksOpen, setIsChangeBanksOpen] = useState(false);
  const [selectedBankNames, setSelectedBankNames] = useState<string[]>([]);
  const router = useRouter();
  const supabase = createClient();

  const fetchBankNames = useCallback(async (bankIds: string[]) => {
    if (bankIds.length === 0) {
      setSelectedBankNames([]);
      return;
    }
    try {
      const response = await fetch('/api/question-banks/prebuilt');
      const json = await response.json() as { data?: PrebuiltBank[] };
      const allBanks = json.data ?? [];
      const names = bankIds
        .map((id) => allBanks.find((b) => b.id === id)?.title)
        .filter((name): name is string => name !== undefined);
      setSelectedBankNames(names);
    } catch {
      setSelectedBankNames([]);
    }
  }, []);

  const fetchUserData = useCallback(async () => {
    const { data: { user: authUser } } = await supabase.auth.getUser();

    if (!authUser) {
      router.push('/login');
      return;
    }

    setUser(authUser);

    try {
      const { data: profileData } = await supabase
        .from('profiles')
        .select('id, email, stripe_customer_id, subscription_status, stripe_subscription_id, trial_end_date, current_period_end, subscription_tier, accessible_prebuilt_bank_ids')
        .eq('id', authUser.id)
        .single();

      if (profileData) {
        const rawIds = profileData.accessible_prebuilt_bank_ids;
        const bankIds = Array.isArray(rawIds)
          ? rawIds.filter((id): id is string => typeof id === 'string')
          : null;

        const typedProfile: Profile = {
          ...profileData,
          accessible_prebuilt_bank_ids: bankIds,
        };
        setProfile(typedProfile);

        if (typedProfile.subscription_tier?.toUpperCase() === 'FREE' && bankIds) {
          void fetchBankNames(bankIds);
        }
      }
    } finally {
      setLoading(false);
    }
  }, [router, supabase, fetchBankNames]);

  useEffect(() => {
    void fetchUserData();
  }, [fetchUserData]);

  const handleManageSubscription = async () => {
    // Redirect to Stripe customer portal for subscription management
    // This would require a backend endpoint to generate a portal session
    alert('Subscription management portal coming soon!');
  };

  const handleChangeBanksSuccess = () => {
    void fetchUserData();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  const isFreeUser = profile?.subscription_tier?.toUpperCase() === 'FREE';
  const currentBankIds = profile?.accessible_prebuilt_bank_ids ?? [];

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

        {/* Your Question Banks — FREE users only */}
        {isFreeUser && (
          <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">Your Question Banks</h2>
              <button
                onClick={() => setIsChangeBanksOpen(true)}
                className="px-4 py-2 text-sm font-medium text-indigo-600 border border-indigo-600 rounded-lg hover:bg-indigo-50 transition-colors"
              >
                Change Banks
              </button>
            </div>

            {currentBankIds.length === 0 ? (
              <p className="text-gray-500 text-sm">No banks selected yet.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {selectedBankNames.length > 0
                  ? selectedBankNames.map((name) => (
                      <span
                        key={name}
                        className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-indigo-100 text-indigo-800"
                      >
                        {name}
                      </span>
                    ))
                  : currentBankIds.map((id) => (
                      <span
                        key={id}
                        className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-700 font-mono"
                      >
                        {id}
                      </span>
                    ))}
              </div>
            )}
          </div>
        )}

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

      {/* Change Banks Modal */}
      {isFreeUser && (
        <ChangeBanksModal
          isOpen={isChangeBanksOpen}
          onClose={() => setIsChangeBanksOpen(false)}
          currentBankIds={currentBankIds}
          onSuccess={handleChangeBanksSuccess}
        />
      )}
    </div>
  );
}
