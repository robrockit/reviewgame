/**
 * @fileoverview Supabase client configuration for browser-side usage.
 *
 * This module creates and configures a Supabase client for use in client-side
 * React components. The client is configured with Realtime capabilities for
 * real-time game features like buzzer events and score updates.
 *
 * @module lib/supabase/client
 */

import { createBrowserClient } from '@supabase/ssr';

// Ensure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are set in your .env.local file
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * Creates a Supabase client for browser-side usage.
 *
 * This function creates a browser-compatible Supabase client with Realtime
 * features enabled. The client is configured to rate-limit realtime events
 * to 10 per second to prevent overwhelming the connection.
 *
 * The client uses environment variables for authentication:
 * - NEXT_PUBLIC_SUPABASE_URL: The Supabase project URL
 * - NEXT_PUBLIC_SUPABASE_ANON_KEY: The anonymous/public API key
 *
 * @returns {SupabaseClient} Configured Supabase browser client
 *
 * @example
 * ```tsx
 * import { createClient } from '@/lib/supabase/client';
 *
 * const supabase = createClient();
 * const { data, error } = await supabase.from('games').select('*');
 * ```
 */
export const createClient = () =>
  createBrowserClient(supabaseUrl, supabaseAnonKey, {
    realtime: {
      params: {
        eventsPerSecond: 10,
      },
    },
  });