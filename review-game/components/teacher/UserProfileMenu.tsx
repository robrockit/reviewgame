/**
 * @fileoverview User profile dropdown menu component.
 *
 * Provides a dropdown menu for user profile actions:
 * - Display user email/name
 * - Settings link
 * - Subscription link
 * - Logout action
 *
 * @module components/teacher/UserProfileMenu
 */

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Menu, Transition } from '@headlessui/react';
import { Cog6ToothIcon, CreditCardIcon, ArrowRightOnRectangleIcon } from '@heroicons/react/24/outline';
import { createClient } from '@/lib/supabase/client';
import { Fragment } from 'react';
import type { User } from '@supabase/supabase-js';
import { logger } from '@/lib/logger';

/**
 * User profile dropdown menu component.
 *
 * Fetches current user from Supabase Auth and displays
 * a dropdown menu with profile actions.
 */
export default function UserProfileMenu() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  // Fetch current user
  useEffect(() => {
    const supabase = createClient();

    const fetchUser = async () => {
      try {
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError) throw authError;

        setUser(user);
        setError(null);
      } catch (err) {
        logger.error('Failed to fetch user in profile menu', err, {
          operation: 'fetch_user_profile_menu',
          component: 'UserProfileMenu',
        });
        setError('Failed to load user');
      } finally {
        setLoading(false);
      }
    };

    fetchUser();
  }, []); // Empty dependency array - run once on mount

  /**
   * Handles user logout.
   * Signs out from Supabase and redirects to login page.
   */
  const handleLogout = async () => {
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
      router.push('/login');
    } catch (error) {
      logger.error('Failed to sign out user', error, {
        operation: 'user_logout',
        component: 'UserProfileMenu',
      });
    }
  };

  if (loading) {
    return (
      <div className="h-8 w-8 rounded-full bg-gray-200 animate-pulse" />
    );
  }

  if (error || !user) {
    return (
      <div
        className="h-8 w-8 rounded-full bg-red-100 flex items-center justify-center cursor-pointer"
        title={error || 'Not logged in'}
      >
        <span className="text-red-600 text-xs font-bold">!</span>
      </div>
    );
  }

  // Display user initials or icon
  const userInitials = user?.email
    ? user.email.substring(0, 2).toUpperCase()
    : '??';

  return (
    <Menu as="div" className="relative">
      {/* Menu Button */}
      <Menu.Button className="flex items-center justify-center h-8 w-8 rounded-full bg-blue-600 text-white font-semibold hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2">
        <span className="sr-only">Open user menu</span>
        {userInitials}
      </Menu.Button>

      {/* Dropdown Menu */}
      <Transition
        as={Fragment}
        enter="transition ease-out duration-100"
        enterFrom="transform opacity-0 scale-95"
        enterTo="transform opacity-100 scale-100"
        leave="transition ease-in duration-75"
        leaveFrom="transform opacity-100 scale-100"
        leaveTo="transform opacity-0 scale-95"
      >
        <Menu.Items className="absolute right-0 mt-2 w-64 origin-top-right rounded-lg bg-white shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
          {/* User Info Header */}
          <div className="px-4 py-3 border-b border-gray-200">
            <p className="text-sm text-gray-500">Signed in as</p>
            <p className="text-sm font-medium text-gray-900 truncate">
              {user?.email || 'Unknown User'}
            </p>
          </div>

          {/* Menu Items */}
          <div className="py-1">
            {/* Settings */}
            <Menu.Item>
              {({ active }) => (
                <button
                  onClick={() => router.push('/dashboard/settings')}
                  className={`${
                    active ? 'bg-gray-100' : ''
                  } flex w-full items-center px-4 py-2 text-sm text-gray-700 transition-colors`}
                >
                  <Cog6ToothIcon className="mr-3 h-5 w-5 text-gray-400" aria-hidden="true" />
                  Settings
                </button>
              )}
            </Menu.Item>

            {/* Subscription */}
            <Menu.Item>
              {({ active }) => (
                <button
                  onClick={() => router.push('/dashboard/subscription')}
                  className={`${
                    active ? 'bg-gray-100' : ''
                  } flex w-full items-center px-4 py-2 text-sm text-gray-700 transition-colors`}
                >
                  <CreditCardIcon className="mr-3 h-5 w-5 text-gray-400" aria-hidden="true" />
                  Subscription
                </button>
              )}
            </Menu.Item>

            {/* Divider */}
            <div className="border-t border-gray-200 my-1" />

            {/* Logout */}
            <Menu.Item>
              {({ active }) => (
                <button
                  onClick={handleLogout}
                  className={`${
                    active ? 'bg-gray-100' : ''
                  } flex w-full items-center px-4 py-2 text-sm text-red-600 transition-colors`}
                >
                  <ArrowRightOnRectangleIcon className="mr-3 h-5 w-5 text-red-500" aria-hidden="true" />
                  Sign out
                </button>
              )}
            </Menu.Item>
          </div>
        </Menu.Items>
      </Transition>
    </Menu>
  );
}
