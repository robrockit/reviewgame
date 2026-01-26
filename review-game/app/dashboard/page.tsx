'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { User } from '@supabase/supabase-js';
import type { UserContextResponse } from '@/app/api/user/context/route';

export default function DashboardPage() {
  const [user, setUser] = useState<User | null>(null);
  const [userContext, setUserContext] = useState<UserContextResponse | null>(null);
  const [viewingUserEmail, setViewingUserEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();

    const loadUserAndContext = async () => {
      // Get authenticated user
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        router.push('/login');
        return;
      }

      setUser(user);

      // Fetch user context to check for impersonation
      try {
        const contextResponse = await fetch('/api/user/context');
        if (contextResponse.ok) {
          const context: UserContextResponse = await contextResponse.json();
          setUserContext(context);

          // Set the viewing user email from the context response
          // API handles fetching the email (bypasses RLS if needed)
          if (context.isImpersonating) {
            setViewingUserEmail(context.effectiveUserEmail);
          }
        }
      } catch (error) {
        console.error('Failed to fetch user context:', error);
      }

      setLoading(false);
    };

    loadUserAndContext();
  }, [router]);

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/');
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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
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
                  You are viewing this dashboard as the target user. All data shown is scoped to their account.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
              <p className="text-gray-600 mt-1">
                Welcome back, {userContext?.isImpersonating && viewingUserEmail ? viewingUserEmail : user?.email}
              </p>
            </div>
            <button
              onClick={handleSignOut}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              Sign Out
            </button>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
          <div className="bg-white rounded-lg shadow-sm p-6 hover:shadow-md transition-shadow">
            <h2 className="text-xl font-semibold mb-2">Create New Game</h2>
            <p className="text-gray-600 mb-4">Start a new Jeopardy-style review game</p>
            <button
              onClick={() => router.push('/dashboard/games/new')}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Create Game
            </button>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-6 hover:shadow-md transition-shadow">
            <h2 className="text-xl font-semibold mb-2">My Games</h2>
            <p className="text-gray-600 mb-4">View and manage your saved games</p>
            <button
              onClick={() => router.push('/dashboard/games')}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              View Games
            </button>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6 hover:shadow-md transition-shadow">
            <h2 className="text-xl font-semibold mb-2">Subscription</h2>
            <p className="text-gray-600 mb-4">Manage your subscription and billing</p>
            <button
              onClick={() => router.push('/dashboard/subscription')}
              className="w-full px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
            >
              Manage Subscription
            </button>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6 hover:shadow-md transition-shadow">
            <h2 className="text-xl font-semibold mb-2">Subscription</h2>
            <p className="text-gray-600 mb-4">Manage your subscription and billing</p>
            <button
              onClick={() => router.push('/dashboard/subscription')}
              className="w-full px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
            >
              Manage Subscription
            </button>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6 hover:shadow-md transition-shadow">
            <h2 className="text-xl font-semibold mb-2">Account Settings</h2>
            <p className="text-gray-600 mb-4">Update your profile and preferences</p>
            <button
              onClick={() => router.push('/account')}
              className="w-full px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
            >
              Manage Account
            </button>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-2xl font-semibold mb-4">Recent Activity</h2>
          <p className="text-gray-600">No recent games yet. Create your first game to get started!</p>
        </div>
      </div>
    </div>
  );
}
