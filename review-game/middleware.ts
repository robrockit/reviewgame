/**
 * @fileoverview Next.js middleware for authentication and session management.
 *
 * This middleware runs on every request (matching the config pattern) to:
 * - Create a Supabase server client with cookie management
 * - Refresh user authentication sessions
 * - Check for active admin impersonation sessions and set context headers
 * - Track and log session errors via Sentry
 *
 * Impersonation Context Switching:
 * When an admin has an active impersonation session, the middleware sets custom
 * headers that API routes and server components can use to filter data and apply
 * permissions as the target user:
 * - x-impersonating-user-id: Target user's UUID
 * - x-admin-user-id: Admin's UUID (for audit logging)
 * - x-impersonation-session-id: Session UUID
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
 * Simple in-memory rate limiter for admin routes.
 *
 * This provides basic protection against brute force attacks and credential stuffing.
 * In production, consider using a distributed rate limiter with Redis or a service
 * like Vercel Rate Limit API.
 *
 * Configuration:
 * - Window: 15 minutes (900,000 ms)
 * - Max requests per window: 20 requests
 * - Applies only to /admin routes
 */
class RateLimiter {
  private requests: Map<string, { count: number; resetAt: number }> = new Map();
  private readonly windowMs = 15 * 60 * 1000; // 15 minutes
  private readonly maxRequests = 20;

  /**
   * Checks if a request from the given IP should be rate limited.
   *
   * @param ip - The IP address to check
   * @returns {boolean} True if rate limit exceeded, false otherwise
   */
  public isRateLimited(ip: string): boolean {
    const now = Date.now();
    const record = this.requests.get(ip);

    // No record or window expired - allow and create new record
    if (!record || now > record.resetAt) {
      this.requests.set(ip, {
        count: 1,
        resetAt: now + this.windowMs,
      });
      return false;
    }

    // Increment count
    record.count++;

    // Check if limit exceeded
    if (record.count > this.maxRequests) {
      return true;
    }

    return false;
  }

  /**
   * Cleans up expired entries from the rate limit map.
   * Should be called periodically to prevent memory leaks.
   */
  public cleanup(): void {
    const now = Date.now();
    for (const [ip, record] of this.requests.entries()) {
      if (now > record.resetAt) {
        this.requests.delete(ip);
      }
    }
  }
}

// Global rate limiter instance
const adminRateLimiter = new RateLimiter();

// Cleanup expired entries every 5 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    adminRateLimiter.cleanup();
  }, 5 * 60 * 1000);
}

/**
 * Next.js middleware function for authentication and session management.
 *
 * This middleware:
 * 1. Creates a Supabase server client with proper cookie handling
 * 2. Retrieves and validates the user session
 * 3. Checks for active admin impersonation sessions and sets context headers
 * 4. Checks for suspended users and redirects to login
 * 5. Protects admin routes (/admin/*) with rate limiting - redirects non-admins to dashboard
 * 6. Logs any session errors to Sentry for monitoring
 * 7. Returns the response with updated authentication cookies and headers
 *
 * Impersonation Context Switching:
 * When an admin user has an active impersonation session (checked via RPC function),
 * the middleware sets custom headers (x-impersonating-user-id, x-admin-user-id,
 * x-impersonation-session-id) that downstream API routes and server components can
 * use to filter queries and apply permissions as the target user.
 *
 * The middleware is non-blocking - even if errors occur, the request continues
 * to prevent authentication issues from breaking the entire application.
 *
 * @param {NextRequest} req - The incoming Next.js request object
 * @returns {Promise<NextResponse>} The Next.js response with updated cookies and headers
 *
 * @example
 * This middleware runs automatically on matching routes:
 * - /dashboard → middleware runs (session refresh + impersonation check)
 * - /admin → middleware runs (admin check + rate limiting + impersonation)
 * - /game/board/123 → middleware runs (session refresh + impersonation check)
 * - /api/games → middleware skipped (excluded in config)
 * - /_next/static/... → middleware skipped (excluded in config)
 */
