/**
 * @fileoverview Admin portal layout with sidebar navigation.
 *
 * This layout provides the structure for all admin pages, including:
 * - Persistent sidebar navigation
 * - Admin header with user info
 * - Protected route wrapper (redirects non-admins)
 * - Exit to main app functionality
 *
 * @module app/admin/layout
 */

import { redirect } from 'next/navigation';
import { verifyAdminUser } from '@/lib/admin/auth';
import AdminHeader from './components/AdminHeader';
import AdminSidebar from './components/AdminSidebar';

/**
 * Admin layout component.
 *
 * This server component wraps all admin pages and provides:
 * - Admin authentication check
 * - Consistent navigation structure
 * - Sidebar and header components
 *
 * @param {Object} props - Component props
 * @param {React.ReactNode} props.children - Page content to render
 * @returns {Promise<JSX.Element>} Admin layout with sidebar
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Verify admin user on server side
  const adminUser = await verifyAdminUser();

  // Redirect to dashboard if not an admin
  if (!adminUser) {
    redirect('/dashboard');
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Sidebar */}
      <AdminSidebar adminUser={adminUser} />

      {/* Main Content Area */}
      <div className="lg:pl-64">
        {/* Header */}
        <AdminHeader adminUser={adminUser} />

        {/* Page Content */}
        <main className="py-6">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
