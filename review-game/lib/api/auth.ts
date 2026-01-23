/**
 * @fileoverview Authentication utilities for API routes
 *
 * Provides reusable authentication helpers to eliminate code duplication
 * across API endpoints.
 *
 * @module lib/api/auth
 */

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { User } from '@supabase/supabase-js';

/**
 * Result type for authentication
 */
export interface AuthResult {
  user: User | null;
  supabase: SupabaseClient | null;
  error: NextResponse | null;
}

/**
 * Get authenticated user and Supabase client for API routes
 *
 * This utility eliminates duplicate Supabase client creation code
 * across all API endpoints.
 *
 * @returns Object containing user, supabase client, or error response
 *
 * @example
 * ```typescript
 * export async function GET() {
 *   const { user, supabase, error } = await getAuthenticatedUser();
 *   if (error) return error;
 *
 *   // Continue with authenticated logic
 *   const { data } = await supabase.from('profiles').select('*').eq('id', user.id);
 * }
 * ```
 */
export async function getAuthenticatedUser(): Promise<AuthResult> {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options) {
          cookieStore.set({ name, value, ...options });
        },
        remove(name: string, options) {
          cookieStore.delete({ name, ...options });
        },
      },
    }
  );

  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return {
      error: NextResponse.json(
        { error: 'Unauthorized: Authentication required' },
        { status: 401 }
      ),
      user: null,
      supabase: null,
    };
  }

  return { user, supabase, error: null };
}
