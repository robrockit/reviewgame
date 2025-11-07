import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import * as Sentry from '@sentry/nextjs';

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