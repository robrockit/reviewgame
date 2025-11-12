/**
 * @fileoverview Tab navigation component for user profile sections.
 *
 * Provides tab navigation between Profile, Subscription, Activity, Games, and Banks sections.
 *
 * @module app/admin/users/[userId]/components/UserProfileTabs
 */

'use client';

import { useState } from 'react';
import { Tab } from '@headlessui/react';
import { clsx } from 'clsx';
import ProfileTab from './ProfileTab';
import SubscriptionTab from './SubscriptionTab';
import ActivityTab from './ActivityTab';
import GamesTab from './GamesTab';
import BanksTab from './BanksTab';
import type { AdminUserDetail } from '@/app/api/admin/users/[userId]/route';

interface UserProfileTabsProps {
  user: AdminUserDetail;
  userId: string;
}

/**
 * Tab configuration
 */
const tabs = [
  { name: 'Profile', id: 'profile' },
  { name: 'Subscription', id: 'subscription' },
  { name: 'Activity', id: 'activity' },
  { name: 'Games', id: 'games' },
  { name: 'Banks', id: 'banks' },
];

/**
 * User profile tabs component
 *
 * Manages tab navigation and renders the appropriate content based on the selected tab.
 * Uses Headless UI Tab component for accessibility and keyboard navigation.
 */
export default function UserProfileTabs({ user, userId }: UserProfileTabsProps) {
  return (
    <div className="bg-white shadow-sm rounded-lg">
      <Tab.Group>
        {/* Tab navigation */}
        <Tab.List className="flex space-x-1 border-b border-gray-200 px-6">
          {tabs.map((tab) => (
            <Tab
              key={tab.id}
              className={({ selected }) =>
                clsx(
                  'px-4 py-3 text-sm font-medium leading-5 transition-all',
                  'focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2',
                  selected
                    ? 'border-b-2 border-purple-600 text-purple-600'
                    : 'text-gray-600 hover:text-gray-800 hover:border-gray-300 border-b-2 border-transparent'
                )
              }
            >
              {tab.name}
            </Tab>
          ))}
        </Tab.List>

        {/* Tab panels */}
        <Tab.Panels className="p-6">
          {/* Profile Tab */}
          <Tab.Panel>
            <ProfileTab user={user} />
          </Tab.Panel>

          {/* Subscription Tab */}
          <Tab.Panel>
            <SubscriptionTab user={user} />
          </Tab.Panel>

          {/* Activity Tab */}
          <Tab.Panel>
            <ActivityTab userId={userId} />
          </Tab.Panel>

          {/* Games Tab */}
          <Tab.Panel>
            <GamesTab userId={userId} />
          </Tab.Panel>

          {/* Banks Tab */}
          <Tab.Panel>
            <BanksTab userId={userId} />
          </Tab.Panel>
        </Tab.Panels>
      </Tab.Group>
    </div>
  );
}
