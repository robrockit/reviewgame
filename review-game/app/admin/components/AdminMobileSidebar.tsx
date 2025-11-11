/**
 * @fileoverview Mobile sidebar component for admin portal.
 *
 * Provides a responsive mobile menu that slides in from the left.
 *
 * @module app/admin/components/AdminMobileSidebar
 */

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import {
  HomeIcon,
  UsersIcon,
  CreditCardIcon,
  FlagIcon,
  ClipboardDocumentListIcon,
  Cog6ToothIcon,
  XMarkIcon,
  ArrowLeftOnRectangleIcon,
} from '@heroicons/react/24/outline';
import type { AdminProfile } from '@/lib/admin/auth';

/**
 * Navigation items (same as desktop sidebar)
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
 * AdminMobileSidebar component props
 */
interface AdminMobileSidebarProps {
  open: boolean;
  onClose: () => void;
  adminUser: AdminProfile;
}

/**
 * Mobile sidebar navigation component.
 *
 * Renders a slide-out navigation menu for mobile devices using Headless UI Dialog.
 *
 * @param {AdminMobileSidebarProps} props - Component props
 * @returns {JSX.Element} Mobile sidebar dialog
 */
export default function AdminMobileSidebar({
  open,
  onClose,
  adminUser,
}: AdminMobileSidebarProps) {
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
    <Transition.Root show={open} as={Fragment}>
      <Dialog as="div" className="relative z-50 lg:hidden" onClose={onClose}>
        {/* Backdrop */}
        <Transition.Child
          as={Fragment}
          enter="transition-opacity ease-linear duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="transition-opacity ease-linear duration-300"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-gray-900/80" />
        </Transition.Child>

        <div className="fixed inset-0 flex">
          {/* Sidebar Panel */}
          <Transition.Child
            as={Fragment}
            enter="transition ease-in-out duration-300 transform"
            enterFrom="-translate-x-full"
            enterTo="translate-x-0"
            leave="transition ease-in-out duration-300 transform"
            leaveFrom="translate-x-0"
            leaveTo="-translate-x-full"
          >
            <Dialog.Panel className="relative mr-16 flex w-full max-w-xs flex-1">
              {/* Close button */}
              <Transition.Child
                as={Fragment}
                enter="ease-in-out duration-300"
                enterFrom="opacity-0"
                enterTo="opacity-100"
                leave="ease-in-out duration-300"
                leaveFrom="opacity-100"
                leaveTo="opacity-0"
              >
                <div className="absolute left-full top-0 flex w-16 justify-center pt-5">
                  <button
                    type="button"
                    className="-m-2.5 p-2.5"
                    onClick={onClose}
                  >
                    <span className="sr-only">Close sidebar</span>
                    <XMarkIcon
                      className="h-6 w-6 text-white"
                      aria-hidden="true"
                    />
                  </button>
                </div>
              </Transition.Child>

              {/* Sidebar content */}
              <div className="flex grow flex-col gap-y-5 overflow-y-auto bg-white px-6 pb-2">
                {/* Logo/Brand */}
                <div className="flex h-16 shrink-0 items-center">
                  <div className="flex items-center">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-600">
                      <span className="text-xl font-bold text-white">A</span>
                    </div>
                    <div className="ml-3">
                      <h1 className="text-xl font-bold text-gray-900">
                        Admin Portal
                      </h1>
                      <p className="text-xs text-gray-500">Review Game</p>
                    </div>
                  </div>
                </div>

                {/* Navigation */}
                <nav className="flex flex-1 flex-col">
                  <ul role="list" className="flex flex-1 flex-col gap-y-7">
                    <li>
                      <ul role="list" className="-mx-2 space-y-1">
                        {navigationItems.map((item) => {
                          const active = isActive(item.href);
                          return (
                            <li key={item.name}>
                              <Link
                                href={item.href}
                                onClick={onClose}
                                className={`
                                  group flex gap-x-3 rounded-md p-2 text-sm leading-6 font-semibold
                                  ${
                                    active
                                      ? 'bg-purple-50 text-purple-600'
                                      : 'text-gray-700 hover:text-purple-600 hover:bg-gray-50'
                                  }
                                `}
                              >
                                <item.icon
                                  className={`
                                    h-6 w-6 shrink-0
                                    ${active ? 'text-purple-600' : 'text-gray-400 group-hover:text-purple-600'}
                                  `}
                                  aria-hidden="true"
                                />
                                {item.name}
                              </Link>
                            </li>
                          );
                        })}
                      </ul>
                    </li>

                    {/* User info & Exit */}
                    <li className="-mx-2 mt-auto space-y-3">
                      {/* User Info */}
                      <div className="flex items-center gap-x-3 rounded-md p-2 text-sm leading-6">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-purple-100 text-purple-600 font-semibold">
                          {adminUser.email.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="truncate text-sm font-medium text-gray-900">
                            {adminUser.full_name || adminUser.email.split('@')[0]}
                          </p>
                          <p className="truncate text-xs text-gray-500">
                            {adminUser.email}
                          </p>
                        </div>
                      </div>

                      {/* Exit to Main App */}
                      <Link
                        href="/dashboard"
                        onClick={onClose}
                        className="flex items-center justify-center px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
                      >
                        <ArrowLeftOnRectangleIcon className="mr-2 h-4 w-4" />
                        Exit to Main App
                      </Link>
                    </li>
                  </ul>
                </nav>
              </div>
            </Dialog.Panel>
          </Transition.Child>
        </div>
      </Dialog>
    </Transition.Root>
  );
}
