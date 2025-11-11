/**
 * @fileoverview Next.js middleware for authentication and session management.
 *
 * This middleware runs on every request (matching the config pattern) to:
 * - Create a Supabase server client with cookie management
 * - Refresh user authentication sessions
 * - Track and log session errors via Sentry
 *
 * The middleware operates on all routes except:
 * - API routes (/api/*)
 * - Static files (_next/static/*)
 * - Images (_next/image/*)
 * - Favicon
 * - Auth callback routes
 *
 * @module middleware
 */

import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import * as Sentry from '@sentry/nextjs';

/**
 * Next.js middleware function for authentication and session management.
 *
 * This middleware:
 * 1. Creates a Supabase server client with proper cookie handling
 * 2. Retrieves and validates the user session
 * 3. Protects admin routes (/admin/*) - redirects non-admins to dashboard
 * 4. Logs any session errors to Sentry for monitoring
 * 5. Returns the response with updated authentication cookies
 *
 * The middleware is non-blocking - even if errors occur, the request continues
 * to prevent authentication issues from breaking the entire application.
 *
 * @param {NextRequest} req - The incoming Next.js request object
 * @returns {Promise<NextResponse>} The Next.js response with updated cookies
 *
 * @example
 * This middleware runs automatically on matching routes:
 * - /dashboard → middleware runs (session refresh only)
 * - /admin → middleware runs (admin check + session refresh)
 * - /game/board/123 → middleware runs (session refresh only)
 * - /api/games → middleware skipped (excluded in config)
 * - /_next/static/... → middleware skipped (excluded in config)
 */
export async function middleware(req: NextRequest) {
  let res = NextResponse.next();

  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return req.cookies.get(name)?.value;
          },
          set(name: string, value: string, options: CookieOptions) {
            res.cookies.set({ name, value, ...options });
          },
          remove(name: string, options: CookieOptions) {
            res.cookies.delete({ name, ...options });
          },
        },
      }
    );

    const { error } = await supabase.auth.getSession();

    if (error) {
      // Log session refresh errors
      Sentry.captureException(error, {
        contexts: {
          custom: {
            operation: 'middleware.getSession',
            path: req.nextUrl.pathname,
          },
        },
        tags: {
          middleware: 'auth',
        },
      });
    }

    // Admin route protection
    if (req.nextUrl.pathname.startsWith('/admin')) {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      // Redirect to login if not authenticated
      if (!user) {
        const redirectUrl = new URL('/login', req.url);
        redirectUrl.searchParams.set('redirectTo', req.nextUrl.pathname);
        return NextResponse.redirect(redirectUrl);
      }

      // Check admin role
      const { data: profile } = await supabase
        .from('profiles')
        .select('role, is_active')
        .eq('id', user.id)
        .single();

      // Redirect to dashboard if not an admin or inactive
      if (!profile || profile.role !== 'admin' || !profile.is_active) {
        Sentry.captureMessage('Unauthorized admin access attempt', {
          level: 'warning',
          user: {
            id: user.id,
            email: user.email,
          },
          contexts: {
            custom: {
              path: req.nextUrl.pathname,
              role: profile?.role || 'none',
              isActive: profile?.is_active || false,
            },
          },
        });

        return NextResponse.redirect(new URL('/dashboard', req.url));
      }
    }

    return res;
  } catch (error) {
    // Catch any unexpected middleware errors
    Sentry.captureException(error, {
      contexts: {
        custom: {
          operation: 'middleware',
          path: req.nextUrl.pathname,
          url: req.url,
        },
      },
      tags: {
        middleware: 'error',
      },
    });

    // Return response even if there's an error to avoid breaking the app
    return res;
  }
}

/**
 * Middleware configuration defining which routes to process.
 *
 * This configuration uses Next.js matcher patterns to specify which routes
 * should be processed by the middleware. The pattern includes most routes
 * but excludes:
 * - API routes (/api/*)
 * - Next.js static files (_next/static/*)
 * - Next.js image optimization (_next/image/*)
 * - Favicon (favicon.ico)
 * - Auth callback routes (auth/callback)
 *
 * @constant {Object}
 * @property {string[]} matcher - Array of route patterns to match
 */
export const config = {
  matcher: [
    /*
     * Match all request paths you want to protect, including those
     * starting with a root folder (e.g. /dashboard).
     * Exclude static files and API routes.
     */
    '/((?!api|_next/static|_next/image|favicon.ico|auth/callback).*)',
  ],
};