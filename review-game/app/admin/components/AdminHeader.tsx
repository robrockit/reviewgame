/**
 * @fileoverview Admin header component.
 *
 * Provides the header bar for admin pages with:
 * - Mobile menu toggle
 * - Breadcrumb/page title
 * - Admin badge
 * - Quick actions
 *
 * @module app/admin/components/AdminHeader
 */

'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { Bars3Icon, XMarkIcon } from '@heroicons/react/24/outline';
import type { AdminProfile } from '@/lib/admin/auth';
import AdminMobileSidebar from './AdminMobileSidebar';

/**
 * AdminHeader component props
 */
interface AdminHeaderProps {
  adminUser: AdminProfile;
}

/**
 * Gets the page title based on the current pathname
 */
function getPageTitle(pathname: string): string {
  if (pathname === '/admin') return 'Dashboard';
  if (pathname.startsWith('/admin/users')) return 'User Management';
  if (pathname.startsWith('/admin/payments')) return 'Payments';
  if (pathname.startsWith('/admin/moderation')) return 'Content Moderation';
  if (pathname.startsWith('/admin/audit')) return 'Audit Log';
  if (pathname.startsWith('/admin/settings')) return 'Settings';
  return 'Admin Portal';
}

/**
 * Admin header component.
 *
 * Displays the top header bar for admin pages with mobile menu toggle
 * and page title.
 *
 * @param {AdminHeaderProps} props - Component props
 * @returns {JSX.Element} Header bar
 */
export default function AdminHeader({ adminUser }: AdminHeaderProps) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const pageTitle = getPageTitle(pathname);

  return (
    <>
      <header className="bg-white shadow-sm">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          {/* Mobile menu button */}
          <button
            type="button"
            className="inline-flex items-center justify-center rounded-md p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-500 lg:hidden"
            onClick={() => setMobileMenuOpen(true)}
          >
            <span className="sr-only">Open sidebar</span>
            <Bars3Icon className="h-6 w-6" aria-hidden="true" />
          </button>

          {/* Page Title */}
          <div className="flex items-center space-x-3">
            <h1 className="text-2xl font-semibold text-gray-900">{pageTitle}</h1>
            <span className="inline-flex items-center rounded-full bg-purple-100 px-2.5 py-0.5 text-xs font-medium text-purple-800">
              Admin
            </span>
          </div>

          {/* Desktop user info (optional, can add quick actions here) */}
          <div className="hidden lg:flex lg:items-center lg:space-x-4">
            {/* Add quick action buttons here if needed */}
          </div>
        </div>
      </header>

      {/* Mobile Sidebar */}
      <AdminMobileSidebar
        open={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
        adminUser={adminUser}
      />
    </>
  );
}
