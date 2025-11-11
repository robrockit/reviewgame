/**
 * @fileoverview Admin sidebar navigation component.
 *
 * Provides persistent navigation for the admin portal with:
 * - Navigation links to admin sections
 * - Active state indication
 * - User profile display
 * - Exit to main app link
 *
 * @module app/admin/components/AdminSidebar
 */

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  HomeIcon,
  UsersIcon,
  CreditCardIcon,
  FlagIcon,
  ClipboardDocumentListIcon,
  Cog6ToothIcon,
  ArrowLeftOnRectangleIcon
} from '@heroicons/react/24/outline';
import type { AdminProfile } from '@/lib/admin/auth';

/**
 * Navigation item configuration
 */
const navigationItems = [
  { name: 'Dashboard', href: '/admin', icon: HomeIcon },
  { name: 'Users', href: '/admin/users', icon: UsersIcon },
  { name: 'Payments', href: '/admin/payments', icon: CreditCardIcon },
  { name: 'Moderation', href: '/admin/moderation', icon: FlagIcon },
  { name: 'Audit Log', href: '/admin/audit', icon: ClipboardDocumentListIcon },
  { name: 'Settings', href: '/admin/settings', icon: Cog6ToothIcon },
];

/**
 * AdminSidebar component props
 */
interface AdminSidebarProps {
  adminUser: AdminProfile;
}

/**
 * Admin sidebar navigation component.
 *
 * Displays the admin portal navigation sidebar with active state indication
 * and user information.
 *
 * @param {AdminSidebarProps} props - Component props
 * @returns {JSX.Element} Sidebar navigation
 */
export default function AdminSidebar({ adminUser }: AdminSidebarProps) {
  const pathname = usePathname();

  /**
   * Checks if a navigation item is active
   */
  const isActive = (href: string) => {
    if (href === '/admin') {
      return pathname === href;
    }
    return pathname.startsWith(href);
  };

  return (
    <div className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-64 lg:flex-col">
      <div className="flex min-h-0 flex-1 flex-col border-r border-gray-200 bg-white">
        {/* Logo/Brand */}
        <div className="flex flex-1 flex-col overflow-y-auto pt-5 pb-4">
          <div className="flex flex-shrink-0 items-center px-4">
            <div className="flex items-center">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-600">
                <span className="text-xl font-bold text-white">A</span>
              </div>
              <div className="ml-3">
                <h1 className="text-xl font-bold text-gray-900">Admin Portal</h1>
                <p className="text-xs text-gray-500">Review Game</p>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <nav className="mt-8 flex-1 space-y-1 px-2">
            {navigationItems.map((item) => {
              const active = isActive(item.href);
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`
                    group flex items-center px-2 py-2 text-sm font-medium rounded-md transition-colors
                    ${
                      active
                        ? 'bg-purple-50 text-purple-600'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    }
                  `}
                >
                  <item.icon
                    className={`
                      mr-3 h-5 w-5 flex-shrink-0
                      ${active ? 'text-purple-600' : 'text-gray-400 group-hover:text-gray-500'}
                    `}
                    aria-hidden="true"
                  />
                  {item.name}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* User Profile & Exit */}
        <div className="flex flex-shrink-0 border-t border-gray-200 p-4">
          <div className="flex flex-col w-full space-y-3">
            {/* User Info */}
            <div className="flex items-center">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-purple-100 text-purple-600 font-semibold">
                {adminUser.email.charAt(0).toUpperCase()}
              </div>
              <div className="ml-3 min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-gray-900">
                  {adminUser.full_name || adminUser.email.split('@')[0]}
                </p>
                <p className="truncate text-xs text-gray-500">{adminUser.email}</p>
              </div>
            </div>

            {/* Exit to Main App */}
            <Link
              href="/dashboard"
              className="flex items-center justify-center px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
            >
              <ArrowLeftOnRectangleIcon className="mr-2 h-4 w-4" />
              Exit to Main App
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
