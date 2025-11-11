/**
 * @fileoverview Admin authentication utilities and helpers.
 *
 * This module provides server-side and client-side utilities for admin authentication
 * and authorization. It includes functions to verify admin status, check permissions,
 * and handle admin-specific operations.
 *
 * @module lib/admin/auth
 */

import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { createClient as createBrowserClient } from '@/lib/supabase/client';
import { cookies } from 'next/headers';
import type { Database } from '@/types/database.types';

/**
 * Profile with admin role information
 */
export type AdminProfile = {
  id: string;
  email: string;
  role: 'user' | 'admin';
  is_active: boolean;
  full_name: string | null;
};

/**
 * Creates a Supabase server client for admin operations.
 *
 * This function creates a server-side Supabase client with proper cookie handling
 * for use in Server Components, Route Handlers, and Server Actions.
 *
 * @returns {Promise<SupabaseClient>} Configured Supabase server client
 *
 * @example
 * ```tsx
 * import { createAdminServerClient } from '@/lib/admin/auth';
 *
 * const supabase = await createAdminServerClient();
 * const { data } = await supabase.from('profiles').select('*');
 * ```
 */
export async function createAdminServerClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value, ...options });
          } catch (error) {
            // Handle cookie setting errors in middleware
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value: '', ...options });
          } catch (error) {
            // Handle cookie removal errors in middleware
          }
        },
      },
    }
  );
}

/**
 * Verifies if the current authenticated user is an active admin.
 *
 * This function checks both authentication status and admin role.
 * Returns the admin profile if valid, or null otherwise.
 *
 * @returns {Promise<AdminProfile | null>} Admin profile or null
 *
 * @example
 * ```tsx
 * const adminUser = await verifyAdminUser();
 * if (!adminUser) {
 *   redirect('/dashboard');
 * }
 * ```
 */
export async function verifyAdminUser(): Promise<AdminProfile | null> {
  const supabase = await createAdminServerClient();

  // Check authentication
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return null;
  }

  // Check admin role and active status
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, email, role, is_active, full_name')
    .eq('id', user.id)
    .single();

  if (profileError || !profile) {
    return null;
  }

  // Verify admin role and active status
  if (profile.role !== 'admin' || !profile.is_active) {
    return null;
  }

  return profile as AdminProfile;
}

/**
 * Client-side hook to check if current user is an admin.
 *
 * This function uses the Supabase RPC function `is_admin()` to check
 * admin status. Should be used in client components.
 *
 * @returns {Promise<boolean>} True if user is an active admin
 *
 * @example
 * ```tsx
 * 'use client';
 *
 * const isAdmin = await checkIsAdmin();
 * if (!isAdmin) {
 *   router.push('/dashboard');
 * }
 * ```
 */
export async function checkIsAdmin(): Promise<boolean> {
  const supabase = createBrowserClient();

  try {
    const { data, error } = await supabase.rpc('is_admin');

    if (error) {
      console.error('Error checking admin status:', error);
      return false;
    }

    return data === true;
  } catch (error) {
    console.error('Error checking admin status:', error);
    return false;
  }
}

/**
 * Logs an admin action to the audit log.
 *
 * This function calls the `log_admin_action` RPC function to record
 * admin actions for compliance and troubleshooting.
 *
 * @param {Object} params - Audit log parameters
 * @param {string} params.actionType - Type of action (e.g., 'view', 'edit', 'delete')
 * @param {string} params.targetType - Type of target entity (e.g., 'profile', 'subscription')
 * @param {string} params.targetId - ID of the target entity
 * @param {Object} [params.changes] - Before/after changes (for edits)
 * @param {string} [params.reason] - Reason for the action
 * @param {string} [params.notes] - Additional notes
 * @param {string} [params.ipAddress] - IP address of admin
 * @param {string} [params.userAgent] - Browser user agent
 * @returns {Promise<string | null>} UUID of audit log entry, or null on error
 *
 * @example
 * ```tsx
 * await logAdminAction({
 *   actionType: 'suspend_user',
 *   targetType: 'profile',
 *   targetId: userId,
 *   reason: 'Violation of terms of service',
 *   notes: 'User reported for inappropriate content',
 * });
 * ```
 */
export async function logAdminAction({
  actionType,
  targetType,
  targetId,
  changes,
  reason,
  notes,
  ipAddress,
  userAgent,
}: {
  actionType: string;
  targetType: string;
  targetId: string;
  changes?: Record<string, unknown>;
  reason?: string;
  notes?: string;
  ipAddress?: string;
  userAgent?: string;
}): Promise<string | null> {
  const supabase = await createAdminServerClient();

  try {
    const { data, error } = await supabase.rpc('log_admin_action', {
      p_action_type: actionType,
      p_target_type: targetType,
      p_target_id: targetId,
      p_changes: changes ? JSON.parse(JSON.stringify(changes)) : null,
      p_reason: reason || null,
      p_notes: notes || null,
      p_ip_address: ipAddress || null,
      p_user_agent: userAgent || null,
    });

    if (error) {
      console.error('Error logging admin action:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Error logging admin action:', error);
    return null;
  }
}

/**
 * Gets the current admin user's profile.
 *
 * Convenience function that combines authentication and profile fetching.
 * Returns null if user is not an admin.
 *
 * @returns {Promise<AdminProfile | null>} Admin profile or null
 *
 * @example
 * ```tsx
 * const admin = await getCurrentAdmin();
 * if (admin) {
 *   console.log(`Admin: ${admin.email}`);
 * }
 * ```
 */
export async function getCurrentAdmin(): Promise<AdminProfile | null> {
  return verifyAdminUser();
}