export async function middleware(req: NextRequest) {
  const res = NextResponse.next();

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

    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();

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

    // Check for active admin impersonation session
    // If admin is impersonating a user, set context headers for application-level context switching
    if (session?.user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', session.user.id)
        .single();

      // Only check impersonation for admin users
      if (profile?.role === 'admin') {
        // Call RPC function to get active impersonation session
        const { data: impersonationSession, error: impersonationError } = await supabase
          .rpc('get_active_impersonation');

        if (!impersonationError && impersonationSession) {
          // Set custom headers for impersonation context
          // These headers can be read by API routes and server components
          // to filter data and apply permissions as the target user

          // Log impersonation context for audit and monitoring
          Sentry.captureMessage('Admin impersonating user', {
            level: 'info',
            user: {
              id: session.user.id,
              email: session.user.email,
            },
            contexts: {
              custom: {
                targetUserId: impersonationSession.target_user_id,
                targetUserEmail: impersonationSession.target_user_email,
                targetUserName: impersonationSession.target_user_name,
                sessionId: impersonationSession.id,
                expiresAt: impersonationSession.expires_at,
                path: req.nextUrl.pathname,
              },
            },
            tags: {
              impersonation: 'active',
            },
          });

          // Set headers on the request so they're available to API routes and server components
          const requestHeaders = new Headers(req.headers);
          requestHeaders.set('x-impersonating-user-id', impersonationSession.target_user_id);
          requestHeaders.set('x-admin-user-id', impersonationSession.admin_user_id);
          requestHeaders.set('x-impersonation-session-id', impersonationSession.id);

          // Create a new response with the modified request headers
          const modifiedResponse = NextResponse.next({
            request: {
              headers: requestHeaders,
            },
          });

          // Copy cookies from the original response
          req.cookies.getAll().forEach(cookie => {
            modifiedResponse.cookies.set(cookie.name, cookie.value);
          });

          return modifiedResponse;
        }
      }
    }

    // Check if user is suspended for all authenticated routes
    // (except login and public routes)
    if (session?.user && !req.nextUrl.pathname.startsWith('/login') && !req.nextUrl.pathname.startsWith('/auth')) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('is_active, suspension_reason, suspended_at')
        .eq('id', session.user.id)
        .single();

      // Redirect suspended users to login with suspension message
      if (profile && !profile.is_active) {
        Sentry.captureMessage('Suspended user attempted access', {
          level: 'warning',
          user: {
            id: session.user.id,
            email: session.user.email,
          },
          contexts: {
            custom: {
              path: req.nextUrl.pathname,
              suspensionReason: profile.suspension_reason,
              suspendedAt: profile.suspended_at,
            },
          },
        });

        // Sign out the user's current session
        // Note: This signs out the current session. For immediate invalidation
        // of ALL active sessions across devices, additional session management
        // would be required (to be tracked in future ticket)
        await supabase.auth.signOut();

        // Redirect to login with suspended flag
        const redirectUrl = new URL('/login', req.url);
        redirectUrl.searchParams.set('suspended', 'true');
        return NextResponse.redirect(redirectUrl);
      }
    }

    // Admin route protection
    if (req.nextUrl.pathname.startsWith('/admin')) {
      // Rate limiting for admin routes
      const ip =
        req.headers.get('x-forwarded-for')?.split(',')[0] ||
        req.headers.get('x-real-ip') ||
        'unknown';

      if (adminRateLimiter.isRateLimited(ip)) {
        Sentry.captureMessage('Admin route rate limit exceeded', {
          level: 'warning',
          contexts: {
            custom: {
              ip,
              path: req.nextUrl.pathname,
            },
          },
        });

        return new NextResponse(
          JSON.stringify({
            error: 'Too many requests',
            message: 'Rate limit exceeded. Please try again later.',
          }),
          {
            status: 429,
            headers: {
              'Content-Type': 'application/json',
              'Retry-After': '900', // 15 minutes in seconds
            },
          }
        );
      }

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
 * including API routes (for impersonation context headers) but excludes:
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
     * Match all request paths including API routes to set impersonation headers.
     * Only exclude static files and auth callbacks.
     */
    '/((?!_next/static|_next/image|favicon.ico|auth/callback).*)',
  ],
};